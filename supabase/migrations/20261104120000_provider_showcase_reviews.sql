begin;

alter table public.profiles
  add column if not exists cv_path text,
  add column if not exists cv_name text;

alter table public.profiles
  add constraint profiles_cv_metadata_check
  check (
    (cv_path is null and cv_name is null)
    or (
      cv_path is not null
      and cv_name is not null
      and cv_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.pdf$'
      and char_length(cv_name) between 1 and 120
    )
  );

grant update (cv_path, cv_name) on public.profiles to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('provider-cvs', 'provider-cvs', false, 5242880, array['application/pdf'])
on conflict (id) do update
set public = false, file_size_limit = 5242880, allowed_mime_types = array['application/pdf'];

create policy "Signed-in students can read provider CVs"
on storage.objects for select to authenticated
using (bucket_id = 'provider-cvs');

create policy "Providers upload their own CV"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'provider-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Providers replace their own CV"
on storage.objects for update to authenticated
using (
  bucket_id = 'provider-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'provider-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Providers delete their own CV"
on storage.objects for delete to authenticated
using (
  bucket_id = 'provider-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

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
   where b.provider_id = p.id and b.status = 'completed') as completed_bookings
from public.profiles p
join public.services s on s.provider_id = p.id
where s.is_active and public.is_verified_session()
  and not public.is_blocked_between(p.id);

create function public.require_customer_reviews_before_booking()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.customer_id = auth.uid() and exists (
    select 1
    from public.bookings b
    where b.customer_id = new.customer_id
      and b.status = 'completed'
      and not exists (
        select 1 from public.reviews r where r.booking_id = b.id
      )
  ) then
    raise exception 'Please review your completed work before requesting another booking.';
  end if;
  return new;
end;
$$;

create trigger bookings_require_completed_work_review
before insert on public.bookings
for each row execute function public.require_customer_reviews_before_booking();

revoke all on function public.require_customer_reviews_before_booking() from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
