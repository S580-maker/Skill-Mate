alter table public.profiles
  add column if not exists phone_number text not null default '',
  add column if not exists notify_booking_updates boolean not null default true,
  add column if not exists notify_messages boolean not null default true;

alter table public.profiles
  drop constraint if exists profiles_phone_number_length;

alter table public.profiles
  add constraint profiles_phone_number_length
  check (char_length(phone_number) <= 32);

grant update (phone_number, notify_booking_updates, notify_messages)
on public.profiles to authenticated;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('Booking', 'Payment', 'User behaviour', 'Bug', 'Other')),
  message text not null check (char_length(message) between 10 and 3000),
  screenshot_url text,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_user_created_idx
on public.support_tickets(user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists "Users read their own support tickets" on public.support_tickets;
create policy "Users read their own support tickets"
on public.support_tickets for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Users create their own support tickets" on public.support_tickets;
create policy "Users create their own support tickets"
on public.support_tickets for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists "Admins manage support tickets" on public.support_tickets;
create policy "Admins manage support tickets"
on public.support_tickets for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

grant select on public.support_tickets to authenticated;
grant insert (user_id, category, message, screenshot_url) on public.support_tickets to authenticated;
grant update (status) on public.support_tickets to authenticated;

create or replace function public.notify_booking_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service_title text;
  v_recipient_id uuid;
begin
  select title into v_service_title from public.services where id = new.service_id;
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, title, body, target_path)
    select new.provider_id, 'booking_request', 'New booking request',
      coalesce(v_service_title, 'A service') || ' has a new booking request.', 'bookings'
    where exists (
      select 1 from public.profiles
      where id = new.provider_id and notify_booking_updates
    );
  elsif old.status is distinct from new.status then
    v_recipient_id := case when auth.uid() = new.customer_id then new.provider_id else new.customer_id end;
    insert into public.notifications (user_id, kind, title, body, target_path)
    select v_recipient_id, 'booking_update', 'Booking updated',
      coalesce(v_service_title, 'Your booking') || ' is now ' || new.status::text || '.', 'bookings'
    where exists (
      select 1 from public.profiles
      where id = v_recipient_id and notify_booking_updates
    );
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
  insert into public.notifications (user_id, kind, title, body, target_path)
  select member.user_id, 'message', 'New message', left(new.body, 160), 'messages'
  from public.conversation_members member
  join public.profiles recipient on recipient.id = member.user_id and recipient.notify_messages
  where member.conversation_id = new.conversation_id
    and member.user_id <> new.sender_id;
  return new;
end;
$$;

create or replace function public.anonymize_closed_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    raise exception 'A user id is required.';
  end if;

  update public.profiles
  set full_name = 'Deleted student',
      university = 'Account closed',
      course = '',
      bio = '',
      avatar_url = null,
      phone_number = '',
      university_email = null,
      notify_booking_updates = false,
      notify_messages = false,
      updated_at = now()
  where id = p_user_id;

  if not found then
    raise exception 'The user profile no longer exists.';
  end if;

  update public.services
  set is_active = false,
      title = 'Unavailable service',
      description = 'This service is no longer available.',
      updated_at = now()
  where provider_id = p_user_id;

  update public.bookings
  set note = '', location = '', updated_at = now()
  where customer_id = p_user_id or provider_id = p_user_id;

  update public.group_bookings
  set title = 'Group booking (account closed)',
      invite_message = '',
      status = 'cancelled',
      updated_at = now()
  where host_id = p_user_id or provider_id = p_user_id;

  delete from public.group_booking_members where student_id = p_user_id;

  update public.messages
  set body = 'Message removed after account closure.'
  where sender_id = p_user_id;

  update public.reviews
  set body = 'Review author closed their account.'
  where reviewer_id = p_user_id;

  update public.reports
  set reason = 'Account closed',
      details = 'Report details removed after account closure.'
  where reporter_id = p_user_id;

  update public.support_tickets
  set message = 'Ticket details removed after account closure.',
      screenshot_url = null
  where user_id = p_user_id;

  delete from public.student_identifiers where student_id = p_user_id;
  delete from public.user_locations where user_id = p_user_id;
  delete from public.saved_services where user_id = p_user_id;
  delete from public.user_blocks where blocker_id = p_user_id or blocked_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;
  delete from public.verification_requests where student_id = p_user_id;
  delete from public.portfolio_items where provider_id = p_user_id;
end;
$$;

revoke all on function public.anonymize_closed_account(uuid) from public, anon, authenticated;
grant execute on function public.anonymize_closed_account(uuid) to service_role;

insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated students upload their own profile avatars" on storage.objects;
create policy "Authenticated students upload their own profile avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Authenticated students delete their own profile avatars" on storage.objects;
create policy "Authenticated students delete their own profile avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

insert into storage.buckets (id, name, public)
values ('support-screenshots', 'support-screenshots', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated students upload their own support screenshots" on storage.objects;
create policy "Authenticated students upload their own support screenshots"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'support-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users and admins read support screenshots" on storage.objects;
create policy "Users and admins read support screenshots"
on storage.objects for select to authenticated
using (
  bucket_id = 'support-screenshots'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.is_admin())
  )
);
