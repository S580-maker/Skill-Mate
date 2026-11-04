begin;

create table public.system_health_snapshots (
  sampled_at timestamptz primary key default now(),
  database_bytes bigint not null check (database_bytes >= 0),
  storage_bytes bigint not null check (storage_bytes >= 0),
  active_connections integer not null check (active_connections >= 0),
  max_connections integer not null check (max_connections > 0),
  auth_ok boolean not null,
  auth_probe_ms integer not null check (auth_probe_ms >= 0),
  database_ok boolean not null,
  database_probe_ms integer not null check (database_probe_ms >= 0)
);

create index system_health_snapshots_sampled_at_idx
  on public.system_health_snapshots(sampled_at desc);

alter table public.system_health_snapshots enable row level security;
revoke all on public.system_health_snapshots from public, anon, authenticated;
grant select, insert, delete on public.system_health_snapshots to service_role;

create or replace function public.capture_system_health_snapshot(
  p_auth_ok boolean,
  p_auth_probe_ms integer,
  p_database_ok boolean,
  p_database_probe_ms integer
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sampled_at timestamptz := now();
  v_database_bytes bigint;
  v_storage_bytes bigint;
  v_active_connections integer;
  v_max_connections integer;
begin
  select pg_catalog.pg_database_size(current_database()) into v_database_bytes;
  select coalesce(sum(
    case
      when coalesce(object.metadata ->> 'size', '') ~ '^[0-9]+$'
        then (object.metadata ->> 'size')::bigint
      else 0
    end
  ), 0)
    into v_storage_bytes
  from storage.objects as object;
  select count(*)::integer into v_active_connections
  from pg_catalog.pg_stat_activity
  where datname = current_database() and state = 'active';
  select setting::integer into v_max_connections
  from pg_catalog.pg_settings
  where name = 'max_connections';

  insert into public.system_health_snapshots (
    sampled_at, database_bytes, storage_bytes, active_connections, max_connections,
    auth_ok, auth_probe_ms, database_ok, database_probe_ms
  ) values (
    v_sampled_at, coalesce(v_database_bytes, 0), coalesce(v_storage_bytes, 0),
    coalesce(v_active_connections, 0), greatest(coalesce(v_max_connections, 1), 1),
    coalesce(p_auth_ok, false), greatest(coalesce(p_auth_probe_ms, 0), 0),
    coalesce(p_database_ok, false), greatest(coalesce(p_database_probe_ms, 0), 0)
  );

  delete from public.system_health_snapshots
  where sampled_at < v_sampled_at - interval '30 days';
  return v_sampled_at;
end;
$$;

create or replace function public.read_system_health_snapshots(p_hours integer default 168)
returns table (
  sampled_at timestamptz,
  database_bytes bigint,
  storage_bytes bigint,
  active_connections integer,
  max_connections integer,
  auth_ok boolean,
  auth_probe_ms integer,
  database_ok boolean,
  database_probe_ms integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select snapshot.sampled_at, snapshot.database_bytes, snapshot.storage_bytes,
    snapshot.active_connections, snapshot.max_connections, snapshot.auth_ok,
    snapshot.auth_probe_ms, snapshot.database_ok, snapshot.database_probe_ms
  from public.system_health_snapshots as snapshot
  where snapshot.sampled_at >= now() - make_interval(hours => greatest(1, least(coalesce(p_hours, 168), 720)))
  order by snapshot.sampled_at desc
  limit 2016;
$$;

revoke all on function public.capture_system_health_snapshot(boolean, integer, boolean, integer) from public, anon, authenticated;
revoke all on function public.read_system_health_snapshots(integer) from public, anon, authenticated;
grant execute on function public.capture_system_health_snapshot(boolean, integer, boolean, integer) to service_role;
grant execute on function public.capture_system_health_snapshot(boolean, integer, boolean, integer) to postgres;
grant execute on function public.read_system_health_snapshots(integer) to service_role;

notify pgrst, 'reload schema';
commit;
