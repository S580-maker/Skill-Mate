begin;

create or replace function public.notify_booking_cancellation_actor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_service_title text;
begin
  if v_actor is null
     or v_actor not in (new.customer_id, new.provider_id) then
    return new;
  end if;

  select title into v_service_title
  from public.services
  where id = new.service_id;

  insert into public.notifications (user_id, kind, title, body, target_path, booking_id)
  select v_actor, 'booking_update', 'Booking cancelled',
    coalesce(v_service_title, 'Your booking') || ' was cancelled by you. You can find it in your booking history.',
    'bookings', new.id
  where exists (
    select 1 from public.profiles
    where id = v_actor and notify_booking_updates
  );
  return new;
end;
$$;

revoke all on function public.notify_booking_cancellation_actor() from public, anon, authenticated;

create trigger booking_cancellation_actor_notification
after update of status on public.bookings
for each row
when (old.status is distinct from new.status and new.status = 'cancelled')
execute function public.notify_booking_cancellation_actor();

notify pgrst, 'reload schema';
commit;
