-- Defer public.profiles + admin signup notify until email is confirmed (email signups)
-- and the user picks a display name + @username.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Profile + signup notification are created in complete_user_onboarding().
  return new;
end;
$$;

drop trigger if exists trg_enqueue_signup_notify on auth.users;

create or replace function public.enqueue_signup_notify_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_url text;
begin
  if p_user_id is null then
    return;
  end if;

  project_url := current_setting('app.settings.supabase_url', true);
  if project_url is null or project_url = '' then
    project_url := 'https://ldluootquzvmfvhpmcfx.supabase.co';
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/signup-notify',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('user_id', p_user_id)
  );
exception when others then
  return;
end;
$$;

create or replace function public.complete_user_onboarding(
  p_username text,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  uid uuid := auth.uid();
  u record;
  cleaned_username text;
  cleaned_name text;
  colors text[] := array['#5f9470','#c8693a','#8a6e3a','#c8a03a','#7c6e9e','#3a7a8a','#6e7a3a'];
  grant_beta boolean := true;
  meta_platform text;
  meta_method text;
  avatar_color text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into u from auth.users where id = uid;
  if not found then
    raise exception 'User not found';
  end if;

  cleaned_username := lower(trim(coalesce(p_username, '')));
  cleaned_username := regexp_replace(cleaned_username, '^@+', '');
  cleaned_username := regexp_replace(cleaned_username, '[^a-z0-9_]', '', 'g');

  if cleaned_username = '' or cleaned_username !~ '^[a-z][a-z0-9_]{2,29}$' then
    raise exception 'Usernames must be 3–30 characters, start with a letter, and use only letters, numbers, and underscores.';
  end if;

  cleaned_name := trim(regexp_replace(coalesce(p_display_name, ''), '\s+', ' ', 'g'));
  if cleaned_name = '' then
    raise exception 'Choose a display name.';
  end if;
  if char_length(cleaned_name) > 60 then
    raise exception 'Display names must be 60 characters or fewer.';
  end if;

  if exists (
    select 1
    from public.profiles p
    where lower(p.username) = cleaned_username
      and p.id <> uid
  ) then
    raise exception 'This username is already taken. Try another.';
  end if;

  meta_platform := lower(trim(coalesce(u.raw_user_meta_data->>'signup_platform', '')));
  if meta_platform not in ('ios', 'android', 'web') then
    meta_platform := 'unknown';
  end if;

  meta_method := lower(trim(coalesce(u.raw_user_meta_data->>'signup_method', '')));
  if meta_method not in ('email', 'apple', 'google') then
    if u.raw_app_meta_data ? 'provider' then
      meta_method := case lower(u.raw_app_meta_data->>'provider')
        when 'apple' then 'apple'
        when 'google' then 'google'
        else 'email'
      end;
    elsif u.raw_app_meta_data ? 'providers' then
      meta_method := case lower(u.raw_app_meta_data->'providers'->>0)
        when 'apple' then 'apple'
        when 'google' then 'google'
        else 'email'
      end;
    else
      meta_method := 'email';
    end if;
  end if;

  if meta_platform = 'unknown' and meta_method = 'apple' then
    meta_platform := 'ios';
  end if;

  if meta_method = 'email' and u.email_confirmed_at is null then
    raise exception 'Confirm your email before finishing signup.';
  end if;

  select public.auto_beta_badge_enabled() into grant_beta;
  avatar_color := colors[1 + floor(random() * array_length(colors, 1))::int];

  if exists (select 1 from public.profiles where id = uid) then
    update public.profiles
    set
      username = cleaned_username,
      full_name = cleaned_name,
      signup_platform = coalesce(signup_platform, meta_platform),
      signup_method = coalesce(signup_method, meta_method),
      last_active_at = coalesce(last_active_at, now())
    where id = uid;
  else
    insert into public.profiles (
      id,
      username,
      full_name,
      avatar_color,
      is_beta,
      signup_platform,
      signup_method,
      last_active_at
    )
    values (
      uid,
      cleaned_username,
      cleaned_name,
      avatar_color,
      grant_beta,
      meta_platform,
      meta_method,
      now()
    );
  end if;

  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
    'username', cleaned_username,
    'username_chosen', true,
    'full_name', cleaned_name
  )
  where id = uid;

  perform public.enqueue_signup_notify_for_user(uid);
end;
$$;

grant execute on function public.complete_user_onboarding(text, text) to authenticated;
