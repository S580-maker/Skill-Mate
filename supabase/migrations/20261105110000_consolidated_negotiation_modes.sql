begin;

alter table public.services
  drop constraint if exists services_negotiation_mode_check;
drop trigger if exists normalize_legacy_negotiation_mode on public.services;
update public.services
set negotiation_mode = 'negotiation'
where negotiation_mode in ('chat', 'controlled');
alter table public.services
  add constraint services_negotiation_mode_check
  check (negotiation_mode in ('fixed', 'negotiation', 'hybrid'));

create or replace function public.normalize_legacy_negotiation_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.negotiation_mode in ('chat', 'controlled') then
    new.negotiation_mode := 'negotiation';
  end if;
  return new;
end;
$$;
create trigger normalize_legacy_negotiation_mode
before insert or update of negotiation_mode on public.services
for each row execute function public.normalize_legacy_negotiation_mode();

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
  v_mode text := case when p_mode in ('chat', 'controlled') then 'negotiation' else p_mode end;
begin
  if auth.uid() is null or not public.is_verified_session() then
    raise exception 'Sign in with a verified session to save a service.';
  end if;
  if p_service_id is null or v_mode is null
     or v_mode not in ('fixed', 'negotiation', 'hybrid') then
    raise exception 'Choose a valid pricing and negotiation option.';
  end if;
  if p_price is null or p_price <= 0 or p_price > 99999999.99
     or p_price <> round(p_price, 2) then
    raise exception 'Enter a listed price with no more than two decimal places.';
  end if;
  if v_mode in ('negotiation', 'hybrid')
     and (p_minimum_price is null or p_minimum_price <= 0
       or p_minimum_price > p_price or p_minimum_price <> round(p_minimum_price, 2)) then
    raise exception 'The minimum price must be greater than zero and no higher than the listed price.';
  end if;
  if v_mode = 'fixed' and p_minimum_price is not null then
    raise exception 'Fixed Price does not use a minimum price.';
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
    raise exception 'Choose a valid listed price.';
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
    ) and (v_service.negotiation_mode is distinct from v_mode
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
      'fixed', v_mode
    ) returning * into v_service;
    if v_mode in ('negotiation', 'hybrid') then
      insert into public.service_negotiation_settings (service_id, provider_id, minimum_price)
      values (p_service_id, auth.uid(), p_minimum_price);
    end if;
  else
    if v_mode in ('negotiation', 'hybrid') then
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
      estimated_delivery = p_estimated_delivery, price_type = 'fixed',
      negotiation_mode = v_mode
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
  if not found or v_service.negotiation_mode = 'fixed' then
    raise exception 'This service is unavailable for price negotiation.';
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
    if v_mode not in ('negotiation', 'hybrid') then
      raise exception 'Price proposals are unavailable for this service.';
    end if;
    if p_initial_amount is null or p_initial_amount <= 0 then
      raise exception 'Enter a valid proposed price.';
    end if;
  else
    v_customer_id := v_user_id;
  end if;
  if p_initial_amount is not null
     and (p_initial_amount <= 0 or p_initial_amount > 99999999.99
       or p_initial_amount <> round(p_initial_amount, 2)) then
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
  if v_service.negotiation_mode = 'fixed' then
    raise exception 'Price negotiation is disabled for fixed-price services.';
  end if;
  if p_action = 'accept' then
    if v_service.negotiation_mode in ('negotiation', 'hybrid') then
      select minimum_price into v_minimum
      from public.service_negotiation_settings where service_id = v_service.id;
      if v_minimum is not null and v_offer.amount < v_minimum then
        raise exception 'This offer is below the provider minimum and cannot be accepted.';
      end if;
    end if;
    v_scope := case when v_service.negotiation_mode = 'hybrid'
      then coalesce(nullif(btrim(v_offer.message), ''), v_service.description)
      else v_service.description end;
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
     and v_service.negotiation_mode in ('negotiation', 'hybrid') then
    select minimum_price into v_minimum
    from public.service_negotiation_settings where service_id = v_service.id;
    if v_minimum is not null and p_counter_amount < v_minimum then
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

notify pgrst, 'reload schema';
commit;
