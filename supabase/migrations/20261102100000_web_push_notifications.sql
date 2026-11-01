begin;

create table if not exists public.push_subscriptions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null check (char_length(endpoint) between 1 and 2048),
  p256dh text not null check (char_length(p256dh) between 80 and 100),
  auth text not null check (char_length(auth) between 16 and 32),
  created_at timestamptz not null default now(),
  primary key (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;
revoke all on table public.push_subscriptions from public, anon, authenticated;
grant all on table public.push_subscriptions to service_role;

commit;
