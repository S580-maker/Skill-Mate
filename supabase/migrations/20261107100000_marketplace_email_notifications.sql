begin;

create table public.marketplace_email_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('message', 'booking_request', 'booking_update')),
  message_id uuid references public.messages(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete cascade,
  available_at timestamptz not null,
  attempts smallint not null default 0 check (attempts between 0 and 8),
  claimed_until timestamptz,
  claim_token uuid,
  processed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (event_type = 'message' and message_id is not null and booking_id is null)
    or (event_type in ('booking_request', 'booking_update') and booking_id is not null and message_id is null)
  )
);

create unique index marketplace_email_message_recipient_idx
  on public.marketplace_email_outbox(message_id, recipient_id)
  where message_id is not null;
create index marketplace_email_due_idx
  on public.marketplace_email_outbox(available_at, claimed_until)
  where processed_at is null and failed_at is null;
create index marketplace_email_cleanup_idx
  on public.marketplace_email_outbox(processed_at, failed_at)
  where processed_at is not null or failed_at is not null;

alter table public.marketplace_email_outbox enable row level security;
revoke all on public.marketplace_email_outbox from public, anon, authenticated;
grant select, insert, update on public.marketplace_email_outbox to service_role;

create or replace function public.queue_message_email_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.marketplace_email_outbox (
    recipient_id, event_type, message_id, available_at
  )
  select member.user_id, 'message', new.id, new.created_at + interval '10 minutes'
  from public.conversation_members as member
  where member.conversation_id = new.conversation_id
    and member.user_id <> new.sender_id
  on conflict (message_id, recipient_id) where message_id is not null do nothing;
  return new;
end;
$$;

create trigger queue_message_email_notifications
after insert on public.messages
for each row execute function public.queue_message_email_notifications();

create or replace function public.queue_booking_email_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_type text;
begin
  if tg_op = 'INSERT' then
    v_event_type := 'booking_request';
  elsif old.status is distinct from new.status or old.scheduled_at is distinct from new.scheduled_at then
    v_event_type := 'booking_update';
  else
    return new;
  end if;

  insert into public.marketplace_email_outbox (
    recipient_id, event_type, booking_id, available_at
  )
  select recipient.user_id, v_event_type, new.id, now()
  from (
    select new.customer_id as user_id
    union
    select new.provider_id
  ) as recipient;
  return new;
end;
$$;

create trigger queue_booking_email_notifications
after insert or update of status, scheduled_at on public.bookings
for each row execute function public.queue_booking_email_notifications();

create or replace function public.claim_marketplace_email_notifications()
returns table (
  id uuid,
  recipient_id uuid,
  event_type text,
  message_id uuid,
  booking_id uuid,
  claim_token uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claim_token uuid := gen_random_uuid();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the email scheduler can claim notifications.';
  end if;

  delete from public.marketplace_email_outbox
  where processed_at < now() - interval '7 days'
     or failed_at < now() - interval '30 days';

  return query
  with due as (
    select outbox.id
    from public.marketplace_email_outbox as outbox
    where outbox.processed_at is null
      and outbox.failed_at is null
      and outbox.available_at <= now()
      and (outbox.claimed_until is null or outbox.claimed_until <= now())
    order by outbox.available_at, outbox.id
    limit 40
    for update skip locked
  ), claimed as (
    update public.marketplace_email_outbox as outbox
    set claimed_until = now() + interval '5 minutes',
        claim_token = v_claim_token
    from due
    where outbox.id = due.id
    returning outbox.id, outbox.recipient_id, outbox.event_type,
      outbox.message_id, outbox.booking_id
  )
  select claimed.id, claimed.recipient_id, claimed.event_type,
    claimed.message_id, claimed.booking_id, v_claim_token
  from claimed;
end;
$$;

create or replace function public.finish_marketplace_email_notifications(
  p_claim_token uuid,
  p_outbox_ids uuid[],
  p_succeeded boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Only the email scheduler can finish notifications.';
  end if;

  if p_succeeded then
    update public.marketplace_email_outbox
    set processed_at = now(), claimed_until = null, claim_token = null
    where id = any(p_outbox_ids)
      and claim_token = p_claim_token
      and processed_at is null
      and failed_at is null;
  else
    update public.marketplace_email_outbox
    set attempts = attempts + 1,
        available_at = now() + make_interval(secs => least(60 * power(2, attempts)::integer, 3600)),
        failed_at = case when attempts + 1 >= 8 then now() else null end,
        claimed_until = null,
        claim_token = null
    where id = any(p_outbox_ids)
      and claim_token = p_claim_token
      and processed_at is null
      and failed_at is null;
  end if;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.claim_marketplace_email_notifications() from public, anon, authenticated;
revoke all on function public.finish_marketplace_email_notifications(uuid, uuid[], boolean) from public, anon, authenticated;
grant execute on function public.claim_marketplace_email_notifications() to service_role;
grant execute on function public.finish_marketplace_email_notifications(uuid, uuid[], boolean) to service_role;

notify pgrst, 'reload schema';
commit;
