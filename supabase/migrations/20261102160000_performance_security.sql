begin;

alter table public.notifications
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create or replace function public.notify_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, target_path, conversation_id)
  select member.user_id, 'message', 'New message', 'Open Skillmate to read your new message.',
    'messages', new.conversation_id
  from public.conversation_members member
  join public.profiles recipient on recipient.id = member.user_id and recipient.notify_messages
  where member.conversation_id = new.conversation_id
    and member.user_id <> new.sender_id;
  return new;
end;
$$;

update public.notifications
set body = 'Open Skillmate to read your new message.'
where kind = 'message' and body is distinct from 'Open Skillmate to read your new message.';

drop policy if exists "Message senders delete their own messages" on public.messages;
revoke delete on public.messages from authenticated;

create or replace function public.prevent_chat_evidence_deletion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'messages'
    or exists (select 1 from public.messages where conversation_id = old.id) then
    raise exception 'Chat evidence cannot be permanently deleted.';
  end if;
  return old;
end;
$$;

drop trigger if exists preserve_chat_message_evidence on public.messages;
create trigger preserve_chat_message_evidence
before delete on public.messages
for each row execute function public.prevent_chat_evidence_deletion();

drop trigger if exists preserve_chat_conversation_evidence on public.conversations;
create trigger preserve_chat_conversation_evidence
before delete on public.conversations
for each row
execute function public.prevent_chat_evidence_deletion();

alter table public.verified_auth_sessions
  add column if not exists expires_at timestamptz not null default (now() + interval '30 days');
update public.verified_auth_sessions
set expires_at = now() + interval '30 days'
where expires_at is null;
alter table public.verified_auth_sessions
  alter column expires_at set default (now() + interval '30 days'),
  alter column expires_at set not null;
create index if not exists verified_auth_sessions_expiry_idx
  on public.verified_auth_sessions (expires_at);
grant select, insert, update, delete on public.verified_auth_sessions to service_role;

create or replace function public.is_verified_session()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session_id text := auth.jwt() ->> 'session_id';
begin
  if auth.uid() is null
    or v_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1
    from public.verified_auth_sessions verified
    where verified.session_id = v_session_id::uuid
      and verified.user_id = auth.uid()
      and verified.expires_at > now()
  );
end;
$$;

notify pgrst, 'reload schema';
commit;
