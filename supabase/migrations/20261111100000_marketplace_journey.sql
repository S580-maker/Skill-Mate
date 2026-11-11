begin;

-- Daily aggregates only: no search text, message content, service IDs or scope.
create table public.marketplace_journey_daily (
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_day date not null default current_date,
  event_name text not null check (event_name in ('discover','search','profile_open','booking_open','booking_sent')),
  primary key (user_id, event_day, event_name)
);
create index marketplace_journey_daily_day_idx on public.marketplace_journey_daily(event_day);
alter table public.marketplace_journey_daily enable row level security;
revoke all on public.marketplace_journey_daily from public, anon, authenticated;
grant all on public.marketplace_journey_daily to service_role;

create function public.record_marketplace_journey(p_event text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified_session() or auth.uid() is null then
    raise exception 'A verified session is required.';
  end if;
  if p_event is null or p_event not in ('discover','search','profile_open','booking_open','booking_sent') then
    raise exception 'Unknown journey event.';
  end if;
  insert into public.marketplace_journey_daily(user_id,event_name)
    values(auth.uid(),p_event) on conflict do nothing;
  delete from public.marketplace_journey_daily where event_day < current_date - 90;
end;
$$;

create function public.read_marketplace_journey()
returns table(event_name text, students bigint)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_verified_session() or not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then raise exception 'Administrator access is required.'; end if;
  return query select events.event_name,count(distinct events.user_id)
    from public.marketplace_journey_daily events
    where events.event_day >= current_date - 13
    group by events.event_name;
end;
$$;
revoke all on function public.record_marketplace_journey(text) from public, anon;
revoke all on function public.read_marketplace_journey() from public, anon;
grant execute on function public.record_marketplace_journey(text) to authenticated;
grant execute on function public.read_marketplace_journey() to authenticated;
notify pgrst, 'reload schema';
commit;
