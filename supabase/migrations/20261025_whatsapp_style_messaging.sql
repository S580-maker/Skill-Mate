alter table public.messages
  add column if not exists read_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists reply_to uuid references public.messages(id) on delete set null;
alter table public.messages enable row level security;

create index if not exists messages_reply_to_idx
  on public.messages(reply_to) where reply_to is not null;

create or replace function public.can_access_chat_realtime_topic()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members member
    where split_part(realtime.topic(), ':', 1) = 'skillmate-chat'
      and member.conversation_id::text = split_part(realtime.topic(), ':', 2)
      and member.user_id = (select auth.uid())
      and not public.is_conversation_blocked(member.conversation_id)
  );
$$;

create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.conversation_members mine
    where mine.conversation_id = p_conversation_id
      and mine.user_id = (select auth.uid())
  )
  and not exists (
    select 1
    from public.conversation_members other
    join public.user_blocks blocked
      on (blocked.blocker_id = (select auth.uid()) and blocked.blocked_id = other.user_id)
      or (blocked.blocker_id = other.user_id and blocked.blocked_id = (select auth.uid()))
    where other.conversation_id = p_conversation_id
      and other.user_id <> (select auth.uid())
  );
$$;

create or replace function public.can_send_conversation_message(
  p_conversation_id uuid,
  p_sender_id uuid,
  p_reply_to uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_sender_id = (select auth.uid())
    and public.can_access_conversation(p_conversation_id)
    and (
      p_reply_to is null
      or exists (
        select 1
        from public.messages replied
        where replied.id = p_reply_to
          and replied.conversation_id = p_conversation_id
      )
    );
$$;

drop policy if exists "Conversation members read messages" on public.messages;
drop policy if exists "Conversation members send messages as themselves" on public.messages;
drop policy if exists "Message recipients mark messages delivered or read" on public.messages;
drop policy if exists "Message senders delete their own messages" on public.messages;
drop policy if exists "Conversation members access private realtime chat channels" on realtime.messages;

create policy "Conversation members read messages"
on public.messages for select to authenticated
using (public.can_access_conversation(conversation_id));

create policy "Conversation members send messages as themselves"
on public.messages for insert to authenticated
with check (public.can_send_conversation_message(conversation_id, sender_id, reply_to));

create policy "Message recipients mark messages delivered or read"
on public.messages for update to authenticated
using (
  sender_id <> (select auth.uid())
  and public.can_access_conversation(conversation_id)
)
with check (
  sender_id <> (select auth.uid())
  and public.can_access_conversation(conversation_id)
);

create policy "Message senders delete their own messages"
on public.messages for delete to authenticated
using (
  sender_id = (select auth.uid())
  and public.can_access_conversation(conversation_id)
);

create policy "Conversation members access private realtime chat channels"
on realtime.messages for all to authenticated
using ((select public.can_access_chat_realtime_topic()))
with check ((select public.can_access_chat_realtime_topic()));

revoke all on public.messages from anon, public;
revoke update on public.messages from authenticated;
revoke update (id, conversation_id, sender_id, body, created_at, read_at, delivered_at, reply_to)
  on public.messages from authenticated;
grant select, insert, delete on public.messages to authenticated;
grant update (read_at, delivered_at) on public.messages to authenticated;
revoke all on function public.can_access_chat_realtime_topic() from public, anon;
grant execute on function public.can_access_chat_realtime_topic() to authenticated;
revoke all on function public.can_access_conversation(uuid) from public, anon;
revoke all on function public.can_send_conversation_message(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_access_conversation(uuid) to authenticated;
grant execute on function public.can_send_conversation_message(uuid, uuid, uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'messages'
     ) then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end;
$$;
