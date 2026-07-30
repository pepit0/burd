-- Verified + beta badges on profiles, with auto-beta for new signups.

alter table public.profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_beta boolean not null default true;

create table if not exists public.app_settings (
  id int primary key default 1 check (id = 1),
  auto_beta_badge_enabled boolean not null default true
);

insert into public.app_settings (id, auto_beta_badge_enabled)
values (1, true)
on conflict (id) do nothing;

-- Existing users get the beta badge.
update public.profiles
set is_beta = true
where is_beta is distinct from true;

alter table public.app_settings enable row level security;

drop policy if exists "Admins can read app settings" on public.app_settings;
create policy "Admins can read app settings"
  on public.app_settings for select
  using (public.is_admin());

drop policy if exists "Admins can update app settings" on public.app_settings;
create policy "Admins can update app settings"
  on public.app_settings for update
  using (public.is_admin())
  with check (public.is_admin());

create or replace function public.auto_beta_badge_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select s.auto_beta_badge_enabled from public.app_settings s where s.id = 1),
    true
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_username text;
  colors text[] := array['#5f9470','#c8693a','#8a6e3a','#c8a03a','#7c6e9e','#3a7a8a','#6e7a3a'];
  grant_beta boolean := true;
begin
  select public.auto_beta_badge_enabled() into grant_beta;

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

  insert into public.profiles (id, username, full_name, avatar_color, is_beta)
  values (
    new.id,
    chosen_username,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), chosen_username),
    colors[1 + floor(random() * array_length(colors, 1))::int],
    grant_beta
  );
  return new;
end;
$$;

create or replace function public.admin_update_user_badges(
  p_user_id uuid,
  p_is_verified boolean default null,
  p_is_beta boolean default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_verified boolean;
  next_beta boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select
    coalesce(p_is_verified, p.is_verified),
    coalesce(p_is_beta, p.is_beta)
  into next_verified, next_beta
  from public.profiles p
  where p.id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  update public.profiles
  set
    is_verified = next_verified,
    is_beta = next_beta
  where id = p_user_id;

  perform public.log_moderation_action(
    'update_user_badges',
    p_user_id,
    null,
    format(
      'Updated badges: verified=%s, beta=%s',
      case when next_verified then 'on' else 'off' end,
      case when next_beta then 'on' else 'off' end
    ),
    jsonb_build_object(
      'is_verified', next_verified,
      'is_beta', next_beta
    )
  );
end;
$$;

create or replace function public.admin_set_auto_beta_badge(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  insert into public.app_settings (id, auto_beta_badge_enabled)
  values (1, p_enabled)
  on conflict (id) do update
    set auto_beta_badge_enabled = excluded.auto_beta_badge_enabled;

  perform public.log_moderation_action(
    'set_auto_beta_badge',
    null,
    null,
    case
      when p_enabled then 'Auto beta badge enabled for new signups'
      else 'Auto beta badge disabled for new signups'
    end,
    jsonb_build_object('auto_beta_badge_enabled', p_enabled)
  );
end;
$$;

grant execute on function public.auto_beta_badge_enabled() to authenticated;
grant execute on function public.admin_update_user_badges(uuid, boolean, boolean) to authenticated;
grant execute on function public.admin_set_auto_beta_badge(boolean) to authenticated;

drop function if exists public.get_species_observers(text, text);

create or replace function public.get_species_observers(
  in_scientific_name text,
  in_common_name text
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  avatar_color text,
  avatar_url text,
  is_verified boolean,
  is_beta boolean,
  first_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.username,
    p.full_name,
    p.avatar_color,
    p.avatar_url,
    p.is_verified,
    p.is_beta,
    min(coalesce(s.observed_at, s.created_at)) as first_seen_at
  from public.sightings s
  join public.profiles p on p.id = s.user_id
  where s.removed_at is null
    and (
      lower(trim(coalesce(s.scientific_name, ''))) = lower(trim(in_scientific_name))
      or lower(trim(s.species)) = lower(trim(in_common_name))
    )
  group by p.id, p.username, p.full_name, p.avatar_color, p.avatar_url, p.is_verified, p.is_beta
  order by first_seen_at asc;
$$;

grant execute on function public.get_species_observers(text, text) to authenticated;

-- Allow new moderation log action types.
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
      'set_auto_beta_badge'
    )
  );

-- Repair sighting_feed if a prior partial run of this migration dropped the view.
do $repair$
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'sighting_feed'
      and c.relkind = 'v'
  ) then
    return;
  end if;

  drop function if exists public.nearby_sightings(double precision, double precision, double precision);
  drop function if exists public.following_feed();

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sightings'
      and column_name = 'public_latitude'
  ) and exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_view_sighting'
  ) then
    execute $view$
      create view public.sighting_feed
      with (security_invoker = on) as
      select
        s.id, s.user_id, s.species, s.scientific_name, s.location_name,
        coalesce(s.public_latitude, s.latitude) as latitude,
        coalesce(s.public_longitude, s.longitude) as longitude,
        s.rarity, s.count, s.notes, s.photo_url, s.created_at,
        p.username, p.avatar_color, p.avatar_url, p.full_name,
        coalesce(l.like_count, 0) as like_count,
        s.confidence, s.detected_by,
        s.observed_at, s.location_city, s.location_address,
        s.author_disqualified,
        s.audio_url,
        s.published_at,
        s.visibility,
        s.public_latitude,
        s.public_longitude,
        s.location_obscured_reason
      from public.sightings s
      join public.profiles p on p.id = s.user_id
      left join (
        select sighting_id, count(*)::int as like_count
        from public.likes group by sighting_id
      ) l on l.sighting_id = s.id
      where s.removed_at is null
        and s.published_at is not null
        and public.can_view_sighting(
          auth.uid(),
          s.user_id,
          s.visibility,
          s.published_at
        )
    $view$;
  else
    execute $view$
      create view public.sighting_feed
      with (security_invoker = on) as
      select
        s.id, s.user_id, s.species, s.scientific_name, s.location_name,
        s.latitude, s.longitude, s.rarity, s.count, s.notes, s.photo_url, s.created_at,
        p.username, p.avatar_color, p.full_name, p.avatar_url,
        coalesce(l.like_count, 0) as like_count,
        s.confidence, s.detected_by,
        s.observed_at, s.location_city, s.location_address,
        s.author_disqualified,
        s.audio_url,
        s.published_at
      from public.sightings s
      join public.profiles p on p.id = s.user_id
      left join (
        select sighting_id, count(*)::int as like_count
        from public.likes group by sighting_id
      ) l on l.sighting_id = s.id
      where s.removed_at is null
        and s.published_at is not null
    $view$;
  end if;

  execute $fn$
    create or replace function public.nearby_sightings(
      in_lat double precision,
      in_lng double precision,
      in_radius_km double precision
    )
    returns setof public.sighting_feed
    language sql stable security invoker
    as $body$
      select f.*
      from public.sighting_feed f
      where f.latitude is not null
        and f.longitude is not null
        and (
          in_radius_km is null
          or public.km_between(in_lat, in_lng, f.latitude, f.longitude) <= in_radius_km
        )
      order by f.published_at desc
      limit 100;
    $body$;
  $fn$;

  execute $fn$
    create or replace function public.following_feed()
    returns setof public.sighting_feed
    language sql stable security invoker
    as $body$
      select f.*
      from public.sighting_feed f
      where f.user_id = auth.uid()
         or f.user_id in (select public.friend_ids())
      order by f.published_at desc
      limit 100;
    $body$;
  $fn$;
end
$repair$;
