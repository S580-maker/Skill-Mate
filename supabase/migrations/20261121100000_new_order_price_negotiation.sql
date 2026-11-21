begin;

alter table public.price_negotiations
  drop constraint if exists price_negotiations_service_id_customer_id_key;
create index if not exists price_negotiations_service_id_customer_id_idx
  on public.price_negotiations (service_id, customer_id);

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
  v_booking_status text;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext(p_service_id::text),
    pg_catalog.hashtext(v_customer_id::text)
  );
  select * into v_negotiation from public.price_negotiations
  where service_id = p_service_id and customer_id = v_customer_id
  order by created_at desc, id desc
  limit 1 for update;
  if found then
    if v_negotiation.state = 'agreed' then
      select lower(status::text) into v_booking_status
      from public.bookings
      where price_negotiation_id = v_negotiation.id;
    end if;

    if v_negotiation.state = 'agreed'
       and v_booking_status in ('cancelled', 'declined', 'completed') then
      insert into public.price_negotiations (
        service_id, provider_id, customer_id, conversation_id, listed_price
      ) values (
        p_service_id, v_service.provider_id, v_customer_id, p_conversation_id, v_service.price
      ) returning * into v_negotiation;
    else
      if v_negotiation.conversation_id <> p_conversation_id then
        raise exception 'A negotiation for this service already exists in another conversation.';
      end if;
      if p_initial_amount is null then
        return v_negotiation.id;
      end if;
      if v_negotiation.state = 'agreed' then
        raise exception 'A final price has already been agreed.';
      end if;
      if exists (
        select 1 from public.price_offers
        where negotiation_id = v_negotiation.id and status = 'pending'
      ) then
        raise exception 'An offer is already waiting for a response.';
      end if;
    end if;
  else
    insert into public.price_negotiations (
      service_id, provider_id, customer_id, conversation_id, listed_price
    ) values (
      p_service_id, v_service.provider_id, v_customer_id, p_conversation_id, v_service.price
    ) returning * into v_negotiation;
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
    where exists (
      select 1 from public.profiles p
      where p.id = v_recipient_id and p.notify_messages
    );
  end if;
  return v_negotiation.id;
end;
$$;

create or replace function public.start_conversation(p_other_user_id uuid, p_booking_id uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conversation_id uuid;
  v_blocked boolean;
begin
  if auth.uid() is null or p_other_user_id = auth.uid() then
    raise exception 'Sign in and choose another student to message.';
  end if;
  if not exists (select 1 from public.profiles where id = p_other_user_id and role = 'student') then
    raise exception 'That student account could not be found.';
  end if;
  select exists (
    select 1 from public.user_blocks
    where (blocker_id = auth.uid() and blocked_id = p_other_user_id)
       or (blocker_id = p_other_user_id and blocked_id = auth.uid())
  ) into v_blocked;
  if v_blocked then
    raise exception 'Messaging is unavailable for this account.';
  end if;
  if p_booking_id is not null and not exists (
    select 1 from public.bookings b
    where b.id = p_booking_id
      and (
        (b.customer_id = auth.uid() and b.provider_id = p_other_user_id)
        or (b.provider_id = auth.uid() and b.customer_id = p_other_user_id)
      )
  ) then
    raise exception 'That booking does not belong to both students.';
  end if;
  if p_booking_id is null and not exists (
    select 1 from public.services
    where provider_id = p_other_user_id and is_active
  ) then
    raise exception 'Start a conversation from an active service or booking.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      least(auth.uid()::text, p_other_user_id::text)
        || ':' || greatest(auth.uid()::text, p_other_user_id::text),
      0
    )
  );
  select c.id into v_conversation_id
  from public.conversations c
  join public.conversation_members mine
    on mine.conversation_id = c.id and mine.user_id = auth.uid()
  join public.conversation_members other
    on other.conversation_id = c.id and other.user_id = p_other_user_id
  where c.booking_id is not distinct from p_booking_id
  order by c.created_at desc
  limit 1;
  if v_conversation_id is null then
    insert into public.conversations (booking_id) values (p_booking_id)
    returning id into v_conversation_id;
    insert into public.conversation_members (conversation_id, user_id)
    values (v_conversation_id, auth.uid()), (v_conversation_id, p_other_user_id);
  end if;
  return v_conversation_id;
end;
$$;

notify pgrst, 'reload schema';
commit;
