begin;

alter table public.provider_payout_recipients
  add column payout_mode text not null default 'live'
    check (payout_mode in ('test', 'live'));

alter table public.provider_withdrawals
  add column test_mode boolean not null default false;

drop function public.request_provider_withdrawal(uuid, uuid, bigint, uuid, text);

create or replace function public.get_provider_payout_balance(p_provider_id uuid)
returns table(available_minor bigint, earned_minor bigint, reserved_minor bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with earnings as (
    select coalesce(sum(payment.service_amount_minor), 0)::bigint as amount
    from public.paystack_payment_attempts payment
    where payment.provider_id = p_provider_id
      and payment.status = 'paid'
      and payment.provider_earnings_status = 'eligible_for_payout'
  ),
  withdrawals as (
    select coalesce(sum(withdrawal.amount_minor), 0)::bigint as amount
    from public.provider_withdrawals withdrawal
    where withdrawal.provider_id = p_provider_id
      and not withdrawal.test_mode
      and withdrawal.status in ('processing', 'success')
  )
  select (earnings.amount - withdrawals.amount)::bigint,
    earnings.amount, withdrawals.amount
  from earnings cross join withdrawals;
$$;

create function public.request_provider_withdrawal(
  p_provider_id uuid,
  p_recipient_id uuid,
  p_amount_minor bigint,
  p_idempotency_key uuid,
  p_reference text,
  p_test_mode boolean default false
)
returns public.provider_withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.provider_withdrawals;
  v_withdrawal public.provider_withdrawals;
  v_available bigint;
  v_payout_mode text := case when p_test_mode then 'test' else 'live' end;
begin
  if p_provider_id is null or p_recipient_id is null or p_amount_minor is null
     or p_amount_minor <= 0 or p_idempotency_key is null or p_reference is null
     or p_reference !~ '^SKM_WD_[0-9a-f-]{36}$' then
    raise exception 'Provide a valid payout request.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_provider_id::text, 0)
  );

  select * into v_existing
  from public.provider_withdrawals
  where provider_id = p_provider_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.recipient_id <> p_recipient_id
       or v_existing.amount_minor <> p_amount_minor
       or v_existing.test_mode <> p_test_mode then
      raise exception 'This payout request key was already used for a different request.';
    end if;
    return v_existing;
  end if;

  if not exists (
    select 1 from public.provider_payout_recipients
    where id = p_recipient_id and provider_id = p_provider_id
      and payout_mode = v_payout_mode and active
  ) then
    raise exception 'Choose an active payout destination for this transfer mode.';
  end if;

  select balance.available_minor into v_available
  from public.get_provider_payout_balance(p_provider_id) balance;
  if p_amount_minor > v_available then
    raise exception 'The withdrawal amount exceeds your available earnings.';
  end if;

  insert into public.provider_withdrawals (
    provider_id, recipient_id, reference, idempotency_key, amount_minor, test_mode
  ) values (
    p_provider_id, p_recipient_id, p_reference, p_idempotency_key, p_amount_minor, p_test_mode
  ) returning * into v_withdrawal;
  return v_withdrawal;
end;
$$;

revoke all on function public.get_provider_payout_balance(uuid) from public, anon, authenticated;
revoke all on function public.request_provider_withdrawal(uuid, uuid, bigint, uuid, text, boolean)
  from public, anon, authenticated;
grant execute on function public.get_provider_payout_balance(uuid) to service_role;
grant execute on function public.request_provider_withdrawal(uuid, uuid, bigint, uuid, text, boolean)
  to service_role;

commit;
