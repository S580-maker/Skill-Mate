-- Skillmate initial schema for Supabase.
-- Apply this file in the Supabase SQL editor, then assign admin role only from
-- a trusted SQL editor or server-side service-role environment.

create extension if not exists pgcrypto;

create type public.account_role as enum ('student', 'admin');
create type public.booking_status as enum ('pending', 'confirmed', 'declined', 'completed', 'cancelled');
create type public.group_status as enum ('open', 'full', 'cancelled', 'completed');
create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 80),
  university text not null default '',
  course text not null default '',
  skills text[] not null default '{}',
  onboarding_completed boolean not null default false,
  bio text not null default '' check (char_length(bio) <= 500),
  avatar_url text,
  university_email text,
  campus_verified boolean not null default false,
  role public.account_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.student_identifiers (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  university_name text not null check (char_length(university_name) between 2 and 120),
  student_id_number text not null check (char_length(student_id_number) between 3 and 80),
  created_at timestamptz not null default now()
);

create table public.user_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  location_name text not null check (char_length(location_name) between 2 and 120),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 3 and 100),
  category text not null check (char_length(category) between 2 and 50),
  description text not null check (char_length(description) between 10 and 2000),
  price numeric(10,2) not null check (price > 0),
  currency char(3) not null default 'GHS',
  accepts_groups boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  group_booking_id uuid,
  scheduled_at timestamptz not null,
  location text not null default '',
  note text not null default '' check (char_length(note) <= 1000),
  agreed_price numeric(10,2) not null check (agreed_price > 0),
  currency char(3) not null default 'GHS',
  status public.booking_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_id <> provider_id)
);

create table public.group_bookings (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete restrict,
  host_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 100),
  invite_message text not null default '' check (char_length(invite_message) <= 300),
  scheduled_at timestamptz not null,
  capacity smallint not null check (capacity between 2 and 30),
  proposed_price_per_person numeric(10,2) not null check (proposed_price_per_person > 0),
  currency char(3) not null default 'GHS',
  status public.group_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings
  add constraint bookings_group_booking_fk
  foreign key (group_booking_id) references public.group_bookings(id) on delete set null;

create table public.group_booking_members (
  group_booking_id uuid not null references public.group_bookings(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_booking_id, student_id)
);

create table public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  university_email text not null check (char_length(university_email) between 5 and 254),
  status public.report_status not null default 'open',
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index verification_requests_open_student_idx
on public.verification_requests(student_id) where status = 'open';

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(body) between 3 and 1500),
  created_at timestamptz not null default now(),
  check (reviewer_id <> provider_id)
);

create table public.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 100),
  description text not null default '' check (char_length(description) <= 1000),
  image_path text,
  created_at timestamptz not null default now()
);

create table public.saved_services (
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, service_id)
);

create table public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete restrict,
  reported_user_id uuid not null references public.profiles(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 100),
  details text not null check (char_length(details) between 5 and 3000),
  status public.report_status not null default 'open',
  admin_notes text not null default '',
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (char_length(kind) between 2 and 50),
  title text not null check (char_length(title) between 2 and 120),
  body text not null default '' check (char_length(body) <= 500),
  target_path text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create function public.notify_booking_participants()
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
    values (new.provider_id, 'booking_request', 'New booking request',
      coalesce(v_service_title, 'A service') || ' has a new booking request.', 'bookings');
  elsif old.status is distinct from new.status then
    v_recipient_id := case when auth.uid() = new.customer_id then new.provider_id else new.customer_id end;
    insert into public.notifications (user_id, kind, title, body, target_path)
    values (v_recipient_id, 'booking_update', 'Booking updated',
      coalesce(v_service_title, 'Your booking') || ' is now ' || new.status::text || '.', 'bookings');
  end if;
  return new;
end;
$$;

create trigger booking_created_notification
after insert on public.bookings
for each row execute function public.notify_booking_participants();
create trigger booking_status_notification
after update of status on public.bookings
for each row execute function public.notify_booking_participants();

create function public.notify_message_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (user_id, kind, title, body, target_path)
  select member.user_id, 'message', 'New message', left(new.body, 160), 'messages'
  from public.conversation_members member
  where member.conversation_id = new.conversation_id
    and member.user_id <> new.sender_id;
  return new;
end;
$$;

create trigger message_created_notification
after insert on public.messages
for each row execute function public.notify_message_recipient();

create index services_active_category_idx on public.services(category, created_at desc) where is_active;
create index services_provider_idx on public.services(provider_id, created_at desc);
create index bookings_customer_idx on public.bookings(customer_id, scheduled_at desc);
create index bookings_provider_idx on public.bookings(provider_id, scheduled_at desc);
create index group_bookings_open_idx on public.group_bookings(scheduled_at) where status = 'open';
create index messages_conversation_created_idx on public.messages(conversation_id, created_at);
create index reports_status_created_idx on public.reports(status, created_at desc);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger user_locations_updated_at before update on public.user_locations
for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services
for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings
for each row execute function public.set_updated_at();
create trigger group_bookings_updated_at before update on public.group_bookings
for each row execute function public.set_updated_at();

create function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, university, university_email, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'university', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  if char_length(btrim(coalesce(new.raw_user_meta_data ->> 'university', ''))) between 2 and 120
    and char_length(btrim(coalesce(new.raw_user_meta_data ->> 'student_id_number', ''))) between 3 and 80 then
    insert into public.student_identifiers (student_id, university_name, student_id_number)
    values (
      new.id,
      btrim(new.raw_user_meta_data ->> 'university'),
      btrim(new.raw_user_meta_data ->> 'student_id_number')
    );
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

create function public.sync_auth_email_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email is distinct from new.email then
    update public.profiles
    set university_email = new.email, campus_verified = false
    where id = new.id;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row execute function public.sync_auth_email_change();

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create function public.is_blocked_between(p_other_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = (select auth.uid()) and blocked_id = p_other_user_id)
       or (blocker_id = p_other_user_id and blocked_id = (select auth.uid()))
  );
$$;

create function public.is_conversation_blocked(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
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

create function public.protect_profile_trust_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and auth.uid() = old.id and not (select public.is_admin())
     and (new.role is distinct from old.role
       or new.campus_verified is distinct from old.campus_verified) then
    raise exception 'Only an administrator can change account roles or campus verification.';
  end if;
  return new;
end;
$$;

create trigger protect_profile_trust_fields
before update on public.profiles
for each row execute function public.protect_profile_trust_fields();

create function public.create_group_booking(
  p_service_id uuid,
  p_title text,
  p_invite_message text,
  p_scheduled_at timestamptz,
  p_capacity smallint,
  p_price numeric
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services;
  v_group_id uuid;
  v_blocked boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in to create a group booking.';
  end if;
  if p_scheduled_at <= now() then
    raise exception 'Choose a future date for the group booking.';
  end if;
  select * into v_service
  from public.services
  where id = p_service_id and is_active and accepts_groups
  for share;
  if not found or v_service.provider_id = auth.uid() then
    raise exception 'Choose an active group service from another student.';
  end if;
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = v_service.provider_id)
       or (blocker_id = v_service.provider_id and blocked_id = auth.uid())
  ) into v_blocked;
  if v_blocked then
    raise exception 'This group booking is unavailable.';
  end if;
  insert into public.group_bookings (
    service_id, host_id, provider_id, title, invite_message,
    scheduled_at, capacity, proposed_price_per_person
  ) values (
    p_service_id, auth.uid(), v_service.provider_id, p_title, coalesce(p_invite_message, ''),
    p_scheduled_at, p_capacity, p_price
  ) returning id into v_group_id;
  insert into public.group_booking_members (group_booking_id, student_id)
  values (v_group_id, auth.uid());
  insert into public.bookings (
    service_id, customer_id, provider_id, group_booking_id, scheduled_at,
    agreed_price, currency, note
  ) values (
    v_service.id, auth.uid(), v_service.provider_id, v_group_id, p_scheduled_at,
    p_price, v_service.currency, 'Hosting this group booking'
  );
  return v_group_id;
end;
$$;

create function public.join_group_booking(p_group_id uuid)
returns public.group_booking_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.group_bookings;
  v_member public.group_booking_members;
  v_blocked boolean;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join a group booking.';
  end if;
  select * into v_group from public.group_bookings where id = p_group_id for update;
  if not found or v_group.status <> 'open' then
    raise exception 'This group booking is no longer open.';
  end if;
  if v_group.scheduled_at <= now() then
    raise exception 'This group booking date has passed.';
  end if;
  if exists (
    select 1 from public.group_booking_members
    where group_booking_id = p_group_id and student_id = auth.uid()
  ) then
    raise exception 'You have already joined this group booking.';
  end if;
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = v_group.provider_id)
       or (blocker_id = v_group.provider_id and blocked_id = auth.uid())
  ) into v_blocked;
  if v_blocked then
    raise exception 'This group booking is unavailable.';
  end if;
  if (select count(*) from public.group_booking_members where group_booking_id = p_group_id) >= v_group.capacity then
    update public.group_bookings set status = 'full' where id = p_group_id;
    raise exception 'This group booking is full.';
  end if;
  insert into public.group_booking_members (group_booking_id, student_id)
  values (p_group_id, auth.uid())
  returning * into v_member;
  insert into public.bookings (
    service_id, customer_id, provider_id, group_booking_id, scheduled_at,
    agreed_price, currency, note
  ) values (
    v_group.service_id, auth.uid(), v_group.provider_id, p_group_id, v_group.scheduled_at,
    v_group.proposed_price_per_person, v_group.currency, 'Joined group booking'
  );
  if (select count(*) from public.group_booking_members where group_booking_id = p_group_id) >= v_group.capacity then
    update public.group_bookings set status = 'full' where id = p_group_id;
  end if;
  return v_member;
end;
$$;

create function public.leave_group_booking(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.group_bookings;
begin
  if auth.uid() is null then
    raise exception 'Sign in to leave a group booking.';
  end if;
  select * into v_group from public.group_bookings where id = p_group_id for update;
  if not found then
    raise exception 'Group booking not found.';
  end if;
  if v_group.status not in ('open', 'full') or v_group.scheduled_at <= now() then
    raise exception 'This group booking can no longer be changed.';
  end if;
  if not exists (
    select 1 from public.group_booking_members
    where group_booking_id = p_group_id and student_id = auth.uid()
  ) then
    raise exception 'You are not a member of this group.';
  end if;
  if v_group.host_id = auth.uid() then
    update public.bookings set status = 'cancelled'
    where group_booking_id = p_group_id and status in ('pending', 'confirmed');
    update public.group_bookings set status = 'cancelled' where id = p_group_id;
    delete from public.group_booking_members where group_booking_id = p_group_id and student_id = auth.uid();
    return;
  end if;
  delete from public.group_booking_members
  where group_booking_id = p_group_id and student_id = auth.uid();
  update public.bookings set status = 'cancelled'
  where group_booking_id = p_group_id and customer_id = auth.uid()
    and status in ('pending', 'confirmed');
  if v_group.status = 'full' then
    update public.group_bookings set status = 'open' where id = p_group_id;
  end if;
end;
$$;

create function public.start_conversation(p_other_user_id uuid, p_booking_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_blocked boolean;
begin
  if auth.uid() is null or p_other_user_id = auth.uid() then
    raise exception 'Sign in and choose another student to message.';
  end if;
  if not exists (select 1 from public.profiles where id = p_other_user_id and role = 'student') then
    raise exception 'That student account could not be found.';
  end if;
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = p_other_user_id)
       or (blocker_id = p_other_user_id and blocked_id = auth.uid())
  ) into v_blocked;
  if v_blocked then
    raise exception 'Messaging is unavailable for this account.';
  end if;
  if p_booking_id is not null and not exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and (
        (b.customer_id = auth.uid() and b.provider_id = p_other_user_id)
        or (b.provider_id = auth.uid() and b.customer_id = p_other_user_id)
      )
  ) then
    raise exception 'That booking does not belong to both students.';
  end if;
  if p_booking_id is null and not exists (
    select 1 from public.services
    where provider_id = p_other_user_id and is_active
  ) then
    raise exception 'Start a conversation from an active service or booking.';
  end if;
  select c.id into v_conversation_id
  from public.conversations c
  join public.conversation_members mine
    on mine.conversation_id = c.id and mine.user_id = auth.uid()
  join public.conversation_members other
    on other.conversation_id = c.id and other.user_id = p_other_user_id
  where c.booking_id is not distinct from p_booking_id
  order by c.created_at desc
  limit 1;
  if v_conversation_id is null then
    insert into public.conversations (booking_id) values (p_booking_id)
    returning id into v_conversation_id;
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conversation_id, auth.uid()), (v_conversation_id, p_other_user_id);
  end if;
  return v_conversation_id;
end;
$$;

create function public.update_booking_status(p_booking_id uuid, p_status public.booking_status)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_user_id uuid := auth.uid();
  v_group_host_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to update a booking.';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  if not (select public.is_admin()) then
    if v_booking.provider_id = v_user_id
       and v_booking.status = 'pending'
       and p_status in ('confirmed', 'declined') then
      null;
    elsif v_booking.provider_id = v_user_id
       and v_booking.status = 'confirmed'
       and p_status = 'completed' then
      null;
    elsif v_booking.customer_id = v_user_id
       and v_booking.status in ('pending', 'confirmed')
       and v_booking.group_booking_id is null
       and p_status = 'cancelled' then
      null;
    else
      raise exception 'You cannot make that booking status change.';
    end if;
  end if;
  update public.bookings set status = p_status where id = p_booking_id returning * into v_booking;
  if p_status = 'declined' and v_booking.group_booking_id is not null
     and v_booking.provider_id = v_user_id then
    select host_id into v_group_host_id
    from public.group_bookings where id = v_booking.group_booking_id for update;
    if v_booking.customer_id = v_group_host_id then
      update public.group_bookings set status = 'cancelled' where id = v_booking.group_booking_id;
      update public.bookings set status = 'cancelled'
      where group_booking_id = v_booking.group_booking_id and id <> p_booking_id
        and status in ('pending', 'confirmed');
      delete from public.group_booking_members where group_booking_id = v_booking.group_booking_id;
    else
      delete from public.group_booking_members
      where group_booking_id = v_booking.group_booking_id and student_id = v_booking.customer_id;
      update public.group_bookings set status = 'open'
      where id = v_booking.group_booking_id and status = 'full';
    end if;
  end if;
  return v_booking;
end;
$$;

create function public.review_verification_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.verification_requests;
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;
  select * into v_request from public.verification_requests
  where id = p_request_id and status = 'open' for update;
  if not found then
    raise exception 'This verification request has already been reviewed.';
  end if;
  update public.verification_requests
  set status = case when p_approve then 'resolved'::public.report_status else 'dismissed'::public.report_status end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;
  if p_approve then
    update public.profiles set campus_verified = true where id = v_request.student_id;
  end if;
end;
$$;

create view public.provider_directory
with (security_invoker = false)
as
select
  p.id as provider_id,
  p.full_name,
  p.university,
  p.course,
  p.bio,
  p.avatar_url,
  p.campus_verified,
  s.id as service_id,
  s.title as service_title,
  s.category,
  s.description as service_description,
  s.price,
  s.currency,
  s.accepts_groups,
  s.created_at as service_created_at
from public.profiles p
join public.services s on s.provider_id = p.id
where s.is_active and p.role = 'student'
  and not public.is_blocked_between(p.id);

create view public.group_directory
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
where not public.is_blocked_between(g.provider_id)
  and g.scheduled_at > now()
group by g.id, host.full_name, s.title, s.category;

create view public.booking_directory
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
where b.customer_id = auth.uid() or b.provider_id = auth.uid();

create view public.conversation_directory
with (security_invoker = false)
as
select member.conversation_id, other.user_id as other_user_id,
  other_profile.full_name as other_user_name, member.user_id as current_user_id
from public.conversation_members member
join public.conversation_members other
  on other.conversation_id = member.conversation_id and other.user_id <> member.user_id
join public.profiles other_profile on other_profile.id = other.user_id
where member.user_id = auth.uid()
  and not public.is_blocked_between(other.user_id);

alter table public.profiles enable row level security;
alter table public.student_identifiers enable row level security;
alter table public.user_locations enable row level security;
alter table public.services enable row level security;
alter table public.bookings enable row level security;
alter table public.group_bookings enable row level security;
alter table public.group_booking_members enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.portfolio_items enable row level security;
alter table public.saved_services enable row level security;
alter table public.user_blocks enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;
alter table public.verification_requests enable row level security;

create policy "Profiles are readable by their owner and admins"
on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_admin()));
create policy "Students create their own profile"
on public.profiles for insert to authenticated
with check (id = (select auth.uid()) and role = 'student' and not campus_verified);
create policy "Students update their own non-role profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()) and role = 'student');
create policy "Admins manage profiles"
on public.profiles for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Students read their own student identifier"
on public.student_identifiers for select to authenticated
using (student_id = (select auth.uid()) or (select public.is_admin()));
create policy "Users read locations only for confirmed booking participants"
on public.user_locations for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.bookings b
    where b.status = 'confirmed'
      and (
        (b.customer_id = (select auth.uid()) and b.provider_id = user_locations.user_id)
        or (b.provider_id = (select auth.uid()) and b.customer_id = user_locations.user_id)
      )
  )
);
create policy "Users manage their own location"
on public.user_locations for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));
create policy "Admins manage verification requests"
on public.verification_requests for all to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));
create policy "Students submit verification requests"
on public.verification_requests for insert to authenticated
with check (student_id = (select auth.uid()) and status = 'open');
create policy "Students read their verification requests"
on public.verification_requests for select to authenticated
using (student_id = (select auth.uid()) or (select public.is_admin()));

create policy "Signed-in students can browse active services"
on public.services for select to authenticated
using (
  (
    is_active and provider_id <> (select auth.uid())
    and not public.is_blocked_between(provider_id)
  )
  or provider_id = (select auth.uid())
  or (select public.is_admin())
);
create policy "Students create their own services"
on public.services for insert to authenticated
with check (provider_id = (select auth.uid()));
create policy "Providers update their own services"
on public.services for update to authenticated
using (provider_id = (select auth.uid()) or (select public.is_admin()))
with check (provider_id = (select auth.uid()) or (select public.is_admin()));
create policy "Providers delete their own services"
on public.services for delete to authenticated
using (provider_id = (select auth.uid()) or (select public.is_admin()));

create policy "Booking participants and admins can read bookings"
on public.bookings for select to authenticated
using (customer_id = (select auth.uid()) or provider_id = (select auth.uid()) or (select public.is_admin()));
create policy "Students request bookings for another provider"
on public.bookings for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and provider_id <> (select auth.uid())
  and scheduled_at > now()
  and status = 'pending'
  and exists (
    select 1 from public.services s
    where s.id = bookings.service_id
      and s.provider_id = bookings.provider_id
      and s.is_active
  )
  and not public.is_blocked_between(provider_id)
);
create policy "Students browse open group bookings"
on public.group_bookings for select to authenticated
using (
  (status in ('open', 'full') and not public.is_blocked_between(provider_id))
  or host_id = (select auth.uid())
  or provider_id = (select auth.uid())
  or (select public.is_admin())
);
create policy "Admins update group bookings"
on public.group_bookings for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Members read group membership"
on public.group_booking_members for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (select 1 from public.group_bookings g where g.id = group_booking_id and (g.host_id = (select auth.uid()) or g.provider_id = (select auth.uid())))
  or (select public.is_admin())
);
create policy "Conversation members read conversations"
on public.conversations for select to authenticated
using (exists (select 1 from public.conversation_members m where m.conversation_id = id and m.user_id = (select auth.uid())) or (select public.is_admin()));
create policy "Users read their conversation membership"
on public.conversation_members for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Conversation members read messages"
on public.messages for select to authenticated
using (
  (
    exists (
      select 1 from public.conversation_members m
      where m.conversation_id = messages.conversation_id and m.user_id = (select auth.uid())
    )
    and not public.is_conversation_blocked(messages.conversation_id)
  )
  or (select public.is_admin())
);
create policy "Conversation members send messages as themselves"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1 from public.conversation_members m
    where m.conversation_id = messages.conversation_id and m.user_id = (select auth.uid())
  )
  and not public.is_conversation_blocked(messages.conversation_id)
);
create policy "Students read reviews"
on public.reviews for select to authenticated
using (true);
create policy "Customers review their completed bookings"
on public.reviews for insert to authenticated
with check (
  reviewer_id = (select auth.uid())
  and exists (
    select 1 from public.bookings b
    where b.id = reviews.booking_id
      and b.customer_id = reviews.reviewer_id
      and b.provider_id = reviews.provider_id
      and b.status = 'completed'
  )
);
create policy "Admins manage reviews"
on public.reviews for delete to authenticated
using ((select public.is_admin()));

create policy "Portfolio items are readable by signed-in students"
on public.portfolio_items for select to authenticated
using (provider_id = (select auth.uid()) or not public.is_blocked_between(provider_id));
create policy "Providers manage their own portfolio"
on public.portfolio_items for insert to authenticated
with check (provider_id = (select auth.uid()));
create policy "Providers update their portfolio"
on public.portfolio_items for update to authenticated
using (provider_id = (select auth.uid()) or (select public.is_admin()))
with check (provider_id = (select auth.uid()) or (select public.is_admin()));
create policy "Providers delete their portfolio items"
on public.portfolio_items for delete to authenticated
using (provider_id = (select auth.uid()) or (select public.is_admin()));

create policy "Students manage their saved services"
on public.saved_services for all to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()))
with check (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Users manage blocks they created"
on public.user_blocks for select to authenticated
using (blocker_id = (select auth.uid()) or (select public.is_admin()));
create policy "Students block another student"
on public.user_blocks for insert to authenticated
with check (blocker_id = (select auth.uid()) and blocked_id <> (select auth.uid()));
create policy "Students unblock another student"
on public.user_blocks for delete to authenticated
using (blocker_id = (select auth.uid()) or (select public.is_admin()));

create policy "Reporters and admins can read reports"
on public.reports for select to authenticated
using (reporter_id = (select auth.uid()) or (select public.is_admin()));
create policy "Students submit reports"
on public.reports for insert to authenticated
with check (reporter_id = (select auth.uid()) and reported_user_id <> (select auth.uid()));
create policy "Admins manage reports"
on public.reports for update to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Users read their notifications"
on public.notifications for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));
create policy "Users mark their notifications read"
on public.notifications for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

grant usage on schema public to authenticated;
grant select on public.provider_directory to authenticated;
grant select on public.group_directory to authenticated;
grant select on public.booking_directory to authenticated;
grant select on public.conversation_directory to authenticated;
grant select on public.profiles to authenticated;
grant select on public.student_identifiers to authenticated;
grant select, insert, update, delete on public.user_locations to authenticated;
grant update (full_name, university, course, skills, onboarding_completed, avatar_url, bio) on public.profiles to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert on public.bookings to authenticated;
grant select on public.group_bookings to authenticated;
grant select on public.group_booking_members to authenticated;
grant select on public.conversations to authenticated;
grant select on public.conversation_members to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, delete on public.reviews to authenticated;
grant select, insert, update, delete on public.portfolio_items to authenticated;
grant select, insert, delete on public.saved_services to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select, insert on public.verification_requests to authenticated;
insert into storage.buckets (id, name, public)
values ('portfolio-images', 'portfolio-images', true)
on conflict (id) do nothing;
create policy "Authenticated students upload their own portfolio images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'portfolio-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
create policy "Authenticated students delete their own portfolio images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'portfolio-images'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
revoke all on function public.create_group_booking(uuid, text, text, timestamptz, smallint, numeric) from public, anon;
revoke all on function public.join_group_booking(uuid) from public, anon;
revoke all on function public.leave_group_booking(uuid) from public, anon;
revoke all on function public.start_conversation(uuid, uuid) from public, anon;
revoke all on function public.update_booking_status(uuid, public.booking_status) from public, anon;
revoke all on function public.review_verification_request(uuid, boolean) from public, anon;
revoke all on function public.is_blocked_between(uuid) from public, anon;
revoke all on function public.is_conversation_blocked(uuid) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_blocked_between(uuid) to authenticated;
grant execute on function public.is_conversation_blocked(uuid) to authenticated;
grant execute on function public.create_group_booking(uuid, text, text, timestamptz, smallint, numeric) to authenticated;
grant execute on function public.join_group_booking(uuid) to authenticated;
grant execute on function public.leave_group_booking(uuid) to authenticated;
grant execute on function public.start_conversation(uuid, uuid) to authenticated;
grant execute on function public.update_booking_status(uuid, public.booking_status) to authenticated;
grant execute on function public.review_verification_request(uuid, boolean) to authenticated;

-- Admin role assignment example (run manually after creating the account):
-- update public.profiles
-- set role = 'admin'
-- where id = (select id from auth.users where email = 'admin@your-university.edu');
