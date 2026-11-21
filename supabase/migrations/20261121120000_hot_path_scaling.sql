begin;

create index if not exists notifications_user_unread_created_idx
  on public.notifications(user_id, read_at, created_at desc)
  where read_at is null;

create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create index if not exists messages_unread_idx
  on public.messages(conversation_id, sender_id, created_at desc)
  where read_at is null;

create index if not exists conversation_members_user_idx
  on public.conversation_members(user_id, conversation_id);

create index if not exists bookings_customer_status_scheduled_idx
  on public.bookings(customer_id, status, scheduled_at);

create index if not exists bookings_provider_status_scheduled_idx
  on public.bookings(provider_id, status, scheduled_at);

create or replace function public.skillmate_unread_counts()
returns table(notification_count bigint, message_count bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    (select count(*) from public.notifications n
     where n.user_id = auth.uid() and n.read_at is null and n.kind <> 'message'),
    (select count(*) from public.messages m
     where m.sender_id <> auth.uid() and m.read_at is null);
$$;

revoke all on function public.skillmate_unread_counts() from public, anon;
grant execute on function public.skillmate_unread_counts() to authenticated;

notify pgrst, 'reload schema';
commit;
