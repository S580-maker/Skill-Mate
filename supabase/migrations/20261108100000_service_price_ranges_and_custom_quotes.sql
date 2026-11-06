begin;

alter table public.services
  drop constraint if exists services_price_type_check;
alter table public.services
  add constraint services_price_type_check
  check (price_type in ('fixed', 'starting', 'range'));

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
  v_price_type text := case when p_price_type = 'range' then 'range' else 'fixed' end;
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
  if v_price_type = 'range' and v_mode <> 'hybrid' then
    raise exception 'A price range requires custom-scope pricing.';
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
  if coalesce(p_price_type, 'fixed') not in ('fixed', 'starting', 'range') then
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
      or v_old_minimum is distinct from p_minimum_price
      or v_service.price_type is distinct from v_price_type) then
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
      v_price_type, v_mode
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
      estimated_delivery = p_estimated_delivery, price_type = v_price_type,
      negotiation_mode = v_mode
    where id = p_service_id returning * into v_service;
  end if;
  return v_service;
end;
$$;

create function public.require_range_quote_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.price_negotiations n
    join public.services s on s.id = n.service_id
    where n.id = new.negotiation_id
      and n.provider_id = new.proposer_id
      and s.price_type = 'range'
  ) and char_length(btrim(coalesce(new.message, ''))) = 0 then
    raise exception 'Describe the exact service scope included in this quote.';
  end if;
  return new;
end;
$$;
create trigger price_offers_require_range_quote_scope
before insert or update of message on public.price_offers
for each row execute function public.require_range_quote_scope();
revoke all on function public.require_range_quote_scope() from public, anon, authenticated;

create or replace view public.provider_directory
with (security_invoker = false)
as
select p.id as provider_id, p.full_name, p.university, p.course, p.bio,
  p.avatar_url, p.campus_verified, s.id as service_id, s.title as service_title,
  s.category, s.description as service_description, s.price, s.currency,
  s.accepts_groups, s.created_at as service_created_at, s.cover_image_path,
  s.delivery_method, s.estimated_delivery, s.price_type, s.negotiation_mode,
  p.skills, p.cv_path, p.cv_name,
  (select count(*) from public.bookings b
   where b.provider_id = p.id and b.status = 'completed') as completed_bookings,
  case when s.price_type = 'range' then ns.minimum_price end as price_range_min
from public.profiles p
join public.services s on s.provider_id = p.id
left join public.service_negotiation_settings ns on ns.service_id = s.id
where s.is_active and public.is_verified_session()
  and not public.is_blocked_between(p.id);

notify pgrst, 'reload schema';
commit;
