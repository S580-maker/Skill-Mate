-- Existing projects: run this entire file in the Supabase SQL Editor.
-- All database changes commit together or roll back together.
begin;
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

-- Apply after 20261026140000_profile_settings_and_support.sql.
-- Keep private identity and verification consistent for every campus update.
create or replace function public.sync_profile_campus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.university is distinct from old.university then
    if char_length(btrim(new.university)) not between 2 and 120 then
      raise exception 'Enter a university between 2 and 120 characters.';
    end if;
    update public.student_identifiers
    set university_name = btrim(new.university) where student_id = new.id;
    update public.profiles set campus_verified = false, university_email = null
    where id = new.id;
    update public.verification_requests
    set status = 'dismissed', reviewed_at = now()
    where student_id = new.id and status in ('open', 'reviewing');
  end if;
  return new;
end;
$$;

revoke all on function public.sync_profile_campus() from public, anon, authenticated;
drop trigger if exists sync_profile_campus on public.profiles;
create trigger sync_profile_campus after update of university on public.profiles
for each row execute function public.sync_profile_campus();

create or replace function public.save_account_profile(
  p_full_name text, p_university text, p_bio text,
  p_phone_number text, p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to update your profile.'; end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 80
    or char_length(btrim(coalesce(p_university, ''))) not between 2 and 120
    or char_length(coalesce(p_bio, '')) > 500
    or char_length(coalesce(p_phone_number, '')) > 32 then
    raise exception 'Check the name, university, bio and phone number lengths.';
  end if;
  update public.profiles
  set full_name = btrim(p_full_name), university = btrim(p_university),
      bio = coalesce(p_bio, ''), phone_number = coalesce(p_phone_number, ''),
      avatar_url = p_avatar_url
  where id = auth.uid();
  if not found then raise exception 'Your profile no longer exists.'; end if;
end;
$$;

revoke all on function public.save_account_profile(text, text, text, text, text) from public, anon;
grant execute on function public.save_account_profile(text, text, text, text, text) to authenticated;

drop policy if exists "Students delete their unused support screenshots" on storage.objects;
create policy "Students delete their unused support screenshots"
on storage.objects for delete to authenticated
using (
  bucket_id = 'support-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.support_tickets ticket
    where ticket.user_id = (select auth.uid()) and ticket.screenshot_url = name
  )
);

-- Public profile, private student details and booking location save together.
create or replace function public.save_student_profile(
  p_full_name text,
  p_university text,
  p_bio text,
  p_location text default '',
  p_student_id_number text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_student_id text := btrim(coalesce(p_student_id_number, ''));
  v_location text := btrim(coalesce(p_location, ''));
begin
  if v_user_id is null then raise exception 'Sign in to update your profile.'; end if;
  select * into v_profile from public.profiles where id = v_user_id;
  if not found then raise exception 'Your profile no longer exists.'; end if;
  if char_length(v_location) > 120 then
    raise exception 'Use a campus or hostel name up to 120 characters.';
  end if;
  if v_student_id <> '' and char_length(v_student_id) not between 3 and 80 then
    raise exception 'Use a student ID between 3 and 80 characters.';
  end if;
  if v_student_id <> '' and v_profile.role <> 'student' then
    raise exception 'Only student accounts can update student ID details.';
  end if;

  perform public.save_account_profile(
    p_full_name, p_university, p_bio, v_profile.phone_number, v_profile.avatar_url
  );

  if v_student_id <> '' then
    insert into public.student_identifiers (student_id, university_name, student_id_number)
    values (v_user_id, btrim(p_university), v_student_id)
    on conflict (student_id) do update
      set university_name = excluded.university_name,
          student_id_number = excluded.student_id_number;
  end if;

  if v_location <> '' then
    insert into public.user_locations (user_id, location_name)
    values (v_user_id, v_location)
    on conflict (user_id) do update set location_name = excluded.location_name;
  else
    delete from public.user_locations where user_id = v_user_id;
  end if;
end;
$$;

revoke all on function public.save_student_profile(text, text, text, text, text) from public, anon;
grant execute on function public.save_student_profile(text, text, text, text, text) to authenticated;


notify pgrst, 'reload schema';

commit;
