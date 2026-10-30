begin;

create table if not exists public.auth_login_challenges (
  challenge_hash text primary key,
  code_hash text not null,
  email text not null,
  session_data jsonb not null,
  expires_at timestamptz not null,
  last_sent_at timestamptz not null,
  attempts smallint not null default 0 check (attempts between 0 and 5),
  resend_count smallint not null default 0 check (resend_count between 0 and 5)
);

alter table public.auth_login_challenges
  add column if not exists resend_count smallint not null default 0
  check (resend_count between 0 and 5);

create index if not exists auth_login_challenges_expiry_idx
  on public.auth_login_challenges (expires_at);
create index if not exists auth_login_challenges_email_idx
  on public.auth_login_challenges (email, last_sent_at desc);

alter table public.auth_login_challenges enable row level security;
revoke all on table public.auth_login_challenges from public, anon, authenticated;

create or replace function public.consume_email_login_challenge(
  p_challenge_hash text,
  p_code_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenge public.auth_login_challenges;
begin
  select * into v_challenge
  from public.auth_login_challenges
  where challenge_hash = p_challenge_hash
  for update;

  if not found then return jsonb_build_object('status', 'invalid'); end if;
  if v_challenge.expires_at <= now() then
    delete from public.auth_login_challenges where challenge_hash = p_challenge_hash;
    return jsonb_build_object('status', 'expired');
  end if;
  if v_challenge.attempts >= 5 then
    delete from public.auth_login_challenges where challenge_hash = p_challenge_hash;
    return jsonb_build_object('status', 'locked');
  end if;
  if v_challenge.code_hash <> p_code_hash then
    update public.auth_login_challenges
    set attempts = attempts + 1
    where challenge_hash = p_challenge_hash;
    return jsonb_build_object('status', 'invalid');
  end if;

  delete from public.auth_login_challenges where challenge_hash = p_challenge_hash;
  return jsonb_build_object('status', 'verified', 'session', v_challenge.session_data);
end;
$$;

revoke all on function public.consume_email_login_challenge(text, text) from public, anon, authenticated;
grant execute on function public.consume_email_login_challenge(text, text) to service_role;

notify pgrst, 'reload schema';
commit;