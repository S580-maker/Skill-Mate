begin;

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

  if p_status = 'completed'
     and v_booking.customer_id = v_user_id
     and v_booking.status = 'completed'
     and v_booking.provider_completed_at is not null
     and v_booking.customer_completed_at is null
     and v_booking.payment_status in ('paid', 'legacy') then
    update public.bookings
    set customer_completed_at = now(), updated_at = now()
    where id = v_booking.id
    returning * into v_booking;
    return v_booking;
  end if;

  if p_status = 'completed'
     and v_booking.provider_id = v_user_id
     and v_booking.status = 'confirmed'
     and v_booking.payment_status in ('paid', 'legacy')
     and v_booking.provider_completed_at is null then
    if exists (
      select 1 from public.booking_appointment_proposals
      where booking_id = v_booking.id and status = 'pending'
    ) then
      raise exception 'Resolve the suggested appointment time first.';
    end if;
    update public.bookings set provider_completed_at = now()
    where id = v_booking.id returning * into v_booking;
    return v_booking;
  end if;

  if p_status = 'completed'
     and (
       v_booking.customer_id is distinct from v_user_id
       or v_booking.provider_completed_at is null
       or v_booking.payment_status not in ('paid', 'legacy')
     ) then
    raise exception 'Only the customer can verify completion after the provider marks the work complete.';
  end if;

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
    elsif v_booking.customer_id = v_user_id and v_booking.status = 'confirmed'
       and v_booking.payment_status in ('paid', 'legacy')
       and v_booking.provider_completed_at is not null and p_status = 'completed' then
      null;
    elsif v_booking.customer_id = v_user_id and v_booking.status = 'completed'
       and v_booking.payment_status in ('paid', 'legacy')
       and v_booking.provider_completed_at is not null
       and v_booking.customer_completed_at is null and p_status = 'completed' then
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

notify pgrst, 'reload schema';
commit;
