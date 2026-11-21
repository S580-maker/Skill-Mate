begin;

alter table public.profiles
  add column if not exists moderation_status text not null default 'active'
    check (moderation_status in ('active', 'suspended', 'banned')),
  add column if not exists moderation_until timestamptz,
  add column if not exists moderation_reason text not null default '';

create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references public.reports(id) on delete set null,
  reported_user_id uuid not null references public.profiles(id) on delete restrict,
  admin_id uuid not null references public.profiles(id) on delete restrict,
  action_type text not null check (action_type in ('warning', 'suspension', 'ban', 'restore')),
  reason text not null check (char_length(reason) between 5 and 1000),
  message text not null check (char_length(message) between 5 and 500),
  moderation_until timestamptz,
  auth_ban_applied boolean,
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_created_idx
  on public.moderation_actions(created_at desc);
create index if not exists moderation_actions_user_created_idx
  on public.moderation_actions(reported_user_id, created_at desc);

alter table public.moderation_actions enable row level security;
revoke all on table public.moderation_actions from public, anon, authenticated;
grant select on table public.moderation_actions to authenticated;
grant select, insert, update, delete on table public.moderation_actions to service_role;
create policy "Admins read moderation history"
  on public.moderation_actions for select to authenticated
  using ((select public.is_admin()));

create or replace function public.is_verified_session()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session_id text := auth.jwt() ->> 'session_id';
begin
  if auth.uid() is null
    or v_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1
    from public.verified_auth_sessions verified
    where verified.session_id = v_session_id::uuid
      and verified.user_id = auth.uid()
      and verified.expires_at > now()
  ) and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and (
        profile.moderation_status = 'active'
        or (profile.moderation_status = 'suspended' and profile.moderation_until <= now())
      )
  );
end;
$$;

create or replace function public.is_moderated_verified_session()
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_session_id text := auth.jwt() ->> 'session_id';
begin
  if auth.uid() is null
    or v_session_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return false;
  end if;
  return exists (
    select 1
    from public.verified_auth_sessions verified
    join public.profiles profile on profile.id = verified.user_id
    where verified.session_id = v_session_id::uuid
      and verified.user_id = auth.uid()
      and verified.expires_at > now()
      and (
        profile.moderation_status = 'banned'
        or (profile.moderation_status = 'suspended' and profile.moderation_until > now())
      )
  );
end;
$$;

revoke all on function public.is_moderated_verified_session() from public, anon;
grant execute on function public.is_moderated_verified_session() to authenticated;

drop policy if exists "OTP verified sessions only" on public.notifications;
create policy "Verified users can read their moderation notices"
  on public.notifications as restrictive for all to authenticated
  using (public.is_verified_session() or public.is_moderated_verified_session())
  with check (public.is_verified_session() or public.is_moderated_verified_session());

create or replace function public.issue_moderation_action(
  p_report_id uuid,
  p_action text,
  p_reported_user_id uuid,
  p_reason text,
  p_message text
)
returns public.moderation_actions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin_id uuid := auth.uid();
  v_report public.reports;
  v_profile public.profiles;
  v_until timestamptz;
  v_action public.moderation_actions;
  v_title text;
  v_body text;
begin
  if v_admin_id is null or not public.is_verified_session() or not public.is_admin() then
    raise exception 'Verified administrator access is required.';
  end if;
  if p_action is null or p_action not in ('warning', 'suspension', 'ban', 'restore') then
    raise exception 'Choose a valid moderation action.';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 5 and 1000 then
    raise exception 'Enter a reason between 5 and 1000 characters.';
  end if;
  if p_message is null or char_length(btrim(p_message)) not between 5 and 450 then
    raise exception 'Enter a message between 5 and 450 characters.';
  end if;

  select * into v_profile
  from public.profiles
  where id = p_reported_user_id
  for update;
  if not found or v_profile.role = 'admin' or p_reported_user_id = v_admin_id then
    raise exception 'This account cannot be moderated from a community report.';
  end if;

  if p_action = 'restore' then
    if not exists (
      select 1
      from public.moderation_actions
      where reported_user_id = p_reported_user_id
        and (
          (action_type in ('suspension', 'ban') and v_profile.moderation_status in ('suspended', 'banned'))
          or (action_type = 'restore' and auth_ban_applied is false)
        )
    ) then
      raise exception 'This account has no active moderation restriction to restore.';
    end if;
    if p_report_id is not null then
      raise exception 'Account restoration does not use a report.';
    end if;
    update public.profiles
    set moderation_status = 'active', moderation_until = null, moderation_reason = '',
        updated_at = now()
    where id = p_reported_user_id;
    v_title := 'Your Skillmate account has been restored';
  else
    if p_report_id is null then
      raise exception 'A community report is required for this action.';
    end if;
    select * into v_report
    from public.reports
    where id = p_report_id and status = 'open'
    for update;
    if not found or v_report.reported_user_id <> p_reported_user_id then
      raise exception 'This report is no longer open or its reported account does not match.';
    end if;
    if v_profile.moderation_status = 'banned' then
      raise exception 'This account is already banned. Restore it before taking another action.';
    end if;

    if p_action = 'suspension' then
      v_until := now() + interval '7 days';
      update public.profiles
      set moderation_status = 'suspended', moderation_until = v_until,
          moderation_reason = btrim(p_reason), updated_at = now()
      where id = p_reported_user_id;
      v_title := 'Your Skillmate account is temporarily suspended';
    elsif p_action = 'ban' then
      update public.profiles
      set moderation_status = 'banned', moderation_until = null,
          moderation_reason = btrim(p_reason), updated_at = now()
      where id = p_reported_user_id;
      v_title := 'Your Skillmate account has been banned';
    else
      v_title := 'Official Skillmate account warning';
    end if;

    update public.reports
    set status = 'resolved', resolved_by = v_admin_id, resolved_at = now(),
        admin_notes = btrim(p_reason)
    where id = p_report_id;
  end if;

  insert into public.moderation_actions (
    report_id, reported_user_id, admin_id, action_type, reason, message, moderation_until, auth_ban_applied
  ) values (
    p_report_id, p_reported_user_id, v_admin_id, p_action,
    btrim(p_reason), btrim(p_message), v_until,
    case when p_action = 'warning' then null else false end
  )
  returning * into v_action;

  v_body := 'Official Skillmate Trust & Safety notice. ' || btrim(p_message);
  if char_length(v_body) > 500 then
    raise exception 'The message is too long to deliver as a notification.';
  end if;
  insert into public.notifications (user_id, kind, title, body, target_path)
  values (p_reported_user_id, 'moderation', v_title, v_body, 'moderation');

  return v_action;
end;
$$;

revoke all on function public.issue_moderation_action(uuid, text, uuid, text, text) from public, anon;
grant execute on function public.issue_moderation_action(uuid, text, uuid, text, text) to authenticated;

commit;
