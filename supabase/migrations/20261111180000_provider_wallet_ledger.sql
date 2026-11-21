begin;

alter table public.provider_withdrawals
  drop constraint provider_withdrawals_status_check;

update public.provider_withdrawals
set status = 'successful'
where status = 'success';

alter table public.provider_withdrawals
  alter column status set default 'pending',
  add constraint provider_withdrawals_status_check
    check (status in ('pending', 'processing', 'successful', 'failed', 'reversed'));

create table public.provider_wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.profiles(id) on delete restrict,
  payment_attempt_id uuid references public.paystack_payment_attempts(id) on delete restrict,
  withdrawal_id uuid references public.provider_withdrawals(id) on delete restrict,
  entry_type text not null check (entry_type in (
    'payment_deposit', 'pending_earning', 'pending_earning_settled',
    'pending_earning_reversed', 'earning_credit', 'earning_reversal',
    'withdrawal_reserved', 'withdrawal_release', 'withdrawal_reversal',
    'balance_adjustment'
  )),
  reference text not null unique,
  amount_minor bigint not null check (amount_minor <> 0),
  currency char(3) not null default 'GHS' check (currency = 'GHS'),
  test_mode boolean not null default false,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index provider_wallet_ledger_owner_idx
  on public.provider_wallet_ledger(provider_id, created_at desc);
create index provider_wallet_ledger_payment_idx
  on public.provider_wallet_ledger(payment_attempt_id)
  where payment_attempt_id is not null;
create index provider_wallet_ledger_withdrawal_idx
  on public.provider_wallet_ledger(withdrawal_id)
  where withdrawal_id is not null;

create table public.provider_withdrawal_events (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references public.provider_withdrawals(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  reference text not null,
  status text not null check (status in ('pending', 'processing', 'successful', 'failed', 'reversed')),
  source text not null check (source in (
    'application', 'paystack', 'webhook', 'reconciliation', 'support', 'migration_backfill'
  )),
  details text,
  created_at timestamptz not null default now(),
  unique(withdrawal_id, status)
);

create table public.provider_payout_reconciliation_events (
  id uuid primary key default gen_random_uuid(),
  withdrawal_id uuid not null references public.provider_withdrawals(id) on delete restrict,
  reference text not null,
  expected_amount_minor bigint not null,
  actual_amount_minor bigint,
  expected_currency char(3) not null default 'GHS' check (expected_currency = 'GHS'),
  actual_currency text,
  provider_status text,
  result text not null check (result in ('matched', 'mismatch')),
  source text not null check (source in ('paystack', 'webhook', 'reconciliation')),
  details text,
  dedupe_key text not null unique,
  created_at timestamptz not null default now()
);

alter table public.provider_wallet_ledger enable row level security;
alter table public.provider_withdrawal_events enable row level security;
alter table public.provider_payout_reconciliation_events enable row level security;
revoke all on public.provider_wallet_ledger, public.provider_withdrawal_events,
  public.provider_payout_reconciliation_events from public, anon, authenticated;
grant select on public.provider_wallet_ledger to service_role;

insert into public.provider_wallet_ledger (
  provider_id, payment_attempt_id, entry_type, reference, amount_minor, currency, metadata, created_at
)
select payment.provider_id, payment.id, 'payment_deposit',
  'PAYMENT:' || payment.reference || ':deposit', payment.total_amount_minor,
  payment.currency, jsonb_build_object('source', 'migration_backfill'), payment.paid_at
from public.paystack_payment_attempts payment
where payment.paid_at is not null
  and payment.status in ('paid', 'partially_refunded', 'refunded')
on conflict (reference) do nothing;

insert into public.provider_wallet_ledger (
  provider_id, payment_attempt_id, entry_type, reference, amount_minor, currency, metadata, created_at
)
select payment.provider_id, payment.id, 'pending_earning',
  'PAYMENT:' || payment.reference || ':pending', payment.service_amount_minor,
  payment.currency, jsonb_build_object('source', 'migration_backfill'), payment.paid_at
from public.paystack_payment_attempts payment
where payment.paid_at is not null
  and payment.status in ('paid', 'partially_refunded', 'refunded')
  and payment.provider_earnings_status in ('pending', 'eligible_for_payout', 'reversed')
on conflict (reference) do nothing;

insert into public.provider_wallet_ledger (
  provider_id, payment_attempt_id, entry_type, reference, amount_minor, currency, metadata, created_at
)
select payment.provider_id, payment.id, 'pending_earning_settled',
  'PAYMENT:' || payment.reference || ':pending-settled', -payment.service_amount_minor,
  payment.currency, jsonb_build_object('source', 'migration_backfill'), payment.updated_at
from public.paystack_payment_attempts payment
where payment.status = 'paid'
  and payment.provider_earnings_status = 'eligible_for_payout'
   or (payment.provider_earnings_status = 'reversed' and exists (
     select 1 from public.bookings booking
     where booking.id = payment.booking_id and booking.customer_completed_at is not null
   ))
on conflict (reference) do nothing;

insert into public.provider_wallet_ledger (
  provider_id, payment_attempt_id, entry_type, reference, amount_minor, currency, metadata, created_at
)
select payment.provider_id, payment.id, 'earning_credit',
  'PAYMENT:' || payment.reference || ':earning', payment.service_amount_minor,
  payment.currency, jsonb_build_object('source', 'migration_backfill'), payment.updated_at
from public.paystack_payment_attempts payment
where payment.status = 'paid'
  and payment.provider_earnings_status = 'eligible_for_payout'
   or (payment.provider_earnings_status = 'reversed' and exists (
     select 1 from public.bookings booking
     where booking.id = payment.booking_id and booking.customer_completed_at is not null
   ))
on conflict (reference) do nothing;

insert into public.provider_wallet_ledger (
  provider_id, payment_attempt_id, entry_type, reference, amount_minor, currency, metadata, created_at
)
select payment.provider_id, payment.id, 'earning_reversal',
  'PAYMENT:' || payment.reference || ':earning-reversed', -payment.service_amount_minor,
  payment.currency, jsonb_build_object('source', 'migration_backfill'), payment.updated_at
from public.paystack_payment_attempts payment
where payment.provider_earnings_status = 'reversed'
  and exists (
    select 1 from public.bookings booking
    where booking.id = payment.booking_id and booking.customer_completed_at is not null
  )
on conflict (reference) do nothing;

insert into public.provider_wallet_ledger (
  provider_id, payment_attempt_id, entry_type, reference, amount_minor, currency, metadata, created_at
)
select payment.provider_id, payment.id, 'pending_earning_reversed',
  'PAYMENT:' || payment.reference || ':pending-reversed', -payment.service_amount_minor,
  payment.currency, jsonb_build_object('source', 'migration_backfill'), payment.updated_at
from public.paystack_payment_attempts payment
where payment.provider_earnings_status = 'reversed'
  and not exists (
    select 1 from public.bookings booking
    where booking.id = payment.booking_id and booking.customer_completed_at is not null
  )
on conflict (reference) do nothing;

insert into public.provider_wallet_ledger (
  provider_id, withdrawal_id, entry_type, reference, amount_minor, currency,
  test_mode, metadata, created_at
)
select withdrawal.provider_id, withdrawal.id, 'withdrawal_reserved',
  'WITHDRAWAL:' || withdrawal.reference || ':reserved', -withdrawal.amount_minor,
  withdrawal.currency, withdrawal.test_mode,
  jsonb_build_object('source', 'migration_backfill'), withdrawal.created_at
from public.provider_withdrawals withdrawal
on conflict (reference) do nothing;

insert into public.provider_wallet_ledger (
  provider_id, withdrawal_id, entry_type, reference, amount_minor, currency,
  test_mode, metadata, created_at
)
select withdrawal.provider_id, withdrawal.id,
  case when withdrawal.status = 'reversed' then 'withdrawal_reversal' else 'withdrawal_release' end,
  'WITHDRAWAL:' || withdrawal.reference || ':release', withdrawal.amount_minor,
  withdrawal.currency, withdrawal.test_mode,
  jsonb_build_object('source', 'migration_backfill'), withdrawal.updated_at
from public.provider_withdrawals withdrawal
where withdrawal.status in ('failed', 'reversed')
on conflict (reference) do nothing;

insert into public.provider_withdrawal_events (
  withdrawal_id, provider_id, reference, status, source, created_at
)
select withdrawal.id, withdrawal.provider_id, withdrawal.reference, 'pending',
  'application', withdrawal.created_at
from public.provider_withdrawals withdrawal
on conflict (withdrawal_id, status) do nothing;

insert into public.provider_withdrawal_events (
  withdrawal_id, provider_id, reference, status, source, details, created_at
)
select withdrawal.id, withdrawal.provider_id, withdrawal.reference, withdrawal.status,
  'migration_backfill', withdrawal.gateway_message, withdrawal.updated_at
from public.provider_withdrawals withdrawal
where withdrawal.status <> 'pending'
on conflict (withdrawal_id, status) do nothing;

create function public.record_provider_payment_ledger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.paid_at is not null
     and new.status in ('paid', 'partially_refunded', 'refunded')
     and (tg_op = 'INSERT' or old.paid_at is null) then
    insert into public.provider_wallet_ledger (
      provider_id, payment_attempt_id, entry_type, reference, amount_minor, currency, metadata
    ) values
      (new.provider_id, new.id, 'payment_deposit', 'PAYMENT:' || new.reference || ':deposit',
        new.total_amount_minor, new.currency, '{"source":"paystack"}'::jsonb),
      (new.provider_id, new.id, 'pending_earning', 'PAYMENT:' || new.reference || ':pending',
        new.service_amount_minor, new.currency, '{"source":"paystack"}'::jsonb)
    on conflict (reference) do nothing;
  end if;

  if new.status = 'paid'
     and new.provider_earnings_status = 'eligible_for_payout'
     and (tg_op = 'INSERT' or old.provider_earnings_status <> 'eligible_for_payout') then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.provider_id::text, 0)
    );
    insert into public.provider_wallet_ledger (
      provider_id, payment_attempt_id, entry_type, reference, amount_minor, currency, metadata
    ) values
      (new.provider_id, new.id, 'pending_earning_settled',
        'PAYMENT:' || new.reference || ':pending-settled',
        -new.service_amount_minor, new.currency, '{"source":"customer_completion"}'::jsonb),
      (new.provider_id, new.id, 'earning_credit', 'PAYMENT:' || new.reference || ':earning',
        new.service_amount_minor, new.currency, '{"source":"customer_completion"}'::jsonb)
    on conflict (reference) do nothing;
  elsif new.provider_earnings_status = 'reversed'
      and tg_op = 'UPDATE'
      and old.provider_earnings_status in ('pending', 'eligible_for_payout') then
    if old.provider_earnings_status = 'pending' then
      insert into public.provider_wallet_ledger (
        provider_id, payment_attempt_id, entry_type, reference, amount_minor, currency, metadata
      ) values (
        new.provider_id, new.id, 'pending_earning_reversed',
        'PAYMENT:' || new.reference || ':pending-reversed',
        -new.service_amount_minor, new.currency, '{"source":"paystack_refund"}'::jsonb
      ) on conflict (reference) do nothing;
    else
      perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(new.provider_id::text, 0)
      );
      insert into public.provider_wallet_ledger (
        provider_id, payment_attempt_id, entry_type, reference, amount_minor, currency, metadata
      ) values (
        new.provider_id, new.id, 'earning_reversal',
        'PAYMENT:' || new.reference || ':earning-reversed',
        -new.service_amount_minor, new.currency, '{"source":"paystack_refund"}'::jsonb
      ) on conflict (reference) do nothing;
    end if;
  end if;
  return new;
end;
$$;

create trigger provider_payment_ledger
after insert or update of status, provider_earnings_status, paid_at
on public.paystack_payment_attempts
for each row execute function public.record_provider_payment_ledger();

drop function public.get_provider_payout_balance(uuid);
create function public.get_provider_payout_balance(p_provider_id uuid)
returns table(
  available_minor bigint,
  earned_minor bigint,
  reserved_minor bigint,
  pending_minor bigint,
  withdrawn_minor bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with wallet as (
    select
      coalesce(sum(entry.amount_minor) filter (where entry.entry_type in (
        'earning_credit', 'earning_reversal', 'withdrawal_reserved',
        'withdrawal_release', 'withdrawal_reversal', 'balance_adjustment'
      ) and not entry.test_mode), 0)::bigint as available,
      coalesce(sum(entry.amount_minor) filter (where entry.entry_type in (
        'earning_credit', 'earning_reversal'
      ) and not entry.test_mode), 0)::bigint as earned,
      greatest(0, coalesce(sum(entry.amount_minor) filter (where entry.entry_type in (
        'pending_earning', 'pending_earning_settled', 'pending_earning_reversed'
      ) and not entry.test_mode), 0))::bigint as pending
    from public.provider_wallet_ledger entry
    where entry.provider_id = p_provider_id
  ),
  withdrawals as (
    select
      coalesce(sum(withdrawal.amount_minor) filter (
        where withdrawal.status in ('pending', 'processing') and not withdrawal.test_mode
      ), 0)::bigint as reserved,
      coalesce(sum(withdrawal.amount_minor) filter (
        where withdrawal.status = 'successful' and not withdrawal.test_mode
      ), 0)::bigint as withdrawn
    from public.provider_withdrawals withdrawal
    where withdrawal.provider_id = p_provider_id
  )
  select wallet.available, wallet.earned, withdrawals.reserved, wallet.pending, withdrawals.withdrawn
  from wallet cross join withdrawals;
$$;

drop function public.request_provider_withdrawal(uuid, uuid, bigint, uuid, text, boolean);
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
    provider_id, recipient_id, reference, idempotency_key, amount_minor, status, test_mode
  ) values (
    p_provider_id, p_recipient_id, p_reference, p_idempotency_key, p_amount_minor, 'pending', p_test_mode
  ) returning * into v_withdrawal;

  insert into public.provider_wallet_ledger (
    provider_id, withdrawal_id, entry_type, reference, amount_minor,
    currency, test_mode, metadata
  ) values (
    p_provider_id, v_withdrawal.id, 'withdrawal_reserved',
    'WITHDRAWAL:' || v_withdrawal.reference || ':reserved',
    -p_amount_minor, v_withdrawal.currency, p_test_mode,
    jsonb_build_object('idempotency_key', p_idempotency_key)
  );

  insert into public.provider_withdrawal_events (
    withdrawal_id, provider_id, reference, status, source
  ) values (v_withdrawal.id, p_provider_id, v_withdrawal.reference, 'pending', 'application');

  insert into public.notifications (user_id, kind, title, body, target_path)
  values (
    p_provider_id, 'payout_update', 'Withdrawal pending',
    'Your withdrawal request has been received and the amount is reserved.',
    'earnings'
  );
  return v_withdrawal;
end;
$$;

create function public.claim_provider_withdrawal_submission(p_provider_id uuid, p_reference text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_withdrawal public.provider_withdrawals;
begin
  select * into v_withdrawal
  from public.provider_withdrawals
  where provider_id = p_provider_id and reference = p_reference
  for update;
  if not found then raise exception 'Withdrawal not found.'; end if;
  if v_withdrawal.status <> 'pending' then return false; end if;

  update public.provider_withdrawals
  set status = 'processing', updated_at = now()
  where id = v_withdrawal.id;
  insert into public.provider_withdrawal_events (
    withdrawal_id, provider_id, reference, status, source
  ) values (v_withdrawal.id, p_provider_id, p_reference, 'processing', 'application')
  on conflict (withdrawal_id, status) do nothing;
  insert into public.notifications (user_id, kind, title, body, target_path)
  values (
    p_provider_id, 'payout_update', 'Withdrawal processing',
    'Paystack is processing your withdrawal. The amount remains reserved until settlement.',
    'earnings'
  );
  return true;
end;
$$;

drop function public.record_provider_withdrawal_result(text, text, bigint, text, text);
create function public.record_provider_withdrawal_result(
  p_reference text,
  p_status text,
  p_amount_minor bigint,
  p_currency text,
  p_transfer_code text default null,
  p_gateway_message text default null,
  p_source text default 'paystack'
)
returns public.provider_withdrawals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_withdrawal public.provider_withdrawals;
  v_previous_status text;
  v_title text;
  v_body text;
begin
  if p_status not in ('processing', 'successful', 'failed', 'reversed')
     or p_source not in ('application', 'paystack', 'webhook', 'reconciliation') then
    raise exception 'Invalid withdrawal status.';
  end if;

  select * into v_withdrawal
  from public.provider_withdrawals
  where reference = p_reference
  for update;
  if not found then raise exception 'Withdrawal not found.'; end if;
  if p_amount_minor is null or p_amount_minor <> v_withdrawal.amount_minor
     or upper(coalesce(p_currency, '')) <> v_withdrawal.currency then
    raise exception 'Paystack transfer amount or currency does not match the reserved withdrawal.';
  end if;

  v_previous_status := v_withdrawal.status;
  if (v_previous_status = 'successful' and p_status not in ('successful', 'reversed'))
     or (v_previous_status in ('failed', 'reversed') and v_previous_status <> p_status) then
    raise exception 'A completed withdrawal cannot change to a different result.';
  end if;

  if v_previous_status <> p_status then
    update public.provider_withdrawals
    set status = p_status,
        transfer_code = coalesce(p_transfer_code, transfer_code),
        gateway_message = left(p_gateway_message, 500),
        updated_at = now()
    where id = v_withdrawal.id
    returning * into v_withdrawal;

    insert into public.provider_withdrawal_events (
      withdrawal_id, provider_id, reference, status, source, details
    ) values (
      v_withdrawal.id, v_withdrawal.provider_id, v_withdrawal.reference,
      p_status, p_source, left(p_gateway_message, 500)
    ) on conflict (withdrawal_id, status) do nothing;

    if p_status in ('failed', 'reversed') then
      insert into public.provider_wallet_ledger (
        provider_id, withdrawal_id, entry_type, reference, amount_minor,
        currency, test_mode, metadata
      ) values (
        v_withdrawal.provider_id, v_withdrawal.id,
        case when p_status = 'failed' then 'withdrawal_release' else 'withdrawal_reversal' end,
        'WITHDRAWAL:' || v_withdrawal.reference || ':release',
        v_withdrawal.amount_minor, v_withdrawal.currency, v_withdrawal.test_mode,
        jsonb_build_object('status', p_status, 'source', p_source)
      ) on conflict (reference) do nothing;
    end if;

    v_title := case p_status
      when 'processing' then 'Withdrawal processing'
      when 'successful' then 'Withdrawal successful'
      when 'failed' then 'Withdrawal failed'
      else 'Withdrawal reversed'
    end;
    v_body := case p_status
      when 'processing' then 'Paystack is processing your withdrawal. The amount remains reserved until settlement.'
      when 'successful' then 'Paystack confirmed your withdrawal. The amount has been deducted from your available balance.'
      when 'failed' then 'Paystack could not complete your withdrawal. The reserved amount has been returned to your available balance.'
      else 'Paystack reversed your withdrawal. The amount has been returned to your available balance.'
    end;
    insert into public.notifications (user_id, kind, title, body, target_path)
    values (v_withdrawal.provider_id, 'payout_update', v_title, v_body, 'earnings');
  else
    update public.provider_withdrawals
    set transfer_code = coalesce(p_transfer_code, transfer_code),
        gateway_message = left(p_gateway_message, 500),
        updated_at = now()
    where id = v_withdrawal.id
    returning * into v_withdrawal;
  end if;

  if p_source <> 'application' then
    insert into public.provider_payout_reconciliation_events (
      withdrawal_id, reference, expected_amount_minor, actual_amount_minor,
      actual_currency, provider_status, result, source, details, dedupe_key
    ) values (
      v_withdrawal.id, v_withdrawal.reference, v_withdrawal.amount_minor,
      p_amount_minor, upper(p_currency), p_status, 'matched', p_source,
      left(p_gateway_message, 500),
      v_withdrawal.reference || ':matched:' || p_status || ':' || p_source
    ) on conflict (dedupe_key) do nothing;
  end if;
  return v_withdrawal;
end;
$$;

create function public.record_provider_payout_mismatch(
  p_reference text,
  p_actual_amount_minor bigint,
  p_actual_currency text,
  p_provider_status text,
  p_source text,
  p_details text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_withdrawal public.provider_withdrawals;
begin
  if p_source not in ('paystack', 'webhook', 'reconciliation') then
    raise exception 'Invalid reconciliation source.';
  end if;
  select * into v_withdrawal
  from public.provider_withdrawals
  where reference = p_reference;
  if not found then raise exception 'Withdrawal not found.'; end if;

  insert into public.provider_payout_reconciliation_events (
    withdrawal_id, reference, expected_amount_minor, actual_amount_minor,
    actual_currency, provider_status, result, source, details, dedupe_key
  ) values (
    v_withdrawal.id, v_withdrawal.reference, v_withdrawal.amount_minor,
    p_actual_amount_minor, upper(p_actual_currency), p_provider_status,
    'mismatch', p_source, left(p_details, 500),
    v_withdrawal.reference || ':mismatch:' || coalesce(p_actual_amount_minor::text, 'null')
      || ':' || upper(coalesce(p_actual_currency, ''))
      || ':' || coalesce(p_provider_status, '') || ':' || p_source
  ) on conflict (dedupe_key) do nothing;
end;
$$;

create function public.record_provider_wallet_adjustment(
  p_provider_id uuid,
  p_amount_minor bigint,
  p_reference text,
  p_reason text
)
returns public.provider_wallet_ledger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.provider_wallet_ledger;
  v_entry public.provider_wallet_ledger;
begin
  if p_provider_id is null or p_amount_minor is null or p_amount_minor = 0
     or p_reference !~ '^SKM_ADJ_[0-9a-f-]{36}$'
     or char_length(coalesce(trim(p_reason), '')) < 5
     or char_length(p_reason) > 500 then
    raise exception 'Provide a valid balance adjustment with a reason and unique reference.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_provider_id::text, 0)
  );
  select * into v_existing
  from public.provider_wallet_ledger
  where provider_id = p_provider_id and reference = p_reference;
  if found then
    if v_existing.amount_minor <> p_amount_minor
       or v_existing.metadata->>'reason' <> p_reason then
      raise exception 'This adjustment reference was already used for a different entry.';
    end if;
    return v_existing;
  end if;

  insert into public.provider_wallet_ledger (
    provider_id, entry_type, reference, amount_minor, metadata
  ) values (
    p_provider_id, 'balance_adjustment', p_reference, p_amount_minor,
    jsonb_build_object('reason', p_reason)
  ) returning * into v_entry;
  return v_entry;
end;
$$;

revoke all on function public.record_provider_payment_ledger() from public, anon, authenticated;
revoke all on function public.get_provider_payout_balance(uuid) from public, anon, authenticated;
revoke all on function public.request_provider_withdrawal(uuid, uuid, bigint, uuid, text, boolean)
  from public, anon, authenticated;
revoke all on function public.claim_provider_withdrawal_submission(uuid, text)
  from public, anon, authenticated;
revoke all on function public.record_provider_withdrawal_result(text, text, bigint, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.record_provider_payout_mismatch(text, bigint, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.record_provider_wallet_adjustment(uuid, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.get_provider_payout_balance(uuid) to service_role;
grant execute on function public.request_provider_withdrawal(uuid, uuid, bigint, uuid, text, boolean)
  to service_role;
grant execute on function public.claim_provider_withdrawal_submission(uuid, text) to service_role;
grant execute on function public.record_provider_withdrawal_result(text, text, bigint, text, text, text, text)
  to service_role;
grant execute on function public.record_provider_payout_mismatch(text, bigint, text, text, text, text)
  to service_role;
grant execute on function public.record_provider_wallet_adjustment(uuid, bigint, text, text)
  to service_role;

notify pgrst, 'reload schema';
commit;
