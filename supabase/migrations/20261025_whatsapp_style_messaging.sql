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

drop policy if exists "Conversation members read messages" on public.messages;
drop policy if exists "Conversation members send messages as themselves" on public.messages;
drop policy if exists "Message recipients mark messages delivered or read" on public.messages;
drop policy if exists "Message senders delete their own messages" on public.messages;
drop policy if exists "Conversation members access private realtime chat channels" on realtime.messages;

create policy "Conversation members read messages"
on public.messages for select to authenticated
using (
  exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = (select auth.uid())
  )
  and not public.is_conversation_blocked(messages.conversation_id)
);

create policy "Conversation members send messages as themselves"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = (select auth.uid())
  )
  and not public.is_conversation_blocked(messages.conversation_id)
  and (
    reply_to is null
    or exists (
      select 1 from public.messages replied
      where replied.id = messages.reply_to
        and replied.conversation_id = messages.conversation_id
    )
  )
);

create policy "Message recipients mark messages delivered or read"
on public.messages for update to authenticated
using (
  sender_id <> (select auth.uid())
  and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = (select auth.uid())
  )
  and not public.is_conversation_blocked(messages.conversation_id)
)
with check (
  sender_id <> (select auth.uid())
  and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = (select auth.uid())
  )
  and not public.is_conversation_blocked(messages.conversation_id)
);

create policy "Message senders delete their own messages"
on public.messages for delete to authenticated
using (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id
      and m.user_id = (select auth.uid())
  )
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
