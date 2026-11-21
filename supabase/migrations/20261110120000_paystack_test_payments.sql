begin;

alter table public.bookings
  add column provider_accepted_at timestamptz,
  add column customer_completed_at timestamptz,
  add column payment_status text not null default 'not_due'
    check (payment_status in (
      'not_due', 'awaiting_payment', 'processing', 'paid', 'failed',
      'action_required', 'partially_refunded', 'refunded', 'legacy'
    ));

update public.bookings
set provider_accepted_at = coalesce(provider_accepted_at, updated_at, created_at),
    payment_status = 'legacy'
where status in ('confirmed', 'completed');

create table public.paystack_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  reference text not null unique,
  transaction_id bigint unique,
  service_amount_minor bigint not null check (service_amount_minor > 0),
  booking_fee_minor bigint not null check (booking_fee_minor >= 0),
  total_amount_minor bigint not null check (total_amount_minor = service_amount_minor + booking_fee_minor),
  refunded_amount_minor bigint not null default 0 check (refunded_amount_minor >= 0),
  currency char(3) not null check (currency = 'GHS'),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'review', 'partially_refunded', 'refunded')),
  provider_earnings_status text not null default 'not_earned'
    check (provider_earnings_status in ('not_earned', 'pending', 'eligible_for_payout', 'reversed')),
  gateway_verified_at timestamptz,
  webhook_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz
);

create unique index paystack_one_pending_attempt_per_booking_idx
  on public.paystack_payment_attempts(booking_id) where status = 'pending';
create index paystack_payment_attempts_booking_idx
  on public.paystack_payment_attempts(booking_id, created_at desc);

create table public.paystack_webhook_events (
  event_key text primary key,
  reference text not null,
  event_type text not null,
  received_at timestamptz not null default now()
);

alter table public.paystack_payment_attempts enable row level security;
alter table public.paystack_webhook_events enable row level security;
revoke all on public.paystack_payment_attempts, public.paystack_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on public.paystack_payment_attempts, public.paystack_webhook_events to service_role;

create or replace function public.provider_day_slots(
  p_provider_id uuid, p_day date, p_exclude_id uuid default null
)
returns table(starts_at timestamptz, duration_minutes integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule public.provider_availability;
  v_hours jsonb;
  v_start timestamp;
  v_end timestamp;
begin
  select * into v_schedule
  from public.provider_availability
  where provider_id = p_provider_id and is_published;
  if not found then return; end if;
  if p_day = any(v_schedule.blocked_dates) then return; end if;
  select entry into v_hours
  from jsonb_array_elements(v_schedule.weekly_hours) entry
  where (entry->>'day')::integer = extract(dow from p_day)::integer;
  if v_hours is null then return; end if;
  v_start := p_day + (v_hours->>'start')::time;
  v_end := p_day + (v_hours->>'end')::time;
  return query
  select slots.local_start at time zone v_schedule.timezone, v_schedule.slot_minutes
  from generate_series(
    v_start, v_end - make_interval(mins => v_schedule.slot_minutes),
    make_interval(mins => v_schedule.slot_minutes)
  ) slots(local_start)
  where slots.local_start at time zone v_schedule.timezone > now()
    and ((slots.local_start at time zone v_schedule.timezone) at time zone v_schedule.timezone) = slots.local_start
    and not exists (
      select 1 from public.bookings b
      where b.provider_id = p_provider_id
        and (b.status = 'confirmed'
          or (b.status = 'pending' and b.provider_accepted_at is not null))
        and b.id is distinct from p_exclude_id
        and b.scheduled_at < (slots.local_start at time zone v_schedule.timezone)
          + make_interval(mins => v_schedule.slot_minutes)
        and b.scheduled_at + make_interval(mins => b.duration_minutes)
          > slots.local_start at time zone v_schedule.timezone
    )
  order by 1;
end;
$$;

create or replace function public.guard_booking_availability() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_schedule public.provider_availability;
  v_day date;
begin
  if tg_op = 'INSERT' then
    if new.work_started_at is not null then
      raise exception 'Work can only start on a confirmed booking.';
    end if;
  elsif new.duration_minutes is distinct from old.duration_minutes then
    raise exception 'The booked appointment length cannot be changed.';
  elsif new.work_started_at is distinct from old.work_started_at then
    if old.work_started_at is not null or new.work_started_at is null
       or new.status <> 'confirmed' or auth.uid() is distinct from new.provider_id then
      raise exception 'Only the provider can start confirmed work.';
    end if;
    new.work_started_at := now();
  end if;
  if new.group_booking_id is not null then return new; end if;
  if tg_op = 'UPDATE' then
    if new.scheduled_at is not distinct from old.scheduled_at
       and not (old.status <> 'confirmed' and new.status = 'confirmed') then
      return new;
    end if;
    if old.work_started_at is not null then
      raise exception 'Work has started; the appointment cannot be moved.';
    end if;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.provider_id::text, 0));
  select * into v_schedule
  from public.provider_availability
  where provider_id = new.provider_id and is_published;
  if found then
    if tg_op = 'INSERT' then new.duration_minutes := v_schedule.slot_minutes; end if;
    v_day := (new.scheduled_at at time zone v_schedule.timezone)::date;
    if not exists (
      select 1 from public.provider_day_slots(new.provider_id, v_day, new.id) slot
      where slot.starts_at = new.scheduled_at and slot.duration_minutes >= new.duration_minutes
    ) then
      raise exception 'That appointment is unavailable. Choose another time.';
    end if;
  elsif (new.status = 'confirmed'
      or (new.status = 'pending' and new.provider_accepted_at is not null))
     and exists (
       select 1 from public.bookings b
       where b.provider_id = new.provider_id and b.id <> new.id
         and (b.status = 'confirmed'
           or (b.status = 'pending' and b.provider_accepted_at is not null))
         and b.scheduled_at < new.scheduled_at + make_interval(mins => new.duration_minutes)
         and b.scheduled_at + make_interval(mins => b.duration_minutes) > new.scheduled_at
     ) then
    raise exception 'This appointment overlaps confirmed or accepted work.';
  end if;
  return new;
end;
$$;

create or replace function public.create_paystack_payment_attempt(
  p_booking_id uuid,
  p_customer_id uuid,
  p_reference text,
  p_fee_basis_points integer
)
returns public.paystack_payment_attempts
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_payment public.paystack_payment_attempts;
  v_service_amount bigint;
  v_booking_fee bigint;
begin
  if p_reference !~ '^SKM_[0-9a-f-]{36}$' or p_fee_basis_points < 0 or p_fee_basis_points > 2000 then
    raise exception 'Payment setup is invalid.';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found or v_booking.customer_id <> p_customer_id then
    raise exception 'Booking not found.';
  end if;
  if v_booking.currency <> 'GHS' then
    raise exception 'Paystack checkout is currently available for GHS bookings only.';
  end if;
  if v_booking.status <> 'pending' or v_booking.provider_accepted_at is null
     or v_booking.payment_status not in ('awaiting_payment', 'processing', 'failed') then
    raise exception 'This booking is not ready for payment.';
  end if;

  select * into v_payment
  from public.paystack_payment_attempts
  where booking_id = p_booking_id and status = 'pending'
  order by created_at desc
  limit 1
  for update;
  if found then
    return v_payment;
  end if;

  v_service_amount := round(v_booking.agreed_price * 100)::bigint;
  v_booking_fee := round(v_service_amount * p_fee_basis_points / 10000.0)::bigint;
  insert into public.paystack_payment_attempts (
    booking_id, customer_id, provider_id, reference,
    service_amount_minor, booking_fee_minor, total_amount_minor, currency
  ) values (
    p_booking_id, p_customer_id, v_booking.provider_id, p_reference,
    v_service_amount, v_booking_fee, v_service_amount + v_booking_fee, v_booking.currency
  )
  returning * into v_payment;
  update public.bookings
  set payment_status = 'processing', updated_at = now()
  where id = p_booking_id;
  return v_payment;
end;
$$;

create or replace function public.apply_paystack_payment_event(
  p_reference text,
  p_event_status text,
  p_transaction_id bigint,
  p_amount_minor bigint,
  p_currency text,
  p_event_key text,
  p_source text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.paystack_payment_attempts;
  v_booking public.bookings;
  v_event_inserted integer;
begin
  if p_source not in ('verification', 'webhook') then
    raise exception 'Payment event source is invalid.';
  end if;
  select * into v_payment
  from public.paystack_payment_attempts
  where reference = p_reference
  for update;
  if not found then
    return 'unknown';
  end if;

  if p_event_key is not null then
    insert into public.paystack_webhook_events(event_key, reference, event_type)
    values (p_event_key, p_reference, p_event_status)
    on conflict do nothing;
    get diagnostics v_event_inserted = row_count;
    if v_event_inserted = 0 then
      return v_payment.status;
    end if;
  end if;

  if p_event_status = 'success' then
    if v_payment.status in ('refunded', 'partially_refunded') then
      return v_payment.status;
    end if;
    if v_payment.status = 'paid' then
      return 'paid';
    end if;
    if p_amount_minor is distinct from v_payment.total_amount_minor
       or upper(coalesce(p_currency, '')) <> v_payment.currency then
      update public.paystack_payment_attempts
      set status = 'review', updated_at = now()
      where id = v_payment.id;
      update public.bookings set payment_status = 'action_required', updated_at = now()
      where id = v_payment.booking_id;
      return 'review';
    end if;
    if p_transaction_id is null or p_transaction_id <= 0
       or exists (
         select 1 from public.paystack_payment_attempts other
         where other.transaction_id = p_transaction_id and other.id <> v_payment.id
       ) then
      update public.paystack_payment_attempts
      set status = 'review', updated_at = now()
      where id = v_payment.id;
      update public.bookings set payment_status = 'action_required', updated_at = now()
      where id = v_payment.booking_id;
      return 'review';
    end if;
    update public.paystack_payment_attempts
    set gateway_verified_at = case when p_source in ('verification', 'webhook')
          then coalesce(gateway_verified_at, now()) else gateway_verified_at end,
        webhook_verified_at = case when p_source = 'webhook'
          then coalesce(webhook_verified_at, now()) else webhook_verified_at end,
        transaction_id = coalesce(p_transaction_id, transaction_id),
        updated_at = now()
    where id = v_payment.id
    returning * into v_payment;
    if v_payment.gateway_verified_at is null or v_payment.webhook_verified_at is null then
      return 'processing';
    end if;
    select * into v_booking from public.bookings where id = v_payment.booking_id for update;
    if v_booking.status <> 'pending' or v_booking.provider_accepted_at is null
       or v_booking.payment_status not in ('processing', 'awaiting_payment', 'failed')
       or exists (
         select 1 from public.paystack_payment_attempts other
         where other.booking_id = v_payment.booking_id
           and other.id <> v_payment.id and other.status in ('pending', 'paid', 'partially_refunded')
       ) then
      update public.paystack_payment_attempts
      set status = 'review', updated_at = now()
      where id = v_payment.id;
      update public.bookings set payment_status = 'action_required', updated_at = now()
      where id = v_payment.booking_id;
      return 'review';
    end if;
    update public.paystack_payment_attempts
    set status = 'paid', provider_earnings_status = 'pending',
        paid_at = coalesce(paid_at, now()), updated_at = now()
    where id = v_payment.id;
    update public.bookings
    set status = 'confirmed', payment_status = 'paid', updated_at = now()
    where id = v_payment.booking_id;
    return 'paid';
  elsif p_event_status = 'failed' then
    if v_payment.status <> 'pending' then
      return v_payment.status;
    end if;
    update public.paystack_payment_attempts
    set status = 'failed', transaction_id = coalesce(p_transaction_id, transaction_id), updated_at = now()
    where id = v_payment.id;
    update public.bookings
    set payment_status = case
      when exists (
        select 1 from public.paystack_payment_attempts other
        where other.booking_id = v_payment.booking_id and other.id <> v_payment.id and other.status = 'pending'
      ) then 'processing'
      else 'failed'
    end, updated_at = now()
    where id = v_payment.booking_id and status = 'pending';
    return 'failed';
  elsif p_event_status = 'pending' then
    return v_payment.status;
  elsif p_event_status = 'refunded' then
    if p_source <> 'webhook'
       or v_payment.status not in ('paid', 'partially_refunded')
       or p_transaction_id is distinct from v_payment.transaction_id
       or upper(coalesce(p_currency, '')) <> v_payment.currency
       or p_amount_minor is null or p_amount_minor <= 0 then
      return v_payment.status;
    end if;
    if v_payment.refunded_amount_minor + p_amount_minor > v_payment.total_amount_minor then
      update public.paystack_payment_attempts set status = 'review', updated_at = now()
      where id = v_payment.id;
      update public.bookings set payment_status = 'action_required', updated_at = now()
      where id = v_payment.booking_id;
      return 'review';
    end if;
    update public.paystack_payment_attempts
    set refunded_amount_minor = refunded_amount_minor + p_amount_minor,
        status = case when refunded_amount_minor + p_amount_minor >= total_amount_minor
          then 'refunded' else 'partially_refunded' end,
        provider_earnings_status = 'reversed', updated_at = now()
    where id = v_payment.id
    returning * into v_payment;
    update public.bookings
    set payment_status = v_payment.status, updated_at = now()
    where id = v_payment.booking_id;
    return v_payment.status;
  end if;

  raise exception 'Unsupported Paystack payment event.';
end;
$$;

create or replace function public.start_booking_work(p_booking_id uuid) returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  if auth.uid() is null or not public.is_verified_session() then
    raise exception 'Sign in to update a booking.';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.provider_id <> auth.uid() or v_booking.status <> 'confirmed'
     or v_booking.payment_status not in ('paid', 'legacy')
     or v_booking.provider_completed_at is not null then
    raise exception 'Only the provider can start a paid, confirmed booking.';
  end if;
  if v_booking.work_started_at is not null then return v_booking; end if;
  if exists (
    select 1 from public.booking_appointment_proposals
    where booking_id = p_booking_id and status = 'pending'
  ) then
    raise exception 'Resolve the suggested appointment time first.';
  end if;
  update public.bookings
  set work_started_at = coalesce(work_started_at, now()), updated_at = now()
  where id = p_booking_id returning * into v_booking;
  insert into public.notifications(user_id, kind, title, body, target_path, booking_id)
  select v_booking.customer_id, 'booking_update', 'Your provider has started work',
    'Open your booking to see the next step.', 'bookings', v_booking.id
  where exists (
    select 1 from public.profiles
    where id = v_booking.customer_id and notify_booking_updates
  );
  return v_booking;
end;
$$;

create or replace function public.mark_booking_earnings_eligible()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and new.customer_completed_at is not null then
    update public.paystack_payment_attempts
    set provider_earnings_status = 'eligible_for_payout', updated_at = now()
    where booking_id = new.id and status = 'paid' and provider_earnings_status = 'pending';
  end if;
  return new;
end;
$$;

drop trigger if exists booking_earnings_eligible on public.bookings;
create trigger booking_earnings_eligible
after update of status, customer_completed_at on public.bookings
for each row execute function public.mark_booking_earnings_eligible();

create or replace function public.update_booking_status(p_booking_id uuid, p_status public.booking_status)
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
  if v_user_id is null then raise exception 'Sign in to update a booking.'; end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.'; end if;

  if not public.is_admin() then
    if v_booking.provider_id = v_user_id and v_booking.status = 'pending'
       and p_status = 'confirmed' and v_booking.provider_accepted_at is null then
      perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_booking.provider_id::text, 0));
      if exists (
        select 1 from public.bookings other
        where other.provider_id = v_booking.provider_id and other.id <> v_booking.id
          and (
            other.status = 'confirmed'
            or (other.status = 'pending' and other.provider_accepted_at is not null)
          )
          and other.scheduled_at < v_booking.scheduled_at + make_interval(mins => v_booking.duration_minutes)
          and other.scheduled_at + make_interval(mins => other.duration_minutes) > v_booking.scheduled_at
      ) then
        raise exception 'That appointment is already reserved by another booking.';
      end if;
      if exists (
        select 1 from public.provider_availability schedule
        where schedule.provider_id = v_booking.provider_id and schedule.is_published
      ) and not exists (
        select 1 from public.provider_day_slots(
          v_booking.provider_id,
          (v_booking.scheduled_at at time zone (
            select schedule.timezone from public.provider_availability schedule
            where schedule.provider_id = v_booking.provider_id and schedule.is_published
          ))::date,
          v_booking.id
        ) slot
        where slot.starts_at = v_booking.scheduled_at
          and slot.duration_minutes >= v_booking.duration_minutes
      ) then
        raise exception 'That appointment is no longer available.';
      end if;
      update public.bookings
      set provider_accepted_at = now(), payment_status = 'awaiting_payment', updated_at = now()
      where id = v_booking.id
      returning * into v_booking;
      insert into public.notifications (user_id, kind, title, body, target_path, booking_id)
      select v_booking.customer_id, 'booking_update', 'Your booking was accepted',
        'Your provider accepted the request. Complete payment to confirm the booking.',
        'bookings', v_booking.id
      where exists (
        select 1 from public.profiles
        where id = v_booking.customer_id and notify_booking_updates
      );
      return v_booking;
    elsif v_booking.provider_id = v_user_id and v_booking.status = 'pending'
       and p_status = 'confirmed' and v_booking.provider_accepted_at is not null then
      return v_booking;
    elsif v_booking.provider_id = v_user_id and v_booking.status = 'pending'
       and v_booking.provider_accepted_at is null and p_status = 'declined' then
      null;
    elsif v_booking.provider_id = v_user_id and v_booking.status = 'confirmed'
       and v_booking.payment_status in ('paid', 'legacy')
       and v_booking.provider_completed_at is null and p_status = 'completed'
       and not exists (
         select 1 from public.booking_appointment_proposals
         where booking_id = v_booking.id and status = 'pending'
       ) then
      update public.bookings set provider_completed_at = now()
      where id = v_booking.id returning * into v_booking;
      return v_booking;
    elsif v_booking.customer_id = v_user_id and v_booking.status = 'confirmed'
       and v_booking.payment_status in ('paid', 'legacy')
       and v_booking.provider_completed_at is not null and p_status = 'completed' then
      null;
    elsif v_booking.customer_id = v_user_id and v_booking.status in ('pending', 'confirmed')
       and v_booking.provider_accepted_at is null
       and v_booking.payment_status in ('not_due', 'legacy')
       and v_booking.provider_completed_at is null and v_booking.group_booking_id is null
       and p_status = 'cancelled' then
      null;
    else
      raise exception 'You cannot make that booking status change.';
    end if;
  elsif p_status = 'confirmed'
     and v_booking.payment_status not in ('paid', 'legacy') then
    raise exception 'A booking cannot be confirmed before payment.';
  end if;

  update public.bookings
  set status = p_status,
      customer_completed_at = case
        when p_status = 'completed' and v_booking.customer_id = v_user_id
          then coalesce(v_booking.customer_completed_at, now())
        else v_booking.customer_completed_at
      end,
      updated_at = now()
  where id = p_booking_id returning * into v_booking;
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

create or replace view public.booking_directory with (security_invoker = false) as
select b.id, b.customer_id, b.provider_id, b.group_booking_id, b.scheduled_at,
  b.note, b.agreed_price, b.currency, b.status,
  customer.full_name as customer_name, provider.full_name as provider_name,
  s.title as service_title, s.category, b.listed_price, b.price_negotiation_id, b.location,
  b.price_agreement_id, b.scope_snapshot, b.provider_confirmed_by, b.provider_confirmed_at,
  b.provider_declined_by, b.provider_declined_at,
  proposal.id as pending_appointment_proposal_id, proposal.proposed_at as pending_appointment_at,
  b.service_id, b.duration_minutes, b.work_started_at, b.provider_completed_at,
  b.provider_accepted_at, b.customer_completed_at, b.payment_status,
  payment.status as latest_payment_status,
  payment.reference as latest_payment_reference,
  payment.provider_earnings_status,
  payment.service_amount_minor as payment_service_amount_minor,
  payment.booking_fee_minor as payment_booking_fee_minor,
  payment.total_amount_minor as payment_total_amount_minor
from public.bookings b
join public.profiles customer on customer.id = b.customer_id
join public.profiles provider on provider.id = b.provider_id
join public.services s on s.id = b.service_id
left join lateral (
  select p.id, p.proposed_at
  from public.booking_appointment_proposals p
  where p.booking_id = b.id and p.status = 'pending'
  order by p.created_at desc
  limit 1
) proposal on true
left join lateral (
  select p.reference, p.provider_earnings_status, p.status,
    p.service_amount_minor, p.booking_fee_minor, p.total_amount_minor
  from public.paystack_payment_attempts p
  where p.booking_id = b.id
  order by p.created_at desc
  limit 1
) payment on true
where public.is_verified_session()
  and (b.customer_id = auth.uid() or b.provider_id = auth.uid());

revoke all on function public.create_paystack_payment_attempt(uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.apply_paystack_payment_event(text, text, bigint, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.create_paystack_payment_attempt(uuid, uuid, text, integer) to service_role;
grant execute on function public.apply_paystack_payment_event(text, text, bigint, bigint, text, text, text) to service_role;

commit;
