begin;

alter table public.price_negotiations
  add column if not exists agreed_scope_snapshot text;

update public.price_negotiations n
set agreed_scope_snapshot = coalesce(
  (select nullif(btrim(o.message), '') from public.price_offers o where o.id = n.accepted_offer_id),
  s.description
)
from public.services s
where s.id = n.service_id
  and n.state = 'agreed'
  and n.agreed_scope_snapshot is null;

create table if not exists public.price_agreements (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null unique references public.price_negotiations(id) on delete restrict,
  accepted_offer_id uuid not null unique references public.price_offers(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  conversation_id uuid not null references public.conversations(id) on delete restrict,
  listed_price numeric(10,2) not null check (listed_price > 0),
  agreed_price numeric(10,2) not null check (agreed_price > 0),
  currency char(3) not null,
  scope_snapshot text not null check (char_length(scope_snapshot) between 1 and 2000),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (provider_id <> customer_id)
);

insert into public.price_agreements (
  negotiation_id, accepted_offer_id, service_id, provider_id, customer_id,
  conversation_id, listed_price, agreed_price, currency, scope_snapshot,
  accepted_at, created_at
)
select n.id, n.accepted_offer_id, n.service_id, n.provider_id, n.customer_id,
  n.conversation_id, n.listed_price, n.agreed_price, s.currency,
  coalesce(nullif(n.agreed_scope_snapshot, ''), s.description),
  n.updated_at, n.created_at
from public.price_negotiations n
join public.services s on s.id = n.service_id
where n.state = 'agreed' and n.accepted_offer_id is not null
on conflict (negotiation_id) do nothing;

alter table public.bookings
  add column if not exists price_agreement_id uuid,
  add column if not exists scope_snapshot text,
  add column if not exists provider_confirmed_by uuid references public.profiles(id) on delete set null,
  add column if not exists provider_confirmed_at timestamptz,
  add column if not exists provider_declined_by uuid references public.profiles(id) on delete set null,
  add column if not exists provider_declined_at timestamptz;

update public.bookings b
set price_agreement_id = a.id,
    scope_snapshot = coalesce(b.scope_snapshot, a.scope_snapshot)
from public.price_agreements a
where b.price_negotiation_id = a.negotiation_id
  and (b.price_agreement_id is null or b.scope_snapshot is null);

alter table public.bookings
  add constraint bookings_price_agreement_fk
    foreign key (price_agreement_id) references public.price_agreements(id) on delete restrict;

create unique index if not exists bookings_price_agreement_unique_idx
  on public.bookings(price_agreement_id) where price_agreement_id is not null;

alter table public.notifications
  add column if not exists booking_id uuid references public.bookings(id) on delete set null;

create table if not exists public.booking_appointment_proposals (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  proposer_id uuid not null references public.profiles(id) on delete restrict,
  proposed_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  responded_by uuid references public.profiles(id) on delete set null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists booking_appointment_one_pending_idx
  on public.booking_appointment_proposals(booking_id) where status = 'pending';
create index if not exists booking_appointment_created_idx
  on public.booking_appointment_proposals(booking_id, created_at desc);

alter table public.price_agreements enable row level security;
alter table public.booking_appointment_proposals enable row level security;
revoke all on public.price_agreements from public, anon, authenticated;
revoke all on public.booking_appointment_proposals from public, anon, authenticated;
grant select on public.price_agreements to authenticated;
grant select on public.booking_appointment_proposals to authenticated;

drop policy if exists "Agreement participants read their price agreements" on public.price_agreements;
create policy "Agreement participants read their price agreements"
on public.price_agreements for select to authenticated
using (customer_id = (select auth.uid()) or provider_id = (select auth.uid()));

drop policy if exists "Booking participants read appointment proposals" on public.booking_appointment_proposals;
create policy "Booking participants read appointment proposals"
on public.booking_appointment_proposals for select to authenticated
using (exists (
  select 1 from public.bookings b
  where b.id = booking_id
    and (b.customer_id = (select auth.uid()) or b.provider_id = (select auth.uid()))
));

create or replace function public.decide_price_offer(
  p_offer_id uuid, p_action text, p_counter_amount numeric default null,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_offer public.price_offers;
  v_negotiation public.price_negotiations;
  v_service public.services;
  v_minimum numeric(10,2);
  v_recipient_id uuid;
  v_new_offer_id uuid;
  v_scope text;
  v_agreement_id uuid;
begin
  if v_user_id is null or not public.is_verified_session() then
    raise exception 'Sign in with a verified session to respond to an offer.';
  end if;
  if p_action not in ('accept', 'reject', 'counter') then
    raise exception 'Choose accept, reject, or counter.';
  end if;
  select * into v_offer from public.price_offers where id = p_offer_id for update;
  if not found then raise exception 'This price offer could not be found.'; end if;
  select * into v_negotiation from public.price_negotiations
  where id = v_offer.negotiation_id for update;
  if v_negotiation.state <> 'open' or v_offer.status <> 'pending' then
    raise exception 'This offer has already been answered.';
  end if;
  if v_user_id not in (v_negotiation.provider_id, v_negotiation.customer_id)
     or v_user_id = v_offer.proposer_id then
    raise exception 'Only the other negotiation participant can respond to this offer.';
  end if;
  select * into v_service from public.services where id = v_negotiation.service_id for share;
  if p_action = 'accept' then
    if v_service.negotiation_mode in ('controlled', 'hybrid') then
      select minimum_price into v_minimum
      from public.service_negotiation_settings where service_id = v_service.id;
      if v_minimum is null or v_offer.amount < v_minimum then
        raise exception 'This offer is below the provider minimum and cannot be accepted.';
      end if;
    end if;
    v_scope := coalesce(nullif(btrim(v_offer.message), ''), v_service.description);
    update public.price_offers set status = 'accepted' where id = v_offer.id;
    update public.price_negotiations
      set state = 'agreed', agreed_price = v_offer.amount,
          accepted_offer_id = v_offer.id, agreed_scope_snapshot = v_scope,
          updated_at = now()
      where id = v_negotiation.id;
    insert into public.price_agreements (
      negotiation_id, accepted_offer_id, service_id, provider_id, customer_id,
      conversation_id, listed_price, agreed_price, currency, scope_snapshot
    ) values (
      v_negotiation.id, v_offer.id, v_negotiation.service_id, v_negotiation.provider_id,
      v_negotiation.customer_id, v_negotiation.conversation_id, v_negotiation.listed_price,
      v_offer.amount, v_service.currency, v_scope
    ) returning id into v_agreement_id;
    insert into public.notifications (user_id, kind, title, body, target_path, conversation_id)
    select recipient.user_id, 'negotiation_agreed', 'Price and service agreed',
      'The agreed price is ' || v_offer.amount::text || ' ' || v_service.currency
        || '. The customer can now review the booking details.',
      'messages', v_negotiation.conversation_id
    from (values (v_negotiation.provider_id), (v_negotiation.customer_id)) as recipient(user_id)
    join public.profiles p on p.id = recipient.user_id
    where p.notify_messages;
    return v_offer.id;
  elsif p_action = 'reject' then
    update public.price_offers set status = 'rejected' where id = v_offer.id;
    insert into public.notifications (user_id, kind, title, body, target_path, conversation_id)
    select v_offer.proposer_id, 'negotiation_rejected', 'Price offer declined',
      'Your price offer for ' || v_service.title || ' was declined.', 'messages', v_negotiation.conversation_id
    where exists (select 1 from public.profiles p where p.id = v_offer.proposer_id and p.notify_messages);
    return v_offer.id;
  end if;
  if p_counter_amount is null or p_counter_amount <= 0
     or p_counter_amount > 99999999.99
     or p_counter_amount <> round(p_counter_amount, 2)
     or char_length(coalesce(p_message, '')) > 500 then
    raise exception 'Enter a valid counteroffer and a message of 500 characters or fewer.';
  end if;
  if v_user_id = v_negotiation.provider_id
     and v_service.negotiation_mode in ('controlled', 'hybrid') then
    select minimum_price into v_minimum
    from public.service_negotiation_settings where service_id = v_service.id;
    if v_minimum is null or p_counter_amount < v_minimum then
      raise exception 'The counteroffer cannot be below your minimum acceptable price.';
    end if;
  end if;
  update public.price_offers set status = 'countered' where id = v_offer.id;
  insert into public.price_offers (negotiation_id, proposer_id, amount, message)
  values (v_negotiation.id, v_user_id, p_counter_amount, coalesce(p_message, ''))
  returning id into v_new_offer_id;
  v_recipient_id := v_offer.proposer_id;
  insert into public.notifications (user_id, kind, title, body, target_path, conversation_id)
  select v_recipient_id, 'negotiation_counter', 'New counteroffer',
    'There is a counteroffer for ' || v_service.title || '.', 'messages', v_negotiation.conversation_id
  where exists (select 1 from public.profiles p where p.id = v_recipient_id and p.notify_messages);
  return v_new_offer_id;
end;
$$;

create or replace function public.create_booking_from_price_agreement(
  p_negotiation_id uuid, p_scheduled_at timestamptz, p_note text,
  p_location text
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_negotiation public.price_negotiations;
  v_agreement public.price_agreements;
  v_service public.services;
  v_booking public.bookings;
begin
  if v_user_id is null or not public.is_verified_session() then
    raise exception 'Sign in with a verified session to request a booking.';
  end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'Choose a future appointment time.';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 or char_length(coalesce(p_location, '')) > 500 then
    raise exception 'Check that your instructions and service location are within the allowed length.';
  end if;
  select * into v_negotiation from public.price_negotiations
  where id = p_negotiation_id and customer_id = v_user_id for update;
  if not found or v_negotiation.state <> 'agreed' then
    raise exception 'Only a final agreed price can be used for this booking.';
  end if;
  select * into v_agreement from public.price_agreements
  where negotiation_id = v_negotiation.id;
  if not found then raise exception 'The price agreement could not be found. Ask the provider to review the proposal.'; end if;
  select * into v_booking from public.bookings
  where price_agreement_id = v_agreement.id or price_negotiation_id = v_negotiation.id
  for update;
  if found then return v_booking; end if;
  select * into v_service from public.services
  where id = v_agreement.service_id and provider_id = v_agreement.provider_id
    and is_active for share;
  if not found then raise exception 'This service is no longer available.'; end if;
  if public.is_blocked_between(v_agreement.provider_id) then
    raise exception 'Booking is unavailable for this account.';
  end if;
  insert into public.bookings (
    service_id, customer_id, provider_id, scheduled_at, note, location,
    agreed_price, listed_price, price_negotiation_id, price_agreement_id,
    scope_snapshot, currency
  ) values (
    v_agreement.service_id, v_agreement.customer_id, v_agreement.provider_id,
    p_scheduled_at, coalesce(p_note, ''), coalesce(p_location, ''),
    v_agreement.agreed_price, v_agreement.listed_price, v_negotiation.id,
    v_agreement.id, v_agreement.scope_snapshot, v_agreement.currency
  ) returning * into v_booking;
  return v_booking;
end;
$$;

create function public.propose_booking_appointment(
  p_booking_id uuid, p_proposed_at timestamptz
)
returns public.booking_appointment_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_booking public.bookings;
  v_proposal public.booking_appointment_proposals;
begin
  if v_user_id is null or not public.is_verified_session() then
    raise exception 'Sign in with a verified session to suggest another appointment.';
  end if;
  if p_proposed_at is null or p_proposed_at <= now() then
    raise exception 'Choose a future date and time.';
  end if;
  select * into v_booking from public.bookings
  where id = p_booking_id for update;
  if not found or v_booking.provider_id <> v_user_id then
    raise exception 'Only this booking’s provider can suggest another time.';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'An appointment can only be changed on an active booking.';
  end if;
  if exists (
    select 1 from public.booking_appointment_proposals
    where booking_id = v_booking.id and status = 'pending'
  ) then
    raise exception 'A time suggestion is already waiting for the customer.';
  end if;
  insert into public.booking_appointment_proposals (booking_id, proposer_id, proposed_at)
  values (v_booking.id, v_user_id, p_proposed_at)
  returning * into v_proposal;
  insert into public.notifications (
    user_id, kind, title, body, target_path, booking_id,
    conversation_id
  )
  select v_booking.customer_id, 'booking_appointment_proposed',
    'New appointment time suggested',
    'Your provider suggested another time. Review it in your bookings.',
    'bookings', v_booking.id, n.conversation_id
  from public.price_negotiations n
  where n.id = v_booking.price_negotiation_id
    and exists (select 1 from public.profiles p where p.id = v_booking.customer_id and p.notify_booking_updates);
  if not found and exists (
    select 1 from public.profiles p where p.id = v_booking.customer_id and p.notify_booking_updates
  ) then
    insert into public.notifications (user_id, kind, title, body, target_path, booking_id)
    values (v_booking.customer_id, 'booking_appointment_proposed',
      'New appointment time suggested',
      'Your provider suggested another time. Review it in your bookings.',
      'bookings', v_booking.id);
  end if;
  return v_proposal;
end;
$$;

create function public.respond_booking_appointment(
  p_proposal_id uuid, p_accept boolean
)
returns public.booking_appointment_proposals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_proposal public.booking_appointment_proposals;
  v_booking public.bookings;
begin
  if v_user_id is null or not public.is_verified_session() then
    raise exception 'Sign in with a verified session to respond to this time suggestion.';
  end if;
  select * into v_proposal from public.booking_appointment_proposals
  where id = p_proposal_id for update;
  if not found then raise exception 'This appointment suggestion could not be found.'; end if;
  select * into v_booking from public.bookings
  where id = v_proposal.booking_id for update;
  if v_booking.customer_id <> v_user_id or v_proposal.status <> 'pending' then
    raise exception 'Only the customer can respond to a pending time suggestion.';
  end if;
  if v_booking.status not in ('pending', 'confirmed') then
    raise exception 'This booking is no longer active.';
  end if;
  if p_accept and v_proposal.proposed_at <= now() then
    raise exception 'That suggested time has passed. Ask the provider for a new time.';
  end if;
  update public.booking_appointment_proposals
  set status = case when p_accept then 'accepted' else 'rejected' end,
      responded_by = v_user_id, responded_at = now()
  where id = v_proposal.id returning * into v_proposal;
  if p_accept then
    update public.bookings set scheduled_at = v_proposal.proposed_at, updated_at = now()
    where id = v_booking.id;
  end if;
  insert into public.notifications (
    user_id, kind, title, body, target_path, booking_id, conversation_id
  )
  select v_booking.provider_id,
    case when p_accept then 'booking_appointment_accepted' else 'booking_appointment_rejected' end,
    case when p_accept then 'New appointment time accepted' else 'Appointment time declined' end,
    case when p_accept then 'The customer accepted your suggested appointment time.'
      else 'The customer kept the original appointment time.' end,
    'bookings', v_booking.id, n.conversation_id
  from public.price_negotiations n
  join public.profiles p on p.id = v_booking.provider_id and p.notify_booking_updates
  where n.id = v_booking.price_negotiation_id;
  if not found and exists (
    select 1 from public.profiles p where p.id = v_booking.provider_id and p.notify_booking_updates
  ) then
    insert into public.notifications (user_id, kind, title, body, target_path, booking_id)
    values (
      v_booking.provider_id,
      case when p_accept then 'booking_appointment_accepted' else 'booking_appointment_rejected' end,
      case when p_accept then 'New appointment time accepted' else 'Appointment time declined' end,
      case when p_accept then 'The customer accepted your suggested appointment time.'
        else 'The customer kept the original appointment time.' end,
      'bookings', v_booking.id
    );
  end if;
  return v_proposal;
end;
$$;

create function public.guard_booking_agreement_terms()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.scheduled_at is distinct from old.scheduled_at
     and not exists (
       select 1 from public.booking_appointment_proposals p
       where p.booking_id = old.id and p.proposed_at = new.scheduled_at
         and p.status = 'accepted' and p.responded_by = auth.uid()
     ) then
    raise exception 'An appointment change must be approved by the customer.';
  end if;
  if old.price_agreement_id is not null or new.price_agreement_id is not null then
    if new.price_agreement_id is distinct from old.price_agreement_id
       or new.price_negotiation_id is distinct from old.price_negotiation_id
       or new.agreed_price is distinct from old.agreed_price
       or new.listed_price is distinct from old.listed_price
       or new.currency is distinct from old.currency
       or new.scope_snapshot is distinct from old.scope_snapshot then
      raise exception 'The accepted service terms and price cannot be changed after booking.';
    end if;
  end if;
  if old.status is distinct from new.status
     and new.status in ('confirmed', 'completed')
     and exists (
       select 1 from public.booking_appointment_proposals p
       where p.booking_id = old.id and p.status = 'pending'
     ) then
    raise exception 'Wait for the customer to approve or decline the suggested appointment time.';
  end if;
  if old.status = 'pending' and new.status = 'confirmed'
     and auth.uid() = old.provider_id then
    new.provider_confirmed_by := auth.uid();
    new.provider_confirmed_at := now();
  end if;
  if old.status = 'pending' and new.status = 'declined'
     and auth.uid() = old.provider_id then
    new.provider_declined_by := auth.uid();
    new.provider_declined_at := now();
  end if;
  return new;
end;
$$;

create trigger booking_agreement_terms_guard
before update on public.bookings
for each row execute function public.guard_booking_agreement_terms();

create or replace function public.notify_booking_participants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service_title text;
  v_recipient_id uuid;
  v_conversation_id uuid;
begin
  select title into v_service_title from public.services where id = new.service_id;
  select conversation_id into v_conversation_id from public.price_negotiations
  where id = new.price_negotiation_id;
  if tg_op = 'INSERT' then
    insert into public.notifications (user_id, kind, title, body, target_path, booking_id, conversation_id)
    select new.provider_id, 'booking_request', 'New booking request',
      coalesce(v_service_title, 'A service') || ' has a new booking request.', 'bookings',
      new.id, v_conversation_id
    where exists (
      select 1 from public.profiles
      where id = new.provider_id and notify_booking_updates
    );
  elsif old.status is distinct from new.status then
    v_recipient_id := case when auth.uid() = new.customer_id then new.provider_id else new.customer_id end;
    insert into public.notifications (user_id, kind, title, body, target_path, booking_id, conversation_id)
    select v_recipient_id, 'booking_update', 'Booking updated',
      coalesce(v_service_title, 'Your booking') || ' is now ' || new.status::text || '.', 'bookings',
      new.id, v_conversation_id
    where exists (
      select 1 from public.profiles
      where id = v_recipient_id and notify_booking_updates
    );
  end if;
  return new;
end;
$$;

create or replace view public.booking_directory
with (security_invoker = false)
as
select b.id, b.customer_id, b.provider_id, b.group_booking_id, b.scheduled_at,
  b.note, b.agreed_price, b.currency, b.status,
  customer.full_name as customer_name, provider.full_name as provider_name,
  s.title as service_title, s.category, b.listed_price, b.price_negotiation_id,
  b.location,
  b.price_agreement_id, b.scope_snapshot, b.provider_confirmed_by,
  b.provider_confirmed_at, b.provider_declined_by, b.provider_declined_at,
  proposal.id as pending_appointment_proposal_id,
  proposal.proposed_at as pending_appointment_at
from public.bookings b
join public.profiles customer on customer.id = b.customer_id
join public.profiles provider on provider.id = b.provider_id
join public.services s on s.id = b.service_id
left join lateral (
  select p.id, p.proposed_at
  from public.booking_appointment_proposals p
  where p.booking_id = b.id and p.status = 'pending'
  order by p.created_at desc limit 1
) proposal on true
where public.is_verified_session()
  and (b.customer_id = auth.uid() or b.provider_id = auth.uid());

drop policy if exists "Students request bookings for another provider" on public.bookings;
create policy "Students request bookings for another provider"
on public.bookings for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and provider_id <> (select auth.uid())
  and scheduled_at > now()
  and status = 'pending'
  and price_negotiation_id is null
  and price_agreement_id is null
  and exists (
    select 1 from public.services s
    where s.id = bookings.service_id and s.provider_id = bookings.provider_id
      and s.is_active and bookings.agreed_price = s.price
      and bookings.listed_price = s.price
  )
  and not public.is_blocked_between(provider_id)
);

revoke all on function public.create_booking_from_price_agreement(uuid, timestamptz, text) from public, anon, authenticated;
revoke all on function public.create_booking_from_price_agreement(uuid, timestamptz, text, text) from public, anon;
revoke all on function public.propose_booking_appointment(uuid, timestamptz) from public, anon;
revoke all on function public.respond_booking_appointment(uuid, boolean) from public, anon;
revoke all on function public.guard_booking_agreement_terms() from public, anon, authenticated;
grant execute on function public.create_booking_from_price_agreement(uuid, timestamptz, text, text) to authenticated;
grant execute on function public.propose_booking_appointment(uuid, timestamptz) to authenticated;
grant execute on function public.respond_booking_appointment(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
