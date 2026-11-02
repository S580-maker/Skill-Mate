begin;

do $$
declare
  app_table record;
begin
  for app_table in
    select namespace.nspname, relation.relname, relation.relrowsecurity
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
  loop
    if not app_table.relrowsecurity then
      execute format(
        'alter table %I.%I enable row level security',
        app_table.nspname,
        app_table.relname
      );
    end if;
    execute format(
      'drop policy if exists %I on %I.%I',
      'OTP verified sessions only',
      app_table.nspname,
      app_table.relname
    );
    execute format(
      'create policy %I on %I.%I as restrictive for all to authenticated using (public.is_verified_session()) with check (public.is_verified_session())',
      'OTP verified sessions only',
      app_table.nspname,
      app_table.relname
    );
  end loop;
end;
$$;

drop policy if exists "OTP verified sessions only" on storage.objects;
create policy "OTP verified sessions only"
on storage.objects as restrictive for all to authenticated
using (
  bucket_id not in (
    'portfolio-images', 'profile-avatars', 'support-screenshots',
    'service-covers', 'student-verification-ids', 'provider-cvs'
  )
  or public.is_verified_session()
)
with check (
  bucket_id not in (
    'portfolio-images', 'profile-avatars', 'support-screenshots',
    'service-covers', 'student-verification-ids', 'provider-cvs'
  )
  or public.is_verified_session()
);

revoke all privileges on schema public from public, anon;
grant usage on schema public to authenticated, service_role;
revoke all privileges on all tables in schema public from public, anon;
revoke all privileges on all sequences in schema public from public, anon;
revoke execute on all functions in schema public from public, anon;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from public, anon;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from public, anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('portfolio-images', 'portfolio-images', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('profile-avatars', 'profile-avatars', true, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('support-screenshots', 'support-screenshots', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('service-covers', 'service-covers', true, 5000000,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('student-verification-ids', 'student-verification-ids', false, 5242880,
    array['image/jpeg', 'image/png', 'image/webp']),
  ('provider-cvs', 'provider-cvs', false, 5242880,
    array['application/pdf'])
on conflict (id) do update
set name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
commit;
