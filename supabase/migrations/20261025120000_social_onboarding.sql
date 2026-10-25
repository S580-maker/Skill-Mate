alter table public.profiles
  add column if not exists skills text[] not null default '{}',
  add column if not exists onboarding_completed boolean;

update public.profiles
set onboarding_completed = true
where onboarding_completed is null;

alter table public.profiles
  alter column onboarding_completed set default false,
  alter column onboarding_completed set not null;

grant update (full_name, university, skills, onboarding_completed, avatar_url) on table public.profiles to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 80), ''),
    nullif(left(split_part(coalesce(new.email, ''), '@', 1), 80), ''),
    'Student'
  );

  insert into public.profiles (id, full_name, university, university_email, avatar_url)
  values (
    new.id,
    v_full_name,
    coalesce(new.raw_user_meta_data ->> 'university', ''),
    new.email,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  if char_length(btrim(coalesce(new.raw_user_meta_data ->> 'university', ''))) between 2 and 120
    and char_length(btrim(coalesce(new.raw_user_meta_data ->> 'student_id_number', ''))) between 3 and 80 then
    insert into public.student_identifiers (student_id, university_name, student_id_number)
    values (
      new.id,
      btrim(new.raw_user_meta_data ->> 'university'),
      btrim(new.raw_user_meta_data ->> 'student_id_number')
    );
  end if;
  return new;
end;
$$;

create or replace function public.complete_social_onboarding(
  p_full_name text,
  p_university text,
  p_student_id_number text,
  p_skills text[] default '{}',
  p_avatar_url text default null
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
    raise exception 'Sign in to finish creating your profile.';
  end if;
  if char_length(btrim(coalesce(p_full_name, ''))) not between 2 and 80 then
    raise exception 'Enter a name between 2 and 80 characters.';
  end if;
  if char_length(btrim(coalesce(p_university, ''))) not between 2 and 120 then
    raise exception 'Enter a university or campus name between 2 and 120 characters.';
  end if;
  if char_length(btrim(coalesce(p_student_id_number, ''))) not between 3 and 80 then
    raise exception 'Enter a student ID number between 3 and 80 characters.';
  end if;
  if cardinality(coalesce(p_skills, array[]::text[])) > 10
    or exists (
      select 1
      from unnest(coalesce(p_skills, array[]::text[])) as selected_skill(skill)
      where char_length(btrim(coalesce(skill, ''))) not between 1 and 40
    ) then
    raise exception 'Choose up to 10 skills, each between 1 and 40 characters.';
  end if;

  update public.profiles
  set full_name = btrim(p_full_name),
      university = btrim(p_university),
      skills = coalesce(p_skills, array[]::text[]),
      avatar_url = p_avatar_url,
      onboarding_completed = true
  where id = v_user_id
    and role = 'student'
    and onboarding_completed = false;

  if not found then
    raise exception 'This profile is not awaiting social sign-up details.';
  end if;

  insert into public.student_identifiers (student_id, university_name, student_id_number)
  values (v_user_id, btrim(p_university), btrim(p_student_id_number))
  on conflict (student_id) do update
    set university_name = excluded.university_name,
        student_id_number = excluded.student_id_number;
end;
$$;

revoke all on function public.complete_social_onboarding(text, text, text, text[], text) from public, anon;
grant execute on function public.complete_social_onboarding(text, text, text, text[], text) to authenticated;
