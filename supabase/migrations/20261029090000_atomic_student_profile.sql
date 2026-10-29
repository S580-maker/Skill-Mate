begin;

-- Public profile, private student details and booking location save together.
create or replace function public.save_student_profile(
  p_full_name text,
  p_university text,
  p_bio text,
  p_location text default '',
  p_student_id_number text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_profile public.profiles;
  v_student_id text := btrim(coalesce(p_student_id_number, ''));
  v_location text := btrim(coalesce(p_location, ''));
begin
  if v_user_id is null then raise exception 'Sign in to update your profile.'; end if;
  select * into v_profile from public.profiles where id = v_user_id;
  if not found then raise exception 'Your profile no longer exists.'; end if;
  if char_length(v_location) > 120 then
    raise exception 'Use a campus or hostel name up to 120 characters.';
  end if;
  if v_student_id <> '' and char_length(v_student_id) not between 3 and 80 then
    raise exception 'Use a student ID between 3 and 80 characters.';
  end if;
  if v_student_id <> '' and v_profile.role <> 'student' then
    raise exception 'Only student accounts can update student ID details.';
  end if;

  perform public.save_account_profile(
    p_full_name, p_university, p_bio, v_profile.phone_number, v_profile.avatar_url
  );

  if v_student_id <> '' then
    insert into public.student_identifiers (student_id, university_name, student_id_number)
    values (v_user_id, btrim(p_university), v_student_id)
    on conflict (student_id) do update
      set university_name = excluded.university_name,
          student_id_number = excluded.student_id_number;
  end if;

  if v_location <> '' then
    insert into public.user_locations (user_id, location_name)
    values (v_user_id, v_location)
    on conflict (user_id) do update set location_name = excluded.location_name;
  else
    delete from public.user_locations where user_id = v_user_id;
  end if;
end;
$$;

revoke all on function public.save_student_profile(text, text, text, text, text) from public, anon;
grant execute on function public.save_student_profile(text, text, text, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;
