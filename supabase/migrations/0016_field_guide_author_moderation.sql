-- Field guide author moderation: disqualify fake first-capture claims and reassign credit.

alter table public.sightings
  add column if not exists author_disqualified boolean not null default false,
  add column if not exists author_disqualified_at timestamptz,
  add column if not exists author_disqualified_by uuid references public.profiles(id) on delete set null,
  add column if not exists author_disqualification_reason text;

alter table public.moderation_actions
  drop constraint if exists moderation_actions_action_check;

alter table public.moderation_actions
  add constraint moderation_actions_action_check check (
    action in (
      'remove_post',
      'edit_post',
      'suspend_user',
      'unsuspend_user',
      'grant_admin',
      'revoke_admin',
      'remove_field_guide_author'
    )
  );

-- First eligible photo sighting for a species (excludes removed/disqualified posts).
create or replace function public.find_field_guide_author_sighting(
  in_scientific_name text,
  in_common_name text
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  authored_at timestamptz,
  sighting_id uuid
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
    coalesce(s.observed_at, s.created_at) as authored_at,
    s.id as sighting_id
  from public.sightings s
  join public.profiles p on p.id = s.user_id
  where s.photo_url is not null
    and s.removed_at is null
    and s.author_disqualified = false
    and (
      lower(trim(coalesce(s.scientific_name, ''))) = lower(trim(in_scientific_name))
      or lower(trim(s.species)) = lower(trim(in_common_name))
    )
  order by coalesce(s.observed_at, s.created_at) asc, s.created_at asc
  limit 1;
$$;

create or replace function public.get_species_field_guide_author(
  in_scientific_name text,
  in_common_name text
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  authored_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.user_id,
    f.username,
    f.full_name,
    f.authored_at
  from public.find_field_guide_author_sighting(in_scientific_name, in_common_name) f;
$$;

-- Sync cached species_profiles.author_user_id after author eligibility changes.
create or replace function public.recompute_field_guide_author_from_sighting(
  p_sighting_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sighting_row record;
  next_author uuid;
begin
  select species, scientific_name
  into sighting_row
  from public.sightings
  where id = p_sighting_id;

  if not found then
    return;
  end if;

  select f.user_id
  into next_author
  from public.find_field_guide_author_sighting(
    coalesce(sighting_row.scientific_name, sighting_row.species),
    sighting_row.species
  ) f;

  update public.species_profiles sp
  set author_user_id = next_author
  where lower(trim(sp.scientific_name)) = lower(trim(coalesce(sighting_row.scientific_name, sighting_row.species)))
     or lower(trim(sp.common_name)) = lower(trim(sighting_row.species));
end;
$$;

create or replace function public.admin_remove_post_author(
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
  had_photo boolean;
  already_disqualified boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  trimmed_reason := nullif(trim(p_reason), '');
  if trimmed_reason is null or length(trimmed_reason) < 10 then
    raise exception 'A reason of at least 10 characters is required';
  end if;

  select user_id, photo_url is not null, author_disqualified
  into owner_id, had_photo, already_disqualified
  from public.sightings
  where id = p_sighting_id;

  if owner_id is null then
    raise exception 'Post not found';
  end if;

  if not had_photo then
    raise exception 'This post has no photo and cannot hold field guide author credit';
  end if;

  if already_disqualified then
    raise exception 'Author credit was already removed from this post';
  end if;

  update public.sightings
  set
    author_disqualified = true,
    author_disqualified_at = now(),
    author_disqualified_by = auth.uid(),
    author_disqualification_reason = trimmed_reason
  where id = p_sighting_id;

  perform public.recompute_field_guide_author_from_sighting(p_sighting_id);

  perform public.log_moderation_action(
    'remove_field_guide_author',
    owner_id,
    p_sighting_id,
    trimmed_reason,
    '{}'::jsonb
  );

  insert into public.activity (recipient_id, actor_id, type, sighting_id, detail)
  values (
    owner_id,
    auth.uid(),
    'moderation',
    p_sighting_id,
    'Your field guide author credit was removed: ' || trimmed_reason
  );
end;
$$;

grant execute on function public.admin_remove_post_author(uuid, text) to authenticated;

-- Keep cached author_user_id in sync when a new photo sighting is logged.
create or replace function public.maybe_recompute_field_guide_author_on_sighting()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.photo_url is null or new.removed_at is not null or new.author_disqualified then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.photo_url is not null
    and coalesce(old.removed_at, to_timestamp(0)) = coalesce(new.removed_at, to_timestamp(0))
    and old.author_disqualified = new.author_disqualified then
    return new;
  end if;

  perform public.recompute_field_guide_author_from_sighting(new.id);
  return new;
end;
$$;

drop trigger if exists recompute_field_guide_author_on_sighting on public.sightings;

create trigger recompute_field_guide_author_on_sighting
  after insert or update of photo_url, removed_at, author_disqualified
  on public.sightings
  for each row
  execute function public.maybe_recompute_field_guide_author_on_sighting();

-- Expose author disqualification on feed rows for admin UI.
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
  s.observed_at, s.location_city, s.location_address,
  s.author_disqualified
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
  had_photo boolean;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  trimmed_reason := nullif(trim(p_reason), '');
  if trimmed_reason is null or length(trimmed_reason) < 10 then
    raise exception 'A reason of at least 10 characters is required';
  end if;

  select user_id, photo_url is not null
  into owner_id, had_photo
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

  if had_photo then
    perform public.recompute_field_guide_author_from_sighting(p_sighting_id);
  end if;

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
