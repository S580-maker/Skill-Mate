-- Apply after 20261026140000_profile_settings_and_support.sql.
-- Keep private identity and verification consistent for every campus update.
create or replace function public.sync_profile_campus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.university is distinct from old.university then
    if char_length(btrim(new.university)) not between 2 and 120 then
      raise exception 'Enter a university between 2 and 120 characters.';
    end if;
    update public.student_identifiers
    set university_name = btrim(new.university) where student_id = new.id;
    update public.profiles set campus_verified = false, university_email = null
    where id = new.id;
    update public.verification_requests
    set status = 'dismissed', reviewed_at = now()
    where student_id = new.id and status in ('open', 'reviewing');
  end if;
  return new;
end;
$$;

revoke all on function public.sync_profile_campus() from public, anon, authenticated;
drop trigger if exists sync_profile_campus on public.profiles;
create trigger sync_profile_campus after update of university on public.profiles
for each row execute function public.sync_profile_campus();

create or replace function public.save_account_profile(
  p_full_name text, p_university text, p_bio text,
  p_phone_number text, p_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to update your profile.'; end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 80
    or char_length(btrim(coalesce(p_university, ''))) not between 2 and 120
    or char_length(coalesce(p_bio, '')) > 500
    or char_length(coalesce(p_phone_number, '')) > 32 then
    raise exception 'Check the name, university, bio and phone number lengths.';
  end if;
  update public.profiles
  set full_name = btrim(p_full_name), university = btrim(p_university),
      bio = coalesce(p_bio, ''), phone_number = coalesce(p_phone_number, ''),
      avatar_url = p_avatar_url
  where id = auth.uid();
  if not found then raise exception 'Your profile no longer exists.'; end if;
end;
$$;

revoke all on function public.save_account_profile(text, text, text, text, text) from public, anon;
grant execute on function public.save_account_profile(text, text, text, text, text) to authenticated;

drop policy if exists "Students delete their unused support screenshots" on storage.objects;
create policy "Students delete their unused support screenshots"
on storage.objects for delete to authenticated
using (
  bucket_id = 'support-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (
    select 1 from public.support_tickets ticket
    where ticket.user_id = (select auth.uid()) and ticket.screenshot_url = name
  )
);

notify pgrst, 'reload schema';
