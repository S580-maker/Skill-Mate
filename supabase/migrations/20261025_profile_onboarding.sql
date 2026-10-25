alter table public.profiles
  add column if not exists skills text[] not null default '{}',
  add column if not exists onboarding_completed boolean;

update public.profiles
set onboarding_completed = true
where onboarding_completed is null;

alter table public.profiles
  alter column onboarding_completed set default false,
  alter column onboarding_completed set not null;

grant update (skills, onboarding_completed, avatar_url) on public.profiles to authenticated;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, university, university_email, avatar_url)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
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
