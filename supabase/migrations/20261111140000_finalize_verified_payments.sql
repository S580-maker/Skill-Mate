begin;

create or replace function public.finalize_verified_paystack_payment(p_reference text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.paystack_payment_attempts;
  v_booking public.bookings;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the payment verifier can finalize a transaction.';
  end if;

  select * into v_payment
  from public.paystack_payment_attempts
  where reference = p_reference
  for update;
  if not found then
    return 'unknown';
  end if;
  if v_payment.status = 'paid' then
    return 'paid';
  end if;
  if v_payment.status <> 'pending' or v_payment.gateway_verified_at is null then
    return v_payment.status;
  end if;

  select * into v_booking
  from public.bookings
  where id = v_payment.booking_id
  for update;
  if v_booking.status <> 'pending'
     or v_booking.provider_accepted_at is null
     or v_booking.payment_status not in ('processing', 'awaiting_payment', 'failed')
     or exists (
       select 1
       from public.paystack_payment_attempts other
       where other.booking_id = v_payment.booking_id
         and other.id <> v_payment.id
         and other.status in ('pending', 'paid', 'partially_refunded')
     ) then
    update public.paystack_payment_attempts
    set status = 'review', updated_at = now()
    where id = v_payment.id;
    update public.bookings
    set payment_status = 'action_required', updated_at = now()
    where id = v_payment.booking_id;
    return 'review';
  end if;

  update public.paystack_payment_attempts
  set status = 'paid',
      provider_earnings_status = 'pending',
      paid_at = coalesce(paid_at, now()),
      updated_at = now()
  where id = v_payment.id;
  update public.bookings
  set status = 'confirmed', payment_status = 'paid', updated_at = now()
  where id = v_booking.id;
  return 'paid';
end;
$$;

revoke all on function public.finalize_verified_paystack_payment(text) from public, anon, authenticated;
grant execute on function public.finalize_verified_paystack_payment(text) to service_role;

notify pgrst, 'reload schema';
commit;
