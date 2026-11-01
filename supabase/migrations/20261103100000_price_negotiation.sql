begin;

alter table public.services
  add column if not exists negotiation_mode text;
update public.services set negotiation_mode = 'chat' where negotiation_mode is null;
alter table public.services
  alter column negotiation_mode set not null,
  alter column negotiation_mode drop default;

alter table public.services
  add constraint services_negotiation_mode_check
  check (negotiation_mode in ('controlled', 'chat', 'hybrid'));

create table public.service_negotiation_settings (
  service_id uuid primary key references public.services(id) on delete cascade,
  provider_id uuid not null references public.profiles(id) on delete cascade,
  minimum_price numeric(10,2) not null check (minimum_price > 0),
  updated_at timestamptz not null default now()
);

create table public.price_negotiations (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete restrict,
  provider_id uuid not null references public.profiles(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  listed_price numeric(10,2) not null check (listed_price > 0),
  state text not null default 'open' check (state in ('open', 'agreed')),
  agreed_price numeric(10,2) check (agreed_price > 0),
  accepted_offer_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, customer_id),
  check (customer_id <> provider_id),
  check ((state = 'open' and agreed_price is null and accepted_offer_id is null)
    or (state = 'agreed' and agreed_price is not null and accepted_offer_id is not null))
);

create table public.price_offers (
  id uuid primary key default gen_random_uuid(),
  negotiation_id uuid not null references public.price_negotiations(id) on delete cascade,
  proposer_id uuid not null references public.profiles(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0),
  message text not null default '' check (char_length(message) <= 500),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'countered')),
  created_at timestamptz not null default now()
);

create function public.ensure_service_price_covers_minimum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.service_negotiation_settings
    where service_id = old.id and minimum_price > new.price
  ) then
    raise exception 'The listed price cannot be lower than the private minimum acceptable price.';
  end if;
  return new;
end;
$$;
create trigger service_price_covers_minimum
before update of price on public.services
for each row execute function public.ensure_service_price_covers_minimum();

alter table public.price_negotiations
  add constraint price_negotiations_accepted_offer_fk
  foreign key (accepted_offer_id) references public.price_offers(id) on delete restrict;

create unique index price_offers_one_pending_per_negotiation_idx
  on public.price_offers(negotiation_id) where status = 'pending';
create index price_offers_negotiation_created_idx
  on public.price_offers(negotiation_id, created_at desc);

alter table public.bookings
  add column if not exists listed_price numeric(10,2),
  add column if not exists price_negotiation_id uuid;
update public.bookings set listed_price = agreed_price where listed_price is null;
alter table public.bookings
  add constraint bookings_listed_price_check check (listed_price is null or listed_price > 0),
  add constraint bookings_price_negotiation_fk
    foreign key (price_negotiation_id) references public.price_negotiations(id) on delete restrict;
create unique index bookings_price_negotiation_unique_idx
  on public.bookings(price_negotiation_id) where price_negotiation_id is not null;
alter table public.notifications
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null;

alter table public.service_negotiation_settings enable row level security;
alter table public.price_negotiations enable row level security;
alter table public.price_offers enable row level security;
revoke all on public.service_negotiation_settings from public, anon, authenticated;
revoke all on public.price_negotiations from public, anon, authenticated;
revoke all on public.price_offers from public, anon, authenticated;
grant select on public.service_negotiation_settings to authenticated;
grant select on public.price_negotiations to authenticated;
grant select on public.price_offers to authenticated;

create policy "Providers read their private service minimums"
on public.service_negotiation_settings for select to authenticated
using (provider_id = (select auth.uid()));
create policy "Negotiation participants read their negotiations"
on public.price_negotiations for select to authenticated
using (provider_id = (select auth.uid()) or customer_id = (select auth.uid()));
create policy "Negotiation participants read their offers"
on public.price_offers for select to authenticated
using (exists (
  select 1 from public.price_negotiations n
  where n.id = negotiation_id
    and (n.provider_id = (select auth.uid()) or n.customer_id = (select auth.uid()))
));

create or replace function public.save_service_listing(
  p_service_id uuid, p_title text, p_category text, p_description text,
  p_price numeric, p_accepts_groups boolean, p_cover_image_path text,
  p_delivery_method text, p_estimated_delivery text, p_price_type text,
  p_mode text, p_minimum_price numeric
)
returns public.services
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_service public.services;
  v_old_minimum numeric(10,2);
begin
  if auth.uid() is null or not public.is_verified_session() then
    raise exception 'Sign in with a verified session to save a service.';
  end if;
  if p_service_id is null or p_mode is null or p_mode not in ('controlled', 'chat', 'hybrid') then
    raise exception 'Choose a valid service and price negotiation mode.';
  end if;
  if p_price is null or p_price <= 0 or p_price > 99999999.99
     or p_price <> round(p_price, 2) then
    raise exception 'Enter a listed price with no more than two decimal places.';
  end if;
  if p_mode in ('controlled', 'hybrid')
     and (p_minimum_price is null or p_minimum_price <= 0
       or p_minimum_price > p_price or p_minimum_price <> round(p_minimum_price, 2)) then
    raise exception 'The minimum price must be greater than zero and no higher than the listed price.';
  end if;
  if p_mode = 'chat' and p_minimum_price is not null then
    raise exception 'Chat-based negotiation does not use a minimum price.';
  end if;
  if p_minimum_price > 99999999.99 then
    raise exception 'The minimum price is too high.';
  end if;
  if char_length(coalesce(p_title, '')) not between 3 and 100
     or char_length(coalesce(p_category, '')) not between 2 and 50
     or char_length(coalesce(p_description, '')) not between 10 and 2000
     or p_accepts_groups is null
     or char_length(coalesce(p_estimated_delivery, '')) > 80 then
    raise exception 'Check the service title, category, description, and delivery estimate.';
  end if;
  if p_delivery_method is not null and p_delivery_method not in ('online', 'in_person', 'both') then
    raise exception 'Choose a valid delivery method.';
  end if;
  if coalesce(p_price_type, 'fixed') not in ('fixed', 'starting') then
    raise exception 'Choose fixed or starting price.';
  end if;
  select * into v_service from public.services
  where id = p_service_id and provider_id = auth.uid() for update;
  if found then
    select minimum_price into v_old_minimum
    from public.service_negotiation_settings where service_id = p_service_id;
    if exists (
      select 1 from public.price_negotiations n
      where n.service_id = p_service_id and n.state = 'open'
        and exists (select 1 from public.price_offers o where o.negotiation_id = n.id and o.status = 'pending')
    ) and (v_service.negotiation_mode is distinct from p_mode
      or v_old_minimum is distinct from p_minimum_price) then
      raise exception 'You cannot change negotiation settings while an offer is waiting for a response.';
    end if;
  end if;
  if v_service.id is null then
    insert into public.services (
      id, provider_id, title, category, description, price, accepts_groups,
      cover_image_path, delivery_method, estimated_delivery, price_type, negotiation_mode
    ) values (
      p_service_id, auth.uid(), p_title, p_category, p_description, p_price, p_accepts_groups,
      p_cover_image_path, p_delivery_method, p_estimated_delivery,
      coalesce(p_price_type, 'fixed'), p_mode
    ) returning * into v_service;
    if p_mode in ('controlled', 'hybrid') then
      insert into public.service_negotiation_settings (service_id, provider_id, minimum_price)
      values (p_service_id, auth.uid(), p_minimum_price);
    end if;
  else
    if p_mode in ('controlled', 'hybrid') then
      insert into public.service_negotiation_settings (service_id, provider_id, minimum_price)
      values (p_service_id, auth.uid(), p_minimum_price)
      on conflict (service_id) do update
        set minimum_price = excluded.minimum_price, updated_at = now();
    else
      delete from public.service_negotiation_settings where service_id = p_service_id;
    end if;
    update public.services set
      title = p_title, category = p_category, description = p_description,
      price = p_price, accepts_groups = p_accepts_groups,
      cover_image_path = p_cover_image_path, delivery_method = p_delivery_method,
      estimated_delivery = p_estimated_delivery, price_type = coalesce(p_price_type, 'fixed'),
      negotiation_mode = p_mode
    where id = p_service_id returning * into v_service;
  end if;
  return v_service;
end;
$$;

create or replace function public.create_price_negotiation(
  p_service_id uuid, p_conversation_id uuid, p_initial_amount numeric default null,
  p_message text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_service public.services;
  v_customer_id uuid;
  v_negotiation public.price_negotiations;
  v_mode text;
  v_recipient_id uuid;
begin
  if v_user_id is null or not public.is_verified_session() then
    raise exception 'Sign in with a verified session to negotiate a price.';
  end if;
  select * into v_service from public.services
  where id = p_service_id and is_active for share;
  if not found then
    raise exception 'This service is unavailable.';
  end if;
  v_mode := v_service.negotiation_mode;
  if not exists (
    select 1 from public.conversation_members a
    join public.conversation_members b on b.conversation_id = a.conversation_id
    where a.conversation_id = p_conversation_id and a.user_id = v_user_id
      and ((a.user_id = v_service.provider_id and b.user_id <> v_service.provider_id)
        or (b.user_id = v_service.provider_id and a.user_id <> v_service.provider_id))
  ) then
    raise exception 'This conversation is not between you and this service provider.';
  end if;
  if public.is_blocked_between(v_service.provider_id) then
    raise exception 'Price negotiation is unavailable for this account.';
  end if;
  if v_user_id = v_service.provider_id then
    select user_id into v_customer_id from public.conversation_members
    where conversation_id = p_conversation_id and user_id <> v_service.provider_id;
    if v_mode not in ('chat', 'hybrid') then
      raise exception 'Customers must submit the first offer for this negotiation mode.';
    end if;
    if p_initial_amount is null or p_initial_amount <= 0 then
      raise exception 'Enter a valid proposed price.';
    end if;
  else
    v_customer_id := v_user_id;
    if v_mode = 'chat' and p_initial_amount is not null then
      raise exception 'For chat-based negotiation, the provider sends the formal price proposal.';
    end if;
    if v_mode = 'controlled'
       and (p_initial_amount is null or p_initial_amount <= 0) then
      raise exception 'Enter a valid offer amount.';
    end if;
  end if;
  if p_initial_amount is not null
     and (p_initial_amount > 99999999.99 or p_initial_amount <> round(p_initial_amount, 2)) then
    raise exception 'Enter a price with no more than two decimal places and no more than 99,999,999.99.';
  end if;
  select * into v_negotiation from public.price_negotiations
  where service_id = p_service_id and customer_id = v_customer_id for update;
  if found then
    if v_negotiation.conversation_id <> p_conversation_id then
      raise exception 'A negotiation for this service already exists in another conversation.';
    end if;
    if p_initial_amount is null then
      return v_negotiation.id;
    end if;
    if v_negotiation.state = 'agreed' then
      raise exception 'A final price has already been agreed.';
    end if;
    if exists (select 1 from public.price_offers where negotiation_id = v_negotiation.id and status = 'pending') then
      raise exception 'An offer is already waiting for a response.';
    end if;
  else
    insert into public.price_negotiations (service_id, provider_id, customer_id, conversation_id, listed_price)
    values (p_service_id, v_service.provider_id, v_customer_id, p_conversation_id, v_service.price)
    returning * into v_negotiation;
  end if;
  if p_initial_amount is not null then
    if v_user_id = v_service.provider_id and v_mode = 'controlled' then
      raise exception 'Providers cannot make the opening offer in this mode.';
    end if;
    if v_user_id = v_service.provider_id and exists (
      select 1 from public.service_negotiation_settings s
      where s.service_id = p_service_id and p_initial_amount < s.minimum_price
    ) then
      raise exception 'The proposed price is below your minimum acceptable price.';
    end if;
    if char_length(coalesce(p_message, '')) > 500 then
      raise exception 'Keep the offer message to 500 characters or fewer.';
    end if;
    insert into public.price_offers (negotiation_id, proposer_id, amount, message)
    values (v_negotiation.id, v_user_id, p_initial_amount, coalesce(p_message, ''));
    v_recipient_id := case when v_user_id = v_service.provider_id then v_customer_id else v_service.provider_id end;
    insert into public.notifications (user_id, kind, title, body, target_path, conversation_id)
    select v_recipient_id, 'negotiation_offer', 'New price offer',
      'There is a new price proposal for ' || v_service.title || '.', 'messages', p_conversation_id
    where exists (select 1 from public.profiles p where p.id = v_recipient_id and p.notify_messages);
  end if;
  return v_negotiation.id;
end;
$$;

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
    update public.price_offers set status = 'accepted' where id = v_offer.id;
    update public.price_negotiations
      set state = 'agreed', agreed_price = v_offer.amount,
          accepted_offer_id = v_offer.id, updated_at = now()
      where id = v_negotiation.id;
    insert into public.notifications (user_id, kind, title, body, target_path, conversation_id)
    select v_offer.proposer_id, 'negotiation_accepted', 'Price offer accepted',
      'Your price offer was accepted for ' || v_service.title || '.', 'messages', v_negotiation.conversation_id
    where exists (select 1 from public.profiles p where p.id = v_offer.proposer_id and p.notify_messages);
    insert into public.notifications (user_id, kind, title, body, target_path, conversation_id)
    select v_offer.proposer_id, 'negotiation_agreed', 'Final price agreed',
      'You and the provider agreed on ' || v_offer.amount::text || ' ' || v_service.currency || '.', 'messages', v_negotiation.conversation_id
    where exists (select 1 from public.profiles p where p.id = v_offer.proposer_id and p.notify_messages);
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
  p_negotiation_id uuid, p_scheduled_at timestamptz, p_note text default ''
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_negotiation public.price_negotiations;
  v_service public.services;
  v_booking public.bookings;
begin
  if v_user_id is null or not public.is_verified_session() then
    raise exception 'Sign in with a verified session to request a booking.';
  end if;
  if p_scheduled_at is null or p_scheduled_at <= now() then
    raise exception 'Choose a future appointment time.';
  end if;
  if char_length(coalesce(p_note, '')) > 1000 then
    raise exception 'Keep the booking note to 1,000 characters or fewer.';
  end if;
  select * into v_negotiation from public.price_negotiations
  where id = p_negotiation_id and customer_id = v_user_id for update;
  if not found or v_negotiation.state <> 'agreed' then
    raise exception 'Only a final agreed price can be used for this booking.';
  end if;
  if exists (select 1 from public.bookings where price_negotiation_id = p_negotiation_id) then
    raise exception 'This agreed price has already been used for a booking.';
  end if;
  select * into v_service from public.services
  where id = v_negotiation.service_id and provider_id = v_negotiation.provider_id
    and is_active for share;
  if not found then raise exception 'This service is no longer available.'; end if;
  if public.is_blocked_between(v_negotiation.provider_id) then
    raise exception 'Booking is unavailable for this account.';
  end if;
  insert into public.bookings (
    service_id, customer_id, provider_id, scheduled_at, note,
    agreed_price, listed_price, price_negotiation_id, currency
  ) values (
    v_service.id, v_user_id, v_service.provider_id, p_scheduled_at, coalesce(p_note, ''),
    v_negotiation.agreed_price, v_negotiation.listed_price, v_negotiation.id, v_service.currency
  ) returning * into v_booking;
  return v_booking;
end;
$$;

create or replace view public.provider_directory
with (security_invoker = false)
as
select p.id as provider_id, p.full_name, p.university, p.course, p.bio,
  p.avatar_url, p.campus_verified, s.id as service_id, s.title as service_title,
  s.category, s.description as service_description, s.price, s.currency,
  s.accepts_groups, s.created_at as service_created_at, s.cover_image_path,
  s.delivery_method, s.estimated_delivery, s.price_type, s.negotiation_mode
from public.profiles p
join public.services s on s.provider_id = p.id
where s.is_active and public.is_verified_session()
  and not public.is_blocked_between(p.id);

create or replace view public.booking_directory
with (security_invoker = false)
as
select b.id, b.customer_id, b.provider_id, b.group_booking_id, b.scheduled_at,
  b.note, b.agreed_price, b.currency, b.status,
  customer.full_name as customer_name, provider.full_name as provider_name,
  s.title as service_title, s.category, b.listed_price, b.price_negotiation_id
from public.bookings b
join public.profiles customer on customer.id = b.customer_id
join public.profiles provider on provider.id = b.provider_id
join public.services s on s.id = b.service_id
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
  and exists (
    select 1 from public.services s
    where s.id = bookings.service_id and s.provider_id = bookings.provider_id
      and s.is_active and bookings.agreed_price = s.price
      and bookings.listed_price = s.price
  )
  and not public.is_blocked_between(provider_id)
);

revoke insert, update on public.services from authenticated;
grant update (is_active) on public.services to authenticated;
revoke all on function public.save_service_listing(uuid, text, text, text, numeric, boolean, text, text, text, text, text, numeric)
  from public, anon, authenticated;
revoke all on function public.create_price_negotiation(uuid, uuid, numeric, text) from public, anon;
revoke all on function public.decide_price_offer(uuid, text, numeric, text) from public, anon;
revoke all on function public.create_booking_from_price_agreement(uuid, timestamptz, text) from public, anon;
revoke all on function public.ensure_service_price_covers_minimum() from public, anon, authenticated;
grant execute on function public.save_service_listing(uuid, text, text, text, numeric, boolean, text, text, text, text, text, numeric)
  to authenticated;
grant execute on function public.create_price_negotiation(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.decide_price_offer(uuid, text, numeric, text) to authenticated;
grant execute on function public.create_booking_from_price_agreement(uuid, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';
commit;
