begin;

with duplicate_message_notifications as (
  select id,
    row_number() over (
      partition by user_id, conversation_id
      order by created_at desc, id desc
    ) as row_number
  from public.notifications
  where kind = 'message' and conversation_id is not null
)
delete from public.notifications notification
using duplicate_message_notifications duplicate
where notification.id = duplicate.id and duplicate.row_number > 1;

create unique index notifications_message_conversation_idx
  on public.notifications(user_id, conversation_id)
  where kind = 'message' and conversation_id is not null;

create or replace function public.notify_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, target_path, conversation_id)
  select member.user_id, 'message', 'New messages',
    'Open Skill Flex to read your new message.', 'messages', new.conversation_id
  from public.conversation_members member
  join public.profiles recipient on recipient.id = member.user_id and recipient.notify_messages
  where member.conversation_id = new.conversation_id
    and member.user_id <> new.sender_id
  on conflict (user_id, conversation_id)
    where kind = 'message' and conversation_id is not null
    do update set
      title = excluded.title,
      body = excluded.body,
      target_path = excluded.target_path,
      read_at = null,
      created_at = now();
  return new;
end;
$$;

create policy "Users delete their own notifications"
on public.notifications for delete to authenticated
using (user_id = (select auth.uid()));

grant delete on public.notifications to authenticated;

commit;
