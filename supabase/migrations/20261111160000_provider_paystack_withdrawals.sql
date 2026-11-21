begin;

create table public.provider_payout_recipients (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete restrict,
  recipient_code text not null unique,
  recipient_type text not null check (recipient_type in ('nuban', 'mobile_money')),
  name text not null,
  bank_code text not null,
  bank_name text not null,
  account_last_four text not null,
  currency char(3) not null default 'GHS' check (currency = 'GHS'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index provider_payout_recipients_owner_idx
  on public.provider_payout_recipients(provider_id, created_at desc)
  where active;

create table public.provider_withdrawals (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete restrict,
  recipient_id uuid not null references public.provider_payout_recipients(id) on delete restrict,
  reference text not null unique,
  idempotency_key uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency char(3) not null default 'GHS' check (currency = 'GHS'),
  status text not null default 'processing'
    check (status in ('processing', 'success', 'failed', 'reversed')),
  transfer_code text,
  gateway_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider_id, idempotency_key)
);

create index provider_withdrawals_owner_idx
  on public.provider_withdrawals(provider_id, created_at desc);

alter table public.provider_payout_recipients enable row level security;
alter table public.provider_withdrawals enable row level security;
revoke all on public.provider_payout_recipients, public.provider_withdrawals
  from public, anon, authenticated;
grant select, insert, update, delete on public.provider_payout_recipients,
  public.provider_withdrawals to service_role;

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
      and withdrawal.status in ('processing', 'success')
  )
  select (earnings.amount - withdrawals.amount)::bigint,
    earnings.amount, withdrawals.amount
  from earnings cross join withdrawals;
$$;

create or replace function public.request_provider_withdrawal(
  p_provider_id uuid,
  p_recipient_id uuid,
  p_amount_minor bigint,
  p_idempotency_key uuid,
  p_reference text
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
       or v_existing.amount_minor <> p_amount_minor then
      raise exception 'This payout request key was already used for a different request.';
    end if;
    return v_existing;
  end if;

  if not exists (
    select 1 from public.provider_payout_recipients
    where id = p_recipient_id and provider_id = p_provider_id and active
  ) then
    raise exception 'Choose an active payout destination on your account.';
  end if;

  select balance.available_minor into v_available
  from public.get_provider_payout_balance(p_provider_id) balance;
  if p_amount_minor > v_available then
    raise exception 'The withdrawal amount exceeds your available earnings.';
  end if;

  insert into public.provider_withdrawals (
    provider_id, recipient_id, reference, idempotency_key, amount_minor
  ) values (
    p_provider_id, p_recipient_id, p_reference, p_idempotency_key, p_amount_minor
  ) returning * into v_withdrawal;
  return v_withdrawal;
end;
$$;

create or replace function public.record_provider_withdrawal_result(
  p_reference text,
  p_status text,
  p_amount_minor bigint,
  p_transfer_code text default null,
  p_gateway_message text default null
)
returns public.provider_withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_withdrawal public.provider_withdrawals;
begin
  if p_status not in ('processing', 'success', 'failed', 'reversed') then
    raise exception 'Invalid withdrawal status.';
  end if;

  select * into v_withdrawal
  from public.provider_withdrawals
  where reference = p_reference
  for update;
  if not found then raise exception 'Withdrawal not found.'; end if;
  if p_amount_minor is null or p_amount_minor <> v_withdrawal.amount_minor then
    raise exception 'Paystack transfer amount does not match the reserved withdrawal.';
  end if;

  if (v_withdrawal.status = 'success' and p_status not in ('success', 'reversed'))
     or (v_withdrawal.status in ('failed', 'reversed') and v_withdrawal.status <> p_status) then
    raise exception 'A completed withdrawal cannot change to a different result.';
  end if;

  update public.provider_withdrawals
  set status = p_status,
      transfer_code = coalesce(p_transfer_code, transfer_code),
      gateway_message = left(p_gateway_message, 500),
      updated_at = now()
  where id = v_withdrawal.id
  returning * into v_withdrawal;
  return v_withdrawal;
end;
$$;

revoke all on function public.get_provider_payout_balance(uuid) from public, anon, authenticated;
revoke all on function public.request_provider_withdrawal(uuid, uuid, bigint, uuid, text)
  from public, anon, authenticated;
revoke all on function public.record_provider_withdrawal_result(text, text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.get_provider_payout_balance(uuid) to service_role;
grant execute on function public.request_provider_withdrawal(uuid, uuid, bigint, uuid, text)
  to service_role;
grant execute on function public.record_provider_withdrawal_result(text, text, bigint, text, text)
  to service_role;

commit;
