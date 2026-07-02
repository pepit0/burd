-- Admin roles, account suspension, post soft removal, and moderation RPCs.

-- ------------------------------------------------------------
-- Extend activity_type enum
-- ------------------------------------------------------------
do $$ begin
  alter type public.activity_type add value 'moderation';
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- Profiles: admin role + suspension
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists role text not null default 'user',
  add column if not exists suspended boolean not null default false,
  add column if not exists suspended_until timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspended_by uuid references public.profiles(id) on delete set null;

do $$ begin
  alter table public.profiles
    add constraint profiles_role_check check (role in ('user', 'admin'));
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- Sightings: soft removal
-- ------------------------------------------------------------
alter table public.sightings
  add column if not exists removed_at timestamptz,
  add column if not exists removal_reason text,
  add column if not exists removed_by uuid references public.profiles(id) on delete set null;

-- ------------------------------------------------------------
-- Helpers (must exist before RLS policies below)
-- ------------------------------------------------------------
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid and p.role = 'admin'
  );
$$;

create or replace function public.is_suspended(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and p.suspended = true
      and (
        p.suspended_until is null
        or p.suspended_until > now()
      )
  );
$$;

create or replace function public.refresh_suspension(uid uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    suspended = false,
    suspended_until = null,
    suspension_reason = null,
    suspended_at = null,
    suspended_by = null
  where id = uid
    and suspended = true
    and suspended_until is not null
    and suspended_until <= now();
end;
$$;

-- ------------------------------------------------------------
-- Moderation audit log
-- ------------------------------------------------------------
create table if not exists public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete cascade,
  action text not null check (
    action in (
      'remove_post',
      'edit_post',
      'suspend_user',
      'unsuspend_user',
      'grant_admin',
      'revoke_admin'
    )
  ),
  target_user_id uuid references public.profiles(id) on delete set null,
  target_sighting_id uuid references public.sightings(id) on delete set null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists moderation_actions_created_at_idx
  on public.moderation_actions (created_at desc);

create index if not exists moderation_actions_actor_idx
  on public.moderation_actions (actor_id, created_at desc);

alter table public.moderation_actions enable row level security;

do $$ begin
  create policy "Admins can view all moderation actions"
    on public.moderation_actions for select
    using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can view moderation actions against them"
    on public.moderation_actions for select
    using (auth.uid() = target_user_id);
exception when duplicate_object then null; end $$;

-- post_reports (if not already deployed)
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reporter_id, sighting_id)
);

alter table public.post_reports enable row level security;

do $$ begin
  create policy "Users can report posts"
    on public.post_reports for insert
    with check (auth.uid() = reporter_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Admins can view post reports"
    on public.post_reports for select
    using (public.is_admin());
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can view their own reports"
    on public.post_reports for select
    using (auth.uid() = reporter_id);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- Feed view: hide removed posts
-- ------------------------------------------------------------
drop function if exists public.nearby_sightings(double precision, double precision, double precision);
drop function if exists public.following_feed();
drop view if exists public.sighting_feed;

create view public.sighting_feed
with (security_invoker = on) as
select
  s.id, s.user_id, s.species, s.scientific_name, s.location_name,
  s.latitude, s.longitude, s.rarity, s.count, s.notes, s.photo_url, s.created_at,
  p.username, p.avatar_color, p.full_name,
  coalesce(l.like_count, 0) as like_count,
  s.confidence, s.detected_by,
  s.observed_at, s.location_city, s.location_address
from public.sightings s
join public.profiles p on p.id = s.user_id
left join (
  select sighting_id, count(*)::int as like_count
  from public.likes group by sighting_id
) l on l.sighting_id = s.id
where s.removed_at is null;

create or replace function public.nearby_sightings(
  in_lat double precision,
  in_lng double precision,
  in_radius_km double precision
)
returns setof public.sighting_feed
language sql stable security invoker
as $$
  select f.*
  from public.sighting_feed f
  where f.latitude is not null
    and f.longitude is not null
    and f.user_id <> auth.uid()
    and public.km_between(in_lat, in_lng, f.latitude, f.longitude) <= in_radius_km
  order by f.created_at desc
  limit 100;
$$;

create or replace function public.following_feed()
returns setof public.sighting_feed
language sql stable security invoker
as $$
  select f.*
  from public.sighting_feed f
  where f.user_id in (
    select following_id from public.follows where follower_id = auth.uid()
  )
  order by f.created_at desc
  limit 100;
$$;

-- ------------------------------------------------------------
-- Block writes for suspended users + protect role/suspension fields
-- ------------------------------------------------------------
drop policy if exists "Users can insert their own sightings" on public.sightings;
create policy "Users can insert their own sightings"
  on public.sightings for insert
  with check (auth.uid() = user_id and not public.is_suspended());

drop policy if exists "Users can update their own sightings" on public.sightings;
create policy "Users can update their own sightings"
  on public.sightings for update
  using (auth.uid() = user_id and not public.is_suspended());

drop policy if exists "Users can follow others" on public.follows;
create policy "Users can follow others"
  on public.follows for insert
  with check (auth.uid() = follower_id and not public.is_suspended());

drop policy if exists "Users can like" on public.likes;
create policy "Users can like"
  on public.likes for insert
  with check (auth.uid() = user_id and not public.is_suspended());

do $$ begin
  drop policy if exists "Users can insert comments" on public.comments;
  create policy "Users can insert comments"
    on public.comments for insert
    with check (auth.uid() = user_id and not public.is_suspended());
exception when undefined_table then null; end $$;

do $$ begin
  drop policy if exists "Users can like comments" on public.comment_likes;
  create policy "Users can like comments"
    on public.comment_likes for insert
    with check (auth.uid() = user_id and not public.is_suspended());
exception when undefined_table then null; end $$;

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and role = (select p.role from public.profiles p where p.id = auth.uid())
    and suspended = (select p.suspended from public.profiles p where p.id = auth.uid())
    and suspended_until is not distinct from (
      select p.suspended_until from public.profiles p where p.id = auth.uid()
    )
    and suspension_reason is not distinct from (
      select p.suspension_reason from public.profiles p where p.id = auth.uid()
    )
    and suspended_at is not distinct from (
      select p.suspended_at from public.profiles p where p.id = auth.uid()
    )
    and suspended_by is not distinct from (
      select p.suspended_by from public.profiles p where p.id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Moderation RPCs
-- ------------------------------------------------------------
create or replace function public.log_moderation_action(
  p_action text,
  p_target_user_id uuid,
  p_target_sighting_id uuid,
  p_reason text,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  log_id uuid;
begin
  insert into public.moderation_actions (
    actor_id, action, target_user_id, target_sighting_id, reason, metadata
  )
  values (
    auth.uid(), p_action, p_target_user_id, p_target_sighting_id, p_reason, p_metadata
  )
  returning id into log_id;

  return log_id;
end;
$$;

create or replace function public.admin_remove_post(
  p_sighting_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  trimmed_reason text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  trimmed_reason := nullif(trim(p_reason), '');
  if trimmed_reason is null or length(trimmed_reason) < 10 then
    raise exception 'A reason of at least 10 characters is required';
  end if;

  select user_id into owner_id
  from public.sightings
  where id = p_sighting_id;

  if owner_id is null then
    raise exception 'Post not found';
  end if;

  update public.sightings
  set
    removed_at = now(),
    removal_reason = trimmed_reason,
    removed_by = auth.uid()
  where id = p_sighting_id;

  perform public.log_moderation_action(
    'remove_post', owner_id, p_sighting_id, trimmed_reason, '{}'::jsonb
  );

  insert into public.activity (recipient_id, actor_id, type, sighting_id, detail)
  values (
    owner_id,
    auth.uid(),
    'moderation',
    p_sighting_id,
    'Your post was removed: ' || trimmed_reason
  );
end;
$$;

create or replace function public.admin_update_post(
  p_sighting_id uuid,
  p_payload jsonb,
  p_reason text default 'Post edited by admin'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  trimmed_reason text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  trimmed_reason := coalesce(nullif(trim(p_reason), ''), 'Post edited by admin');

  select user_id into owner_id
  from public.sightings
  where id = p_sighting_id;

  if owner_id is null then
    raise exception 'Post not found';
  end if;

  update public.sightings
  set
    species = coalesce(p_payload->>'species', species),
    scientific_name = case
      when p_payload ? 'scientific_name' then p_payload->>'scientific_name'
      else scientific_name
    end,
    location_name = case
      when p_payload ? 'location_name' then p_payload->>'location_name'
      else location_name
    end,
    location_city = case
      when p_payload ? 'location_city' then p_payload->>'location_city'
      else location_city
    end,
    location_address = case
      when p_payload ? 'location_address' then p_payload->>'location_address'
      else location_address
    end,
    rarity = coalesce((p_payload->>'rarity')::public.rarity, rarity),
    count = coalesce((p_payload->>'count')::integer, count),
    notes = case when p_payload ? 'notes' then p_payload->>'notes' else notes end
  where id = p_sighting_id;

  perform public.log_moderation_action(
    'edit_post', owner_id, p_sighting_id, trimmed_reason, p_payload
  );
end;
$$;

create or replace function public.admin_suspend_user(
  p_user_id uuid,
  p_reason text,
  p_suspended_until timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed_reason text;
  expiry_label text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot suspend yourself';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id and role = 'admin') then
    raise exception 'Admins cannot be suspended';
  end if;

  trimmed_reason := nullif(trim(p_reason), '');
  if trimmed_reason is null or length(trimmed_reason) < 10 then
    raise exception 'A reason of at least 10 characters is required';
  end if;

  update public.profiles
  set
    suspended = true,
    suspended_until = p_suspended_until,
    suspension_reason = trimmed_reason,
    suspended_at = now(),
    suspended_by = auth.uid()
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  expiry_label := case
    when p_suspended_until is null then 'Indefinite suspension.'
    else 'Suspended until ' || to_char(p_suspended_until at time zone 'UTC', 'Mon DD, YYYY') || '.'
  end;

  perform public.log_moderation_action(
    'suspend_user',
    p_user_id,
    null,
    trimmed_reason,
    jsonb_build_object('suspended_until', p_suspended_until)
  );

  insert into public.activity (recipient_id, actor_id, type, detail)
  values (
    p_user_id,
    auth.uid(),
    'moderation',
    'Your account was suspended: ' || trimmed_reason || ' ' || expiry_label
  );
end;
$$;

create or replace function public.admin_unsuspend_user(
  p_user_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed_reason text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  trimmed_reason := coalesce(nullif(trim(p_reason), ''), 'Suspension lifted');

  update public.profiles
  set
    suspended = false,
    suspended_until = null,
    suspension_reason = null,
    suspended_at = null,
    suspended_by = null
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  perform public.log_moderation_action(
    'unsuspend_user', p_user_id, null, trimmed_reason, '{}'::jsonb
  );

  insert into public.activity (recipient_id, actor_id, type, detail)
  values (
    p_user_id,
    auth.uid(),
    'moderation',
    'Your account suspension was lifted: ' || trimmed_reason
  );
end;
$$;

create or replace function public.admin_grant_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  update public.profiles
  set role = 'admin'
  where id = p_user_id;

  if not found then
    raise exception 'User not found';
  end if;

  perform public.log_moderation_action(
    'grant_admin', p_user_id, null, 'Granted admin access', '{}'::jsonb
  );
end;
$$;

create or replace function public.admin_revoke_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'You cannot revoke your own admin access';
  end if;

  if (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Cannot revoke the last admin';
  end if;

  update public.profiles
  set role = 'user'
  where id = p_user_id and role = 'admin';

  if not found then
    raise exception 'User is not an admin';
  end if;

  perform public.log_moderation_action(
    'revoke_admin', p_user_id, null, 'Revoked admin access', '{}'::jsonb
  );
end;
$$;

-- Seed Daniel as admin
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'danielsharifian@gmail.com'
);
