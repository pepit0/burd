-- Analytics: signup attribution, activity tracking, and admin signup notifications.

alter table public.profiles
  add column if not exists signup_platform text
    check (signup_platform in ('ios', 'android', 'web', 'unknown')),
  add column if not exists signup_method text
    check (signup_method in ('email', 'apple', 'google', 'unknown')),
  add column if not exists last_active_at timestamptz;

create index if not exists profiles_last_active_at_idx
  on public.profiles (last_active_at desc nulls last);

create index if not exists profiles_created_at_idx
  on public.profiles (created_at desc);

-- Record signup source from auth metadata and set initial activity timestamp.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_username text;
  colors text[] := array['#5f9470','#c8693a','#8a6e3a','#c8a03a','#7c6e9e','#3a7a8a','#6e7a3a'];
  meta_platform text;
  meta_method text;
begin
  chosen_username := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  chosen_username := regexp_replace(chosen_username, '^@+', '');
  chosen_username := regexp_replace(chosen_username, '[^a-z0-9_]', '', 'g');

  if chosen_username = '' or length(chosen_username) < 3 then
    chosen_username := regexp_replace(
      split_part(coalesce(new.email, 'birder'), '@', 1),
      '[^a-z0-9_]',
      '',
      'g'
    );
    if length(chosen_username) < 3 then
      chosen_username := 'birder';
    end if;
    chosen_username := chosen_username || '_' || substr(md5(random()::text), 1, 4);
  end if;

  while exists (select 1 from public.profiles where username = chosen_username) loop
    chosen_username := chosen_username || substr(md5(random()::text), 1, 2);
  end loop;

  meta_platform := lower(trim(coalesce(new.raw_user_meta_data->>'signup_platform', '')));
  if meta_platform not in ('ios', 'android', 'web') then
    meta_platform := 'unknown';
  end if;

  meta_method := lower(trim(coalesce(new.raw_user_meta_data->>'signup_method', '')));
  if meta_method not in ('email', 'apple', 'google') then
    -- Infer from auth provider when client didn't send metadata.
    if new.raw_app_meta_data ? 'provider' then
      meta_method := case lower(new.raw_app_meta_data->>'provider')
        when 'apple' then 'apple'
        when 'google' then 'google'
        else 'email'
      end;
    elsif new.raw_app_meta_data ? 'providers' then
      meta_method := case lower(new.raw_app_meta_data->'providers'->>0)
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

  insert into public.profiles (
    id,
    username,
    full_name,
    avatar_color,
    signup_platform,
    signup_method,
    last_active_at
  )
  values (
    new.id,
    chosen_username,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), chosen_username),
    colors[1 + floor(random() * array_length(colors, 1))::int],
    meta_platform,
    meta_method,
    now()
  );

  return new;
end;
$$;

-- Best-effort admin notification when a new auth user is created.
create or replace function public.enqueue_signup_notify()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_url text;
begin
  project_url := current_setting('app.settings.supabase_url', true);
  if project_url is null or project_url = '' then
    project_url := 'https://ldluootquzvmfvhpmcfx.supabase.co';
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/signup-notify',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('user_id', NEW.id)
  );

  return NEW;
exception when others then
  return NEW;
end;
$$;

drop trigger if exists trg_enqueue_signup_notify on auth.users;
create trigger trg_enqueue_signup_notify
  after insert on auth.users
  for each row execute function public.enqueue_signup_notify();

-- Client heartbeat for churn / retention reporting.
create or replace function public.touch_user_activity()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  update public.profiles
  set last_active_at = now()
  where id = auth.uid();
end;
$$;

grant execute on function public.touch_user_activity() to authenticated;

-- Backfill signup method for OAuth users where possible.
update public.profiles p
set signup_method = case
  when u.raw_app_meta_data->>'provider' = 'apple' then 'apple'
  when u.raw_app_meta_data->>'provider' = 'google' then 'google'
  else 'email'
end
from auth.users u
where p.id = u.id
  and p.signup_method is null;

update public.profiles
set signup_platform = 'unknown'
where signup_platform is null;

update public.profiles
set signup_method = coalesce(signup_method, 'unknown')
where signup_method is null;
