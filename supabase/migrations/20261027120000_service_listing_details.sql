-- Approved local migration. Apply through the project's normal migration process.
begin;
alter table public.services
  add column if not exists cover_image_path text,
  add column if not exists delivery_method text,
  add column if not exists estimated_delivery text,
  add column if not exists price_type text not null default 'fixed';

alter table public.services
  add constraint services_delivery_method_check check (delivery_method in ('online', 'in_person', 'both')),
  add constraint services_estimated_delivery_check check (char_length(estimated_delivery) <= 80),
  add constraint services_price_type_check check (price_type in ('fixed', 'starting')),
  add constraint services_cover_path_check check (
    cover_image_path is null or (
      split_part(cover_image_path, '/', 1) = provider_id::text
      and cover_image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
    )
  );

-- Append public listing metadata; keep the existing filters, grants and view security mode.
create or replace view public.provider_directory
with (security_invoker = false)
as select
  p.id as provider_id, p.full_name, p.university, p.course, p.bio,
  p.avatar_url, p.campus_verified,
  s.id as service_id, s.title as service_title, s.category,
  s.description as service_description, s.price, s.currency,
  s.accepts_groups, s.created_at as service_created_at,
  s.cover_image_path, s.delivery_method, s.estimated_delivery, s.price_type
from public.profiles p
join public.services s on s.provider_id = p.id
where s.is_active and not public.is_blocked_between(p.id);

-- Listing covers are public marketing images. Never use this bucket for private files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('service-covers', 'service-covers', true, 5000000,
  array['image/jpeg', 'image/png', 'image/webp']);

create policy "Students upload their own service covers"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'service-covers'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
);
create policy "Students delete their own service covers"
on storage.objects for delete to authenticated
using (bucket_id = 'service-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Students inspect their own service covers"
on storage.objects for select to authenticated
using (bucket_id = 'service-covers' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
