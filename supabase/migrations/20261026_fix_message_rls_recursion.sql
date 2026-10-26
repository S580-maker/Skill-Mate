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

revoke all on function public.can_access_conversation(uuid) from public, anon;
revoke all on function public.can_send_conversation_message(uuid, uuid, uuid) from public, anon;
grant execute on function public.can_access_conversation(uuid) to authenticated;
grant execute on function public.can_send_conversation_message(uuid, uuid, uuid) to authenticated;
