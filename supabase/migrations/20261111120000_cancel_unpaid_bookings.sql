begin;

create or replace function public.cancel_unpaid_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
begin
  if auth.uid() is null then
    raise exception 'Sign in to cancel this booking.';
  end if;

  select * into v_booking
  from public.bookings
  where id = p_booking_id
  for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  if v_booking.provider_id <> auth.uid()
     or v_booking.status <> 'pending'
     or v_booking.provider_accepted_at is null then
    raise exception 'Only an unpaid booking accepted by you can be cancelled this way.';
  end if;
  if exists (
    select 1
    from public.paystack_payment_attempts
    where booking_id = v_booking.id and status = 'pending'
  ) then
    raise exception 'A payment attempt is still pending. Confirm its status before cancelling this booking.';
  end if;
  if v_booking.payment_status not in ('awaiting_payment', 'failed') then
    raise exception 'Only an unpaid booking accepted by you can be cancelled this way.';
  end if;

  update public.bookings
  set status = 'cancelled', updated_at = now()
  where id = v_booking.id
  returning * into v_booking;
  return v_booking;
end;
$$;

revoke all on function public.cancel_unpaid_booking(uuid) from public, anon;
grant execute on function public.cancel_unpaid_booking(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
