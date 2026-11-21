-- Renames the realtime topic prefix from skillmate-chat to skillflex-chat and updates
-- user-facing "Skill Flex" copy. The client must be deployed with this migration.

create or replace function public.can_access_chat_realtime_topic()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_verified_session() and exists (
    select 1
    from public.conversation_members member
    where split_part(realtime.topic(), ':', 1) = 'skillflex-chat'
      and member.conversation_id::text = split_part(realtime.topic(), ':', 2)
      and member.user_id = (select auth.uid())
      and not public.is_conversation_blocked(member.conversation_id)
  );
$$;

create or replace function public.require_verified_session_for_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' and not public.is_verified_session() then
    raise exception 'Verify your email before accessing Skill Flex.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.notify_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, target_path, conversation_id)
  select member.user_id, 'message', 'New message', 'Open Skill Flex to read your new message.',
    'messages', new.conversation_id
  from public.conversation_members member
  join public.profiles recipient on recipient.id = member.user_id and recipient.notify_messages
  where member.conversation_id = new.conversation_id
    and member.user_id <> new.sender_id;
  return new;
end;
$$;

update public.notifications
set body = 'Open Skill Flex to read your new message.'
where kind = 'message' and body is distinct from 'Open Skill Flex to read your new message.';
