begin;

alter table public.bookings
  add column if not exists provider_completed_at timestamptz;

create or replace function public.start_booking_work(p_booking_id uuid) returns public.bookings
language plpgsql security definer set search_path = '' as $$
declare v_booking public.bookings;
begin
  if auth.uid() is null or not public.is_verified_session() then
    raise exception 'Sign in to update a booking.';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found or v_booking.provider_id <> auth.uid() or v_booking.status <> 'confirmed'
     or v_booking.provider_completed_at is not null then
    raise exception 'Only the provider can start a confirmed booking.';
  end if;
  if v_booking.work_started_at is not null then return v_booking; end if;
  if exists (
    select 1 from public.booking_appointment_proposals
    where booking_id = p_booking_id and status = 'pending'
  ) then
    raise exception 'Resolve the suggested appointment time first.';
  end if;
  update public.bookings
  set work_started_at = coalesce(work_started_at, now()), updated_at = now()
  where id = p_booking_id
  returning * into v_booking;
  insert into public.notifications(user_id, kind, title, body, target_path, booking_id)
  select v_booking.customer_id, 'booking_update', 'Your provider has started work',
    'Open your booking to see the next step.', 'bookings', v_booking.id
  where exists (
    select 1 from public.profiles
    where id = v_booking.customer_id and notify_booking_updates
  );
  return v_booking;
end;
$$;

create or replace function public.propose_booking_appointment(
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
  if v_booking.status not in ('pending', 'confirmed')
     or v_booking.provider_completed_at is not null then
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
    and exists (
      select 1 from public.profiles
      where id = v_booking.customer_id and notify_booking_updates
    );
  if not found and exists (
    select 1 from public.profiles
    where id = v_booking.customer_id and notify_booking_updates
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

create or replace function public.update_booking_status(p_booking_id uuid, p_status public.booking_status)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking public.bookings;
  v_user_id uuid := auth.uid();
  v_group_host_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to update a booking.';
  end if;
  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Booking not found.';
  end if;
  if not (select public.is_admin()) then
    if v_booking.provider_id = v_user_id
       and v_booking.status = 'pending'
       and p_status in ('confirmed', 'declined') then
      null;
    elsif v_booking.provider_id = v_user_id
       and v_booking.status = 'confirmed'
       and v_booking.provider_completed_at is null
       and p_status = 'completed'
       and not exists (
         select 1 from public.booking_appointment_proposals
         where booking_id = v_booking.id and status = 'pending'
       ) then
      update public.bookings
      set provider_completed_at = now()
      where id = v_booking.id
      returning * into v_booking;
      return v_booking;
    elsif v_booking.customer_id = v_user_id
       and v_booking.status = 'confirmed'
       and v_booking.provider_completed_at is not null
       and p_status = 'completed' then
      null;
    elsif v_booking.customer_id = v_user_id
       and v_booking.status in ('pending', 'confirmed')
       and v_booking.provider_completed_at is null
       and v_booking.group_booking_id is null
       and p_status = 'cancelled' then
      null;
    else
      raise exception 'You cannot make that booking status change.';
    end if;
  end if;
  update public.bookings set status = p_status where id = p_booking_id returning * into v_booking;
  if p_status = 'declined' and v_booking.group_booking_id is not null
     and v_booking.provider_id = v_user_id then
    select host_id into v_group_host_id
    from public.group_bookings where id = v_booking.group_booking_id for update;
    if v_booking.customer_id = v_group_host_id then
      update public.group_bookings set status = 'cancelled' where id = v_booking.group_booking_id;
      update public.bookings set status = 'cancelled'
      where group_booking_id = v_booking.group_booking_id and id <> p_booking_id
        and status in ('pending', 'confirmed');
      delete from public.group_booking_members where group_booking_id = v_booking.group_booking_id;
    else
      delete from public.group_booking_members
      where group_booking_id = v_booking.group_booking_id and student_id = v_booking.customer_id;
      update public.group_bookings set status = 'open'
      where id = v_booking.group_booking_id and status = 'full';
    end if;
  end if;
  return v_booking;
end;
$$;

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
  v_completion_requested boolean;
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
  elsif old.status is distinct from new.status
     or old.provider_completed_at is distinct from new.provider_completed_at then
    v_recipient_id := case when auth.uid() = new.customer_id then new.provider_id else new.customer_id end;
    v_completion_requested := old.provider_completed_at is distinct from new.provider_completed_at
      and new.provider_completed_at is not null;
    insert into public.notifications (user_id, kind, title, body, target_path, booking_id, conversation_id)
    select v_recipient_id, 'booking_update',
      case when v_completion_requested then 'Completion needs your verification' else 'Booking updated' end,
      case when v_completion_requested
        then coalesce(v_service_title, 'Your booking') || ' was marked complete. Please verify the work.'
        when new.status = 'completed'
        then coalesce(v_service_title, 'Your booking') || ' was verified as complete.'
        else coalesce(v_service_title, 'Your booking') || ' is now ' || new.status::text || '.'
      end,
      'bookings', new.id, v_conversation_id
    where exists (
      select 1 from public.profiles
      where id = v_recipient_id and notify_booking_updates
    );
  end if;
  return new;
end;
$$;

drop trigger if exists booking_status_notification on public.bookings;
create trigger booking_status_notification
after update of status, provider_completed_at on public.bookings
for each row execute function public.notify_booking_participants();

create or replace view public.booking_directory with (security_invoker = false) as
select b.id, b.customer_id, b.provider_id, b.group_booking_id, b.scheduled_at,
  b.note, b.agreed_price, b.currency, b.status,
  customer.full_name as customer_name, provider.full_name as provider_name,
  s.title as service_title, s.category, b.listed_price, b.price_negotiation_id, b.location,
  b.price_agreement_id, b.scope_snapshot, b.provider_confirmed_by, b.provider_confirmed_at,
  b.provider_declined_by, b.provider_declined_at,
  proposal.id as pending_appointment_proposal_id, proposal.proposed_at as pending_appointment_at,
  b.service_id, b.duration_minutes, b.work_started_at, b.provider_completed_at
from public.bookings b
join public.profiles customer on customer.id = b.customer_id
join public.profiles provider on provider.id = b.provider_id
join public.services s on s.id = b.service_id
left join lateral (
  select p.id, p.proposed_at
  from public.booking_appointment_proposals p
  where p.booking_id = b.id and p.status = 'pending'
  order by p.created_at desc
  limit 1
) proposal on true
where public.is_verified_session()
  and (b.customer_id = auth.uid() or b.provider_id = auth.uid());

commit;
