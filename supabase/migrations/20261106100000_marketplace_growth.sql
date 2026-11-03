-- Apply after the existing migrations. No payments are collected by these features.
begin;

drop trigger if exists bookings_require_completed_work_review on public.bookings;
drop function if exists public.require_customer_reviews_before_booking();

create table public.provider_availability (
  provider_id uuid primary key references public.profiles(id) on delete cascade,
  timezone text not null default 'Africa/Accra',
  slot_minutes integer not null default 60 check (slot_minutes between 15 and 240 and slot_minutes % 15 = 0),
  weekly_hours jsonb not null default '[]' check (jsonb_typeof(weekly_hours) = 'array'),
  blocked_dates date[] not null default '{}',
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.provider_availability enable row level security;
revoke all on public.provider_availability from public, anon, authenticated;
grant select on public.provider_availability to authenticated;
create policy "Students see published provider hours and their own settings"
on public.provider_availability for select to authenticated using (
  public.is_verified_session() and (provider_id = auth.uid() or (
    is_published and not public.is_blocked_between(provider_id)
    and exists (select 1 from public.services s where s.provider_id = provider_availability.provider_id and s.is_active)
  ))
);

create function public.save_provider_availability(
  p_timezone text, p_slot_minutes integer, p_weekly_hours jsonb,
  p_blocked_dates date[], p_is_published boolean
) returns public.provider_availability language plpgsql security definer set search_path = '' as $$
declare v_day jsonb; v_result public.provider_availability;
begin
  if auth.uid() is null or not public.is_verified_session() then raise exception 'Sign in to save your hours.'; end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone)
    or p_slot_minutes is null or p_slot_minutes not between 15 and 240 or p_slot_minutes % 15 <> 0
    or p_weekly_hours is null or jsonb_typeof(p_weekly_hours) <> 'array' then
    raise exception 'Choose a valid time zone, appointment length and working hours.';
  end if;
  if jsonb_array_length(p_weekly_hours) > 7 or cardinality(p_blocked_dates) > 366
    or (select count(distinct d->>'day') from jsonb_array_elements(p_weekly_hours) d) <> jsonb_array_length(p_weekly_hours) then
    raise exception 'Use one opening period per day and at most 366 dates off.';
  end if;
  for v_day in select value from jsonb_array_elements(p_weekly_hours) loop
    if coalesce(v_day->>'day', '') !~ '^[0-6]$'
      or coalesce(v_day->>'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      or coalesce(v_day->>'end', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
      raise exception 'Choose a day and valid start and end times.';
    end if;
    if (v_day->>'end')::time - (v_day->>'start')::time < make_interval(mins => p_slot_minutes) then
      raise exception 'Each opening period must fit at least one full appointment.';
    end if;
  end loop;
  if p_is_published and jsonb_array_length(p_weekly_hours) = 0 then raise exception 'Choose at least one working day.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 0));
  insert into public.provider_availability(provider_id, timezone, slot_minutes, weekly_hours, blocked_dates, is_published)
  values(auth.uid(), p_timezone, p_slot_minutes, p_weekly_hours, coalesce(p_blocked_dates, '{}'), coalesce(p_is_published, false))
  on conflict(provider_id) do update set timezone = excluded.timezone, slot_minutes = excluded.slot_minutes,
    weekly_hours = excluded.weekly_hours, blocked_dates = excluded.blocked_dates,
    is_published = excluded.is_published, updated_at = now() returning * into v_result;
  return v_result;
end; $$;

alter table public.bookings add column duration_minutes integer not null default 60 check (duration_minutes between 15 and 240),
  add column work_started_at timestamptz;

-- This private helper never exposes customer identities or booking records.
create function public.provider_day_slots(p_provider_id uuid, p_day date, p_exclude_id uuid default null)
returns table(starts_at timestamptz, duration_minutes integer)
language plpgsql security definer set search_path = '' as $$
declare v_schedule public.provider_availability; v_hours jsonb; v_start timestamp; v_end timestamp;
begin
  select * into v_schedule from public.provider_availability where provider_id = p_provider_id and is_published;
  if not found or p_day = any(v_schedule.blocked_dates) then return; end if;
  select d into v_hours from jsonb_array_elements(v_schedule.weekly_hours) d where (d->>'day')::integer = extract(dow from p_day);
  if v_hours is null then return; end if;
  v_start := p_day + (v_hours->>'start')::time;
  v_end := p_day + (v_hours->>'end')::time;
  return query select slots.local_start at time zone v_schedule.timezone, v_schedule.slot_minutes
  from generate_series(v_start, v_end - make_interval(mins => v_schedule.slot_minutes), make_interval(mins => v_schedule.slot_minutes)) slots(local_start)
  where slots.local_start at time zone v_schedule.timezone > now()
    -- Skip non-existent wall-clock times during a daylight-saving change.
    and ((slots.local_start at time zone v_schedule.timezone) at time zone v_schedule.timezone) = slots.local_start
    and not exists (
      select 1 from public.bookings b where b.provider_id = p_provider_id and b.status = 'confirmed'
      and b.id is distinct from p_exclude_id
      and b.scheduled_at < (slots.local_start at time zone v_schedule.timezone) + make_interval(mins => v_schedule.slot_minutes)
      and b.scheduled_at + make_interval(mins => b.duration_minutes) > slots.local_start at time zone v_schedule.timezone
    ) order by 1;
end; $$;

create function public.available_provider_slots(p_provider_id uuid, p_day date)
returns table(starts_at timestamptz, duration_minutes integer)
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_verified_session() or public.is_blocked_between(p_provider_id) then
    raise exception 'Sign in to view available appointments.';
  end if;
  if p_day is null or p_day < current_date - 1 or p_day > current_date + 90 then raise exception 'Choose a date within the next 90 days.'; end if;
  if p_provider_id <> auth.uid() and not exists(select 1 from public.services where provider_id = p_provider_id and is_active) then return; end if;
  return query select * from public.provider_day_slots(p_provider_id, p_day);
end; $$;

create function public.guard_booking_availability() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_schedule public.provider_availability; v_day date;
begin
  if tg_op = 'INSERT' then
    if new.work_started_at is not null then raise exception 'Work can only start on a confirmed booking.'; end if;
  elsif new.duration_minutes is distinct from old.duration_minutes then
    raise exception 'The booked appointment length cannot be changed.';
  elsif new.work_started_at is distinct from old.work_started_at then
    if old.work_started_at is not null or new.work_started_at is null or new.status <> 'confirmed'
      or auth.uid() is distinct from new.provider_id then raise exception 'Only the provider can start confirmed work.'; end if;
    new.work_started_at := now();
  end if;
  -- Existing group requests share an appointment; their confirmation rules stay in the group workflow.
  if new.group_booking_id is not null then return new; end if;
  if tg_op = 'UPDATE' then
    if new.scheduled_at is not distinct from old.scheduled_at and not(old.status <> 'confirmed' and new.status = 'confirmed') then return new; end if;
    if old.work_started_at is not null then raise exception 'Work has started; the appointment cannot be moved.'; end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.provider_id::text, 0));
  select * into v_schedule from public.provider_availability where provider_id = new.provider_id and is_published;
  if found then
    if tg_op = 'INSERT' then new.duration_minutes := v_schedule.slot_minutes; end if;
    v_day := (new.scheduled_at at time zone v_schedule.timezone)::date;
    if not exists(select 1 from public.provider_day_slots(new.provider_id, v_day, new.id) s where s.starts_at = new.scheduled_at
      and s.duration_minutes >= new.duration_minutes) then raise exception 'That appointment is unavailable. Choose another time.'; end if;
  elsif new.status = 'confirmed' and exists (
    select 1 from public.bookings b where b.provider_id = new.provider_id and b.status = 'confirmed' and b.id <> new.id
    and b.scheduled_at < new.scheduled_at + make_interval(mins => new.duration_minutes)
    and b.scheduled_at + make_interval(mins => b.duration_minutes) > new.scheduled_at
  ) then raise exception 'This appointment overlaps confirmed work.';
  end if;
  return new;
end; $$;
create trigger booking_availability_guard before insert or update on public.bookings for each row execute function public.guard_booking_availability();

create function public.start_booking_work(p_booking_id uuid) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare v_booking public.bookings;
begin
  if auth.uid() is null or not public.is_verified_session() then raise exception 'Sign in to update a booking.'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.provider_id <> auth.uid() or v_booking.status <> 'confirmed' then raise exception 'Only the provider can start a confirmed booking.'; end if;
  if v_booking.work_started_at is not null then return v_booking; end if;
  if exists(select 1 from public.booking_appointment_proposals where booking_id = p_booking_id and status = 'pending') then raise exception 'Resolve the suggested appointment time first.'; end if;
  update public.bookings set work_started_at = coalesce(work_started_at, now()), updated_at = now() where id = p_booking_id returning * into v_booking;
  insert into public.notifications(user_id, kind, title, body, target_path, booking_id)
  select v_booking.customer_id, 'booking_update', 'Your provider has started work', 'Open your booking to see the next step.', 'bookings', v_booking.id
  where exists(select 1 from public.profiles where id = v_booking.customer_id and notify_booking_updates);
  return v_booking;
end; $$;

create or replace view public.booking_directory with (security_invoker = false) as
select b.id, b.customer_id, b.provider_id, b.group_booking_id, b.scheduled_at,
  b.note, b.agreed_price, b.currency, b.status,
  customer.full_name as customer_name, provider.full_name as provider_name,
  s.title as service_title, s.category, b.listed_price, b.price_negotiation_id, b.location,
  b.price_agreement_id, b.scope_snapshot, b.provider_confirmed_by, b.provider_confirmed_at,
  b.provider_declined_by, b.provider_declined_at,
  proposal.id as pending_appointment_proposal_id, proposal.proposed_at as pending_appointment_at,
  b.service_id, b.duration_minutes, b.work_started_at
from public.bookings b join public.profiles customer on customer.id = b.customer_id
join public.profiles provider on provider.id = b.provider_id join public.services s on s.id = b.service_id
left join lateral (select p.id, p.proposed_at from public.booking_appointment_proposals p where p.booking_id = b.id and p.status = 'pending' order by p.created_at desc limit 1) proposal on true
where public.is_verified_session() and (b.customer_id = auth.uid() or b.provider_id = auth.uid());

create table public.campus_requests (
  id uuid primary key default gen_random_uuid(), requester_id uuid not null references public.profiles(id) on delete cascade,
  campus text not null, title text not null check (char_length(title) between 5 and 100),
  category text not null check (char_length(category) between 2 and 50),
  description text not null check (char_length(description) between 20 and 2000),
  budget numeric(10,2) check (budget > 0 and budget <= 999999),
  delivery_method text not null check (delivery_method in ('online','in_person','both')),
  expires_at timestamptz not null, status text not null default 'open' check (status in ('open','closed','removed')),
  created_at timestamptz not null default now()
);
create index campus_requests_open_idx on public.campus_requests(campus, expires_at) where status = 'open';
create table public.campus_request_responses (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references public.campus_requests(id) on delete cascade,
  responder_id uuid not null references public.profiles(id) on delete cascade,
  message text not null check (char_length(message) between 10 and 1000),
  price numeric(10,2) check (price > 0 and price <= 999999),
  created_at timestamptz not null default now(), unique(request_id, responder_id)
);
alter table public.reports add column campus_request_id uuid references public.campus_requests(id) on delete set null;
create unique index request_report_once_idx on public.reports(reporter_id, campus_request_id) where campus_request_id is not null;
alter table public.campus_requests enable row level security;
alter table public.campus_request_responses enable row level security;
revoke all on public.campus_requests, public.campus_request_responses from public, anon, authenticated;
grant select on public.campus_requests, public.campus_request_responses to authenticated;
create policy "Students read campus requests" on public.campus_requests for select to authenticated using (
  public.is_verified_session() and (requester_id = auth.uid() or public.is_admin() or (
    status = 'open' and expires_at > now() and not public.is_blocked_between(requester_id)
    and campus = (select university from public.profiles where id = auth.uid())
  ))
);
create policy "Request participants read responses" on public.campus_request_responses for select to authenticated using (
  public.is_verified_session() and not public.is_blocked_between(responder_id)
  and exists(select 1 from public.campus_requests r where r.id = request_id and r.status <> 'removed'
    and not public.is_blocked_between(r.requester_id) and (r.requester_id = auth.uid() or responder_id = auth.uid()))
);
create view public.campus_request_directory with (security_invoker = false) as
select r.*, p.full_name as requester_name from public.campus_requests r join public.profiles p on p.id = r.requester_id
where public.is_verified_session() and (r.requester_id = auth.uid() or public.is_admin() or (
  r.status <> 'removed' and not public.is_blocked_between(r.requester_id)
  and exists(select 1 from public.campus_request_responses a where a.request_id = r.id and a.responder_id = auth.uid())
) or (
  r.status = 'open' and r.expires_at > now() and not public.is_blocked_between(r.requester_id)
  and r.campus = (select university from public.profiles where id = auth.uid())
));
create view public.campus_request_response_directory with (security_invoker = false) as
select a.*, p.full_name as responder_name from public.campus_request_responses a
join public.campus_requests r on r.id = a.request_id join public.profiles p on p.id = a.responder_id
where public.is_verified_session() and r.status <> 'removed' and not public.is_blocked_between(a.responder_id)
and not public.is_blocked_between(r.requester_id) and (r.requester_id = auth.uid() or a.responder_id = auth.uid());
grant select on public.campus_request_directory, public.campus_request_response_directory to authenticated;
revoke all on public.campus_request_directory, public.campus_request_response_directory from anon;

create function public.post_campus_request(p_title text, p_category text, p_description text, p_budget numeric, p_delivery text, p_deadline date)
returns public.campus_requests language plpgsql security definer set search_path = '' as $$
declare v_campus text; v_result public.campus_requests;
begin
  if auth.uid() is null or not public.is_verified_session() then raise exception 'Sign in to post a request.'; end if;
  select university into v_campus from public.profiles where id = auth.uid();
  if coalesce(btrim(v_campus),'') = '' then raise exception 'Add your campus to your profile first.'; end if;
  if p_deadline is null or p_deadline < current_date or p_deadline > current_date + 30 then raise exception 'Choose a deadline within the next 30 days.'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text, 1));
  if (select count(*) from public.campus_requests where requester_id = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'You can post up to five requests a day.'; end if;
  insert into public.campus_requests(requester_id, campus, title, category, description, budget, delivery_method, expires_at)
  values(auth.uid(), v_campus, btrim(p_title), p_category, btrim(p_description), p_budget, p_delivery, (p_deadline + 1)::timestamp at time zone 'Africa/Accra') returning * into v_result;
  return v_result;
end; $$;

create function public.respond_campus_request(p_request_id uuid, p_message text, p_price numeric)
returns public.campus_request_responses language plpgsql security definer set search_path = '' as $$
declare v_request public.campus_requests; v_response public.campus_request_responses;
begin
  if auth.uid() is null or not public.is_verified_session() then raise exception 'Sign in to reply.'; end if;
  select * into v_request from public.campus_requests where id = p_request_id for update;
  if not found or v_request.status <> 'open' or v_request.expires_at <= now() or v_request.requester_id = auth.uid()
    or public.is_blocked_between(v_request.requester_id)
    or v_request.campus <> (select university from public.profiles where id = auth.uid()) then raise exception 'This request is no longer available to reply to.'; end if;
  insert into public.campus_request_responses(request_id, responder_id, message, price)
  values(p_request_id, auth.uid(), btrim(p_message), p_price) returning * into v_response;
  insert into public.notifications(user_id, kind, title, body, target_path)
  values(v_request.requester_id, 'request_response', 'Someone offered to help', 'Open Campus requests to review the response to your task.', 'requests');
  return v_response;
end; $$;

create function public.close_campus_request(p_request_id uuid, p_remove boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_verified_session() then raise exception 'Sign in to update a request.'; end if;
  update public.campus_requests set status = case when p_remove then 'removed' else 'closed' end
  where id = p_request_id and ((requester_id = auth.uid() and not p_remove) or public.is_admin());
  if not found then raise exception 'You cannot change this request.'; end if;
end; $$;

create function public.report_campus_request(p_request_id uuid, p_details text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_request public.campus_requests;
begin
  if auth.uid() is null or not public.is_verified_session() then raise exception 'Sign in to report a request.'; end if;
  select * into v_request from public.campus_requests where id = p_request_id;
  if not found or v_request.requester_id = auth.uid() or v_request.status <> 'open' or v_request.expires_at <= now()
    or public.is_blocked_between(v_request.requester_id)
    or v_request.campus <> (select university from public.profiles where id = auth.uid()) then raise exception 'That request is unavailable.'; end if;
  if char_length(btrim(p_details)) not between 10 and 1000 then raise exception 'Add a short explanation (10 to 1000 characters).'; end if;
  insert into public.reports(reporter_id, reported_user_id, campus_request_id, reason, details)
  values(auth.uid(), v_request.requester_id, p_request_id, 'Campus request concern', v_request.title || ': ' || btrim(p_details));
end; $$;

create function public.start_request_conversation(p_request_id uuid, p_responder_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_conversation uuid;
begin
  if auth.uid() is null or not public.is_verified_session() then raise exception 'Sign in to message a student.'; end if;
  select requester_id into v_owner from public.campus_requests where id = p_request_id and status <> 'removed';
  if v_owner is distinct from auth.uid() or public.is_blocked_between(p_responder_id)
    or not exists(select 1 from public.campus_request_responses where request_id = p_request_id and responder_id = p_responder_id) then
    raise exception 'Only the requester can message a student who responded to this task.';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(least(v_owner::text,p_responder_id::text) || greatest(v_owner::text,p_responder_id::text), 2));
  select c.id into v_conversation from public.conversations c
    join public.conversation_members a on a.conversation_id = c.id and a.user_id = v_owner
    join public.conversation_members b on b.conversation_id = c.id and b.user_id = p_responder_id
    where c.booking_id is null order by c.created_at desc limit 1;
  if v_conversation is null then
    insert into public.conversations default values returning id into v_conversation;
    insert into public.conversation_members(conversation_id,user_id) values(v_conversation,v_owner),(v_conversation,p_responder_id);
  end if;
  return v_conversation;
end; $$;

-- Daily reminders are idempotent and use existing notification/push delivery.
alter table public.notifications add column reminder_key text;
create unique index notifications_reminder_key_idx on public.notifications(user_id, reminder_key) where reminder_key is not null;
create function public.generate_booking_reminders() returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  if coalesce(auth.role(),'') <> 'service_role' and not public.is_admin() then raise exception 'Only the scheduler can create reminders.'; end if;
  insert into public.notifications(user_id, kind, title, body, target_path, booking_id, reminder_key)
  select recipient.user_id, 'booking_reminder', case when b.status = 'pending' then 'A booking needs your reply' else 'Your appointment is coming up' end,
    case when b.status = 'pending' then 'A request is waiting. Open My bookings to accept, decline or suggest another time.' else 'Your confirmed appointment is within 24 hours. Open My bookings for the details.' end,
    'bookings', b.id, b.id::text || ':' || b.status::text || ':' || b.scheduled_at::text
  from public.bookings b cross join lateral (select b.provider_id as user_id union select b.customer_id where b.status = 'confirmed') recipient
  join public.profiles p on p.id = recipient.user_id and p.notify_booking_updates
  where (b.status = 'pending' and b.created_at < now() - interval '12 hours' and b.scheduled_at > now())
    or (b.status = 'confirmed' and b.work_started_at is null and b.scheduled_at > now() and b.scheduled_at <= now() + interval '24 hours')
  on conflict(user_id, reminder_key) where reminder_key is not null do nothing;
  get diagnostics v_count = row_count; return v_count;
end; $$;

revoke all on function public.provider_day_slots(uuid,date,uuid), public.guard_booking_availability() from public, anon, authenticated;
revoke all on function public.save_provider_availability(text,integer,jsonb,date[],boolean), public.available_provider_slots(uuid,date),
  public.start_booking_work(uuid), public.post_campus_request(text,text,text,numeric,text,date), public.respond_campus_request(uuid,text,numeric),
  public.close_campus_request(uuid,boolean), public.report_campus_request(uuid,text), public.generate_booking_reminders() from public, anon;
revoke all on function public.start_request_conversation(uuid,uuid) from public, anon;
grant execute on function public.start_request_conversation(uuid,uuid) to authenticated;
grant execute on function public.save_provider_availability(text,integer,jsonb,date[],boolean), public.available_provider_slots(uuid,date),
  public.start_booking_work(uuid), public.post_campus_request(text,text,text,numeric,text,date), public.respond_campus_request(uuid,text,numeric),
  public.close_campus_request(uuid,boolean), public.report_campus_request(uuid,text) to authenticated;
revoke all on function public.generate_booking_reminders() from authenticated;
grant execute on function public.generate_booking_reminders() to service_role;
notify pgrst, 'reload schema';
commit;
