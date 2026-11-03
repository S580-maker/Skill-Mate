create or replace view public.provider_directory
with (security_invoker = false)
as
select
  p.id as provider_id,
  p.full_name,
  p.university,
  p.course,
  p.bio,
  p.avatar_url,
  p.campus_verified,
  s.id as service_id,
  s.title as service_title,
  s.category,
  s.description as service_description,
  s.price,
  s.currency,
  s.accepts_groups,
  s.created_at as service_created_at
from public.profiles p
join public.services s on s.provider_id = p.id
where s.is_active
  and not public.is_blocked_between(p.id);

revoke all privileges on public.provider_directory from anon, public;
grant select on public.provider_directory to authenticated;
