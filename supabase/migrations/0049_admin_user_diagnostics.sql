-- Admin support: look up auth + profile onboarding state and reset stuck signups.

alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_check;

alter table public.moderation_actions
  add constraint moderation_actions_action_check
  check (
    action in (
      'remove_post',
      'edit_post',
      'suspend_user',
      'unsuspend_user',
      'grant_admin',
      'revoke_admin',
      'remove_field_guide_author',
      'change_username',
      'update_user_badges',
      'set_auto_beta_badge',
      'reset_user_onboarding'
    )
  );

create or replace function public.admin_user_diagnostics_row(
  u auth.users,
  p public.profiles
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  username_chosen_raw text := u.raw_user_meta_data->>'username_chosen';
  has_profile boolean := p.id is not null;
  profile_username text := p.username;
  issue text;
  issue_label text;
  can_reset boolean;
begin
  if coalesce(username_chosen_raw, 'false') = 'true' and not has_profile then
    issue := 'missing_profile';
    issue_label := 'Marked onboarding complete but no profile exists';
    can_reset := true;
  elsif not has_profile then
    issue := 'pending_onboarding';
    issue_label := 'No profile — user has not finished signup';
    can_reset := true;
  elsif coalesce(username_chosen_raw, 'false') <> 'true'
    and profile_username ~* '^birder(_[a-f0-9]{4})?$' then
    issue := 'auto_profile';
    issue_label := 'Placeholder profile — username not chosen';
    can_reset := true;
  elsif coalesce(username_chosen_raw, 'false') <> 'true' then
    issue := 'pending_onboarding';
    issue_label := 'Username not marked as chosen';
    can_reset := true;
  else
    issue := 'ok';
    issue_label := 'Onboarding looks complete';
    can_reset := false;
  end if;

  return jsonb_build_object(
    'user_id', u.id,
    'email', u.email,
    'email_confirmed', u.email_confirmed_at is not null,
    'email_confirmed_at', u.email_confirmed_at,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'username_chosen', username_chosen_raw,
    'signup_method', u.raw_user_meta_data->>'signup_method',
    'signup_platform', u.raw_user_meta_data->>'signup_platform',
    'has_profile', has_profile,
    'profile_username', profile_username,
    'profile_full_name', p.full_name,
    'issue', issue,
    'issue_label', issue_label,
    'can_reset_onboarding', can_reset
  );
end;
$$;

create or replace function public.admin_lookup_user_diagnostics(p_query text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  q text := lower(trim(coalesce(p_query, '')));
  q_at text;
  result jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if q = '' then
    return result;
  end if;

  q_at := regexp_replace(q, '^@+', '');

  select coalesce(
    jsonb_agg(public.admin_user_diagnostics_row(u, p) order by u.created_at desc),
    '[]'::jsonb
  )
  into result
  from auth.users u
  left join public.profiles p on p.id = u.id
  where lower(coalesce(u.email, '')) like '%' || q || '%'
     or lower(coalesce(p.username, '')) like '%' || q_at || '%'
     or lower(coalesce(p.full_name, '')) like '%' || q || '%'
  limit 20;

  return result;
end;
$$;

create or replace function public.admin_get_user_diagnostics(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  u auth.users%rowtype;
  p public.profiles%rowtype;
  has_profile boolean := false;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into u from auth.users where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  select * into p from public.profiles where id = p_user_id;
  has_profile := found;

  if not has_profile then
    p.id := null;
  end if;

  return public.admin_user_diagnostics_row(u, p);
end;
$$;

create or replace function public.admin_reset_user_onboarding(
  p_user_id uuid,
  p_force boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  u auth.users%rowtype;
  p public.profiles%rowtype;
  before_state jsonb;
  profile_exists boolean := false;
  username_chosen_raw text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_user_id is null then
    raise exception 'User id required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Cannot reset your own onboarding';
  end if;

  select * into u from auth.users where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  username_chosen_raw := u.raw_user_meta_data->>'username_chosen';

  select * into p from public.profiles where id = p_user_id;
  profile_exists := found;
  if not profile_exists then
    p.id := null;
  end if;

  before_state := public.admin_user_diagnostics_row(u, p);

  if not p_force and not coalesce((before_state->>'can_reset_onboarding')::boolean, false) then
    raise exception 'This account completed onboarding. Use force reset if you are sure.';
  end if;

  insert into public.moderation_actions (
    actor_id,
    action,
    target_user_id,
    reason,
    metadata
  )
  values (
    auth.uid(),
    'reset_user_onboarding',
    case when profile_exists then p_user_id else null end,
    case
      when p_force then 'Force reset onboarding (support)'
      else 'Reset onboarding (support)'
    end,
    jsonb_build_object(
      'target_user_id', p_user_id,
      'force', p_force,
      'before', before_state
    )
  );

  update auth.users
  set raw_user_meta_data =
    coalesce(raw_user_meta_data, '{}'::jsonb)
    - 'username'
    || jsonb_build_object('username_chosen', false)
  where id = p_user_id;

  if p_force then
    delete from public.profiles where id = p_user_id;
  elsif profile_exists then
    delete from public.profiles prof
    where prof.id = p_user_id
      and (
        lower(prof.username) ~ '^birder(_[a-f0-9]{4})?$'
        or coalesce(username_chosen_raw, 'false') <> 'true'
      );
  end if;

  select * into u from auth.users where id = p_user_id;

  select * into p from public.profiles where id = p_user_id;
  profile_exists := found;
  if not profile_exists then
    p.id := null;
  end if;

  return public.admin_user_diagnostics_row(u, p);
end;
$$;

grant execute on function public.admin_lookup_user_diagnostics(text) to authenticated;
grant execute on function public.admin_get_user_diagnostics(uuid) to authenticated;
grant execute on function public.admin_reset_user_onboarding(uuid, boolean) to authenticated;
