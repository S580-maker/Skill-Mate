begin;

create or replace function public.accept_booking_request(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  if auth.uid() is null then
    raise exception 'Sign in to accept a booking.';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  if v_booking.provider_id is distinct from auth.uid() then
    raise exception 'Only the assigned provider can accept this booking.';
  end if;
  if v_booking.status <> 'pending' then
    raise exception 'This booking request is no longer awaiting a response.';
  end if;
  if v_booking.provider_accepted_at is not null
     and v_booking.payment_status in ('awaiting_payment', 'processing', 'failed') then
    return v_booking;
  end if;
  if v_booking.provider_accepted_at is not null
     or v_booking.payment_status not in ('not_due', 'awaiting_payment', 'failed') then
    raise exception 'This booking cannot be accepted in its current payment state.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_booking.provider_id::text, 0)
  );
  if exists (
    select 1
    from public.bookings other
    where other.provider_id = v_booking.provider_id
      and other.id <> v_booking.id
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
    select 1
    from public.provider_availability schedule
    where schedule.provider_id = v_booking.provider_id and schedule.is_published
  ) and not exists (
    select 1
    from public.provider_day_slots(
      v_booking.provider_id,
      (v_booking.scheduled_at at time zone (
        select schedule.timezone
        from public.provider_availability schedule
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
  set provider_accepted_at = now(),
      payment_status = 'awaiting_payment',
      updated_at = now()
  where id = v_booking.id
  returning * into v_booking;

  insert into public.notifications (user_id, kind, title, body, target_path, booking_id)
  select v_booking.customer_id, 'booking_update', 'Your booking was accepted',
    'Your provider accepted the request. Complete payment to confirm the booking.',
    'bookings', v_booking.id
  where exists (
    select 1
    from public.profiles
    where id = v_booking.customer_id and notify_booking_updates
  );

  return v_booking;
end;
$$;

revoke all on function public.accept_booking_request(uuid) from public, anon;
grant execute on function public.accept_booking_request(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
