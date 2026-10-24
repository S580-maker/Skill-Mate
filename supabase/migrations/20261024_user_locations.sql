create table public.user_locations (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  location_name text not null check (char_length(location_name) between 2 and 120),
  updated_at timestamptz not null default now()
);

alter table public.user_locations enable row level security;

create policy "Users read locations only for confirmed booking participants"
on public.user_locations for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.bookings b
    where b.status = 'confirmed'
      and (
        (b.customer_id = (select auth.uid()) and b.provider_id = user_locations.user_id)
        or (b.provider_id = (select auth.uid()) and b.customer_id = user_locations.user_id)
      )
  )
);

create policy "Users manage their own location"
on public.user_locations for all to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create trigger user_locations_updated_at before update on public.user_locations
for each row execute function public.set_updated_at();

grant select, insert, update, delete on public.user_locations to authenticated;
