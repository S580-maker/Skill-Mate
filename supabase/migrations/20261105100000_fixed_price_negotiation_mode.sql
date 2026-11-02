begin;

alter table public.services
  drop constraint if exists services_negotiation_mode_check;
update public.services
set negotiation_mode = 'chat'
where negotiation_mode = 'controlled';
alter table public.services
  add constraint services_negotiation_mode_check
  check (negotiation_mode in ('fixed', 'chat', 'hybrid'));

create function public.normalize_legacy_negotiation_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.negotiation_mode = 'controlled' then
    new.negotiation_mode := 'chat';
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
begin
  if auth.uid() is null or not public.is_verified_session() then
    raise exception 'Sign in with a verified session to save a service.';
  end if;
  if p_service_id is null or p_mode is null
     or p_mode not in ('fixed', 'controlled', 'chat', 'hybrid') then
    raise exception 'Choose a valid pricing and negotiation option.';
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
  if p_mode in ('fixed', 'chat') and p_minimum_price is not null then
    raise exception 'This negotiation option does not use a minimum price.';
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

create function public.reject_fixed_price_negotiation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
begin
  select negotiation_mode into v_mode
  from public.services where id = new.service_id;
  if not found then
    raise exception 'This service is unavailable for price negotiation.';
  end if;
  if v_mode = 'fixed' then
    raise exception 'Price negotiation is disabled for fixed-price services.';
  end if;
  return new;
end;
$$;

create trigger reject_fixed_price_negotiation
before insert or update on public.price_negotiations
for each row execute function public.reject_fixed_price_negotiation();

create function public.reject_fixed_price_offer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
begin
  select s.negotiation_mode into v_mode
  from public.price_negotiations n
  join public.services s on s.id = n.service_id
  where n.id = new.negotiation_id;
  if not found then
    raise exception 'This price negotiation is unavailable.';
  end if;
  if v_mode = 'fixed' then
    raise exception 'Price offers are disabled for fixed-price services.';
  end if;
  return new;
end;
$$;

create trigger reject_fixed_price_offer
before insert or update on public.price_offers
for each row execute function public.reject_fixed_price_offer();

revoke all on function public.reject_fixed_price_negotiation() from public, anon, authenticated;
revoke all on function public.reject_fixed_price_offer() from public, anon, authenticated;
revoke all on function public.normalize_legacy_negotiation_mode() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
