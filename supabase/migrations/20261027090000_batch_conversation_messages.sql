-- Invoker permissions preserve message RLS; explicit membership also excludes
-- conversations the caller does not belong to. Each chat gets its own limit.
create or replace function public.recent_conversation_messages(
  conversation_ids uuid[], page_size integer default 30
)
returns setof public.messages
language sql stable security invoker
set search_path = public
as $$
  select recent.*
  from (
    select distinct member.conversation_id
    from public.conversation_members member
    where member.user_id = (select auth.uid())
      and member.conversation_id = any(conversation_ids)
    order by member.conversation_id
    limit 20
  ) allowed
  cross join lateral (
    select message.* from public.messages message
    where message.conversation_id = allowed.conversation_id
    order by message.created_at desc, message.id desc
    limit greatest(1, least(coalesce(page_size, 30), 30))
  ) recent
  order by allowed.conversation_id, recent.created_at desc, recent.id desc;
$$;
revoke all on function public.recent_conversation_messages(uuid[], integer) from public, anon;
grant execute on function public.recent_conversation_messages(uuid[], integer) to authenticated;
