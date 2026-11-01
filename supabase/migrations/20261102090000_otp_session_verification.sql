begin;

create table if not exists public.verified_auth_sessions (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now()
);

alter table public.verified_auth_sessions enable row level security;
revoke all on table public.verified_auth_sessions from public, anon, authenticated;
grant select, insert on table public.verified_auth_sessions to service_role;

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
  );
end;
$$;

revoke all on function public.is_verified_session() from public, anon;
grant execute on function public.is_verified_session() to authenticated;

create or replace function public.require_verified_session_for_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.role() = 'authenticated' and not public.is_verified_session() then
    raise exception 'Verify your email before accessing Skillmate.';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.require_verified_session_for_write() from public, anon, authenticated;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'profiles', 'student_identifiers', 'user_locations', 'services', 'bookings',
    'group_bookings', 'group_booking_members', 'conversations', 'conversation_members',
    'messages', 'reviews', 'portfolio_items', 'saved_services', 'user_blocks',
    'reports', 'notifications', 'support_tickets', 'verification_requests'
  ];
begin
  foreach v_table in array v_tables loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('drop policy if exists "OTP verified sessions only" on public.%I', v_table);
      execute format(
        'create policy "OTP verified sessions only" on public.%I as restrictive for all to authenticated using (public.is_verified_session()) with check (public.is_verified_session())',
        v_table
      );
      execute format('drop trigger if exists require_verified_session_before_write on public.%I', v_table);
      execute format(
        'create trigger require_verified_session_before_write before insert or update or delete on public.%I for each row execute function public.require_verified_session_for_write()',
        v_table
      );
    else
      raise notice 'Skipping OTP policy for missing table public.%', v_table;
    end if;
  end loop;
end;
$$;

drop policy if exists "OTP verified sessions only" on storage.objects;
create policy "OTP verified sessions only"
on storage.objects as restrictive for all to authenticated
using (
  bucket_id not in (
    'portfolio-images', 'profile-avatars', 'support-screenshots',
    'service-covers', 'student-verification-ids'
  )
  or public.is_verified_session()
)
with check (
  bucket_id not in (
    'portfolio-images', 'profile-avatars', 'support-screenshots',
    'service-covers', 'student-verification-ids'
  )
  or public.is_verified_session()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_verified_session() and exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.is_blocked_between(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.is_verified_session() or exists (
    select 1 from public.user_blocks
    where (blocker_id = (select auth.uid()) and blocked_id = p_other_user_id)
       or (blocker_id = p_other_user_id and blocked_id = (select auth.uid()))
  );
$$;

create or replace function public.is_conversation_blocked(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not public.is_verified_session() or exists (
    select 1
    from public.conversation_members mine
    join public.conversation_members other
      on other.conversation_id = mine.conversation_id
      and other.user_id <> mine.user_id
    where mine.conversation_id = p_conversation_id
      and mine.user_id = (select auth.uid())
      and public.is_blocked_between(other.user_id)
  );
$$;

create or replace function public.can_access_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_verified_session()
    and exists (
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
  select public.is_verified_session()
    and p_sender_id = (select auth.uid())
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
    where split_part(realtime.topic(), ':', 1) = 'skillmate-chat'
      and member.conversation_id::text = split_part(realtime.topic(), ':', 2)
      and member.user_id = (select auth.uid())
      and not public.is_conversation_blocked(member.conversation_id)
  );
$$;

create or replace view public.provider_directory
with (security_invoker = false)
as select
  p.id as provider_id, p.full_name, p.university, p.course, p.bio,
  p.avatar_url, p.campus_verified,
  s.id as service_id, s.title as service_title, s.category,
  s.description as service_description, s.price, s.currency,
  s.accepts_groups, s.created_at as service_created_at,
  s.cover_image_path, s.delivery_method, s.estimated_delivery, s.price_type
from public.profiles p
join public.services s on s.provider_id = p.id
where public.is_verified_session()
  and s.is_active
  and not public.is_blocked_between(p.id);

create or replace view public.group_directory
with (security_invoker = false)
as
select g.id, g.service_id, g.host_id, host.full_name as host_name,
  g.provider_id, g.title, g.invite_message, g.scheduled_at, g.capacity,
  g.proposed_price_per_person, g.currency, g.status, s.title as service_title,
  s.category, count(m.student_id)::integer as member_count
from public.group_bookings g
join public.profiles host on host.id = g.host_id
join public.services s on s.id = g.service_id
left join public.group_booking_members m on m.group_booking_id = g.id
where public.is_verified_session()
  and not public.is_blocked_between(g.provider_id)
  and g.scheduled_at > now()
group by g.id, host.full_name, s.title, s.category;

create or replace view public.booking_directory
with (security_invoker = false)
as
select b.id, b.customer_id, b.provider_id, b.group_booking_id, b.scheduled_at,
  b.note, b.agreed_price, b.currency, b.status,
  customer.full_name as customer_name, provider.full_name as provider_name,
  s.title as service_title, s.category
from public.bookings b
join public.profiles customer on customer.id = b.customer_id
join public.profiles provider on provider.id = b.provider_id
join public.services s on s.id = b.service_id
where public.is_verified_session()
  and (b.customer_id = auth.uid() or b.provider_id = auth.uid());

create or replace view public.conversation_directory
with (security_invoker = false)
as
select member.conversation_id, other.user_id as other_user_id,
  other_profile.full_name as other_user_name, member.user_id as current_user_id
from public.conversation_members member
join public.conversation_members other
  on other.conversation_id = member.conversation_id and other.user_id <> member.user_id
join public.profiles other_profile on other_profile.id = other.user_id
where public.is_verified_session()
  and member.user_id = auth.uid()
  and not public.is_blocked_between(other.user_id);

notify pgrst, 'reload schema';
commit;
