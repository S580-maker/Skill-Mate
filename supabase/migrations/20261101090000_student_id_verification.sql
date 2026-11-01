begin;

alter table public.verification_requests
  add column if not exists id_photo_path text;

update public.verification_requests
set status = 'dismissed', reviewed_at = now()
where status = 'open' and id_photo_path is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-verification-ids',
  'student-verification-ids',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Students upload their own verification IDs" on storage.objects;
create policy "Students upload their own verification IDs"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'student-verification-ids'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Students delete verification IDs without a pending review" on storage.objects;
create policy "Students delete verification IDs without a pending review"
on storage.objects for delete to authenticated
using (
  bucket_id = 'student-verification-ids'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.verification_requests request
    where request.id_photo_path = name and request.status = 'open'
  )
);

drop policy if exists "Admins read verification IDs" on storage.objects;
create policy "Admins read verification IDs"
on storage.objects for select to authenticated
using (
  bucket_id = 'student-verification-ids'
  and (select public.is_admin())
);

drop policy if exists "Admins delete verification IDs" on storage.objects;
create policy "Admins delete verification IDs"
on storage.objects for delete to authenticated
using (
  bucket_id = 'student-verification-ids'
  and (select public.is_admin())
);

drop policy if exists "Students submit verification requests" on public.verification_requests;
create policy "Students submit verification requests"
on public.verification_requests for insert to authenticated
with check (
  student_id = (select auth.uid())
  and status = 'open'
  and id_photo_path like ((select auth.uid())::text || '/%')
);

create or replace function public.review_verification_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.verification_requests;
begin
  if not (select public.is_admin()) then
    raise exception 'Administrator access is required.';
  end if;
  select * into v_request from public.verification_requests
  where id = p_request_id and status = 'open' for update;
  if not found then
    raise exception 'This verification request has already been reviewed.';
  end if;
  if p_approve and v_request.id_photo_path is null then
    raise exception 'A student ID photo is required before approving this request.';
  end if;
  update public.verification_requests
  set status = case when p_approve then 'resolved'::public.report_status else 'dismissed'::public.report_status end,
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;
  if p_approve then
    update public.profiles set campus_verified = true where id = v_request.student_id;
  end if;
end;
$$;

revoke all on function public.review_verification_request(uuid, boolean) from public, anon;
grant execute on function public.review_verification_request(uuid, boolean) to authenticated;

notify pgrst, 'reload schema';
commit;
