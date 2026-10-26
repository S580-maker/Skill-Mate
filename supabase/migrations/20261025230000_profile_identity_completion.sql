create or replace function public.complete_profile_identity(
  p_university text,
  p_student_id_number text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Sign in to complete your profile.';
  end if;
  if char_length(btrim(coalesce(p_university, ''))) not between 2 and 120 then
    raise exception 'Enter a university or campus name between 2 and 120 characters.';
  end if;
  if char_length(btrim(coalesce(p_student_id_number, ''))) not between 3 and 80 then
    raise exception 'Enter a student ID number between 3 and 80 characters.';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_user_id and role = 'student'
  ) then
    raise exception 'Only student accounts can complete student profile details.';
  end if;

  update public.profiles
  set university = btrim(p_university)
  where id = v_user_id and role = 'student';

  insert into public.student_identifiers (student_id, university_name, student_id_number)
  values (v_user_id, btrim(p_university), btrim(p_student_id_number))
  on conflict (student_id) do update
    set university_name = excluded.university_name,
        student_id_number = excluded.student_id_number;
end;
$$;

revoke all on function public.complete_profile_identity(text, text) from public, anon;
grant execute on function public.complete_profile_identity(text, text) to authenticated;
