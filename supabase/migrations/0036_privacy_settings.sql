-- Privacy settings: sighting visibility, location fuzzing, units.
-- Also allows null search_radius_km for "no limit" nearby feed.

do $$ begin
  create type public.sighting_visibility as enum ('public', 'friends', 'private');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.location_obscured_reason as enum ('user_setting', 'sensitive_species');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.distance_unit as enum ('km', 'mi');
exception
  when duplicate_object then null;
end $$;

-- Profile defaults
alter table public.profiles
  add column if not exists default_sighting_visibility public.sighting_visibility not null default 'public',
  add column if not exists share_exact_coordinates boolean not null default false,
  add column if not exists location_fuzz_km smallint not null default 1,
  add column if not exists distance_unit public.distance_unit not null default 'km';

alter table public.profiles
  alter column search_radius_km drop not null;

-- Per-sighting overrides + stored public coords
alter table public.sightings
  add column if not exists visibility public.sighting_visibility,
  add column if not exists share_exact_coordinates boolean,
  add column if not exists location_fuzz_km smallint,
  add column if not exists public_latitude double precision,
  add column if not exists public_longitude double precision,
  add column if not exists location_obscured_reason public.location_obscured_reason;

-- Backfill visibility for published rows
update public.sightings
  set visibility = 'public'
  where published_at is not null and visibility is null;

-- Mutual friends helper
create or replace function public.are_friends(viewer_id uuid, owner_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select viewer_id is not null
    and owner_id is not null
    and viewer_id = owner_id
    or (
      viewer_id is not null
      and exists (
        select 1
        from public.follows f1
        join public.follows f2
          on f1.follower_id = f2.following_id
         and f1.following_id = f2.follower_id
        where f1.follower_id = viewer_id
          and f1.following_id = owner_id
      )
    );
$$;

create or replace function public.can_view_sighting(
  viewer_id uuid,
  owner_id uuid,
  sighting_visibility public.sighting_visibility,
  sighting_published_at timestamptz
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select viewer_id = owner_id
    or (
      sighting_published_at is not null
      and coalesce(sighting_visibility, 'public') = 'public'
    )
    or (
      sighting_published_at is not null
      and coalesce(sighting_visibility, 'public') = 'friends'
      and public.are_friends(viewer_id, owner_id)
    );
$$;

-- Obfuscate coordinates to ~fuzz_km grid (server-side, matches client logic)
create or replace function public.obfuscate_coordinate(value double precision, fuzz_km smallint)
returns double precision
language sql
immutable
as $$
  select case
    when value is null then null
    when fuzz_km <= 0 then value
    else round(value / (fuzz_km::double precision / 111.0)) * (fuzz_km::double precision / 111.0)
  end;
$$;

-- Rebuild sighting_feed view with privacy columns
drop function if exists public.nearby_sightings(double precision, double precision, double precision);
drop function if exists public.following_feed();
drop view if exists public.sighting_feed;

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
  );

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
    and (
      in_radius_km is null
      or public.km_between(in_lat, in_lng, f.latitude, f.longitude) <= in_radius_km
    )
  order by f.created_at desc
  limit 100;
$$;

create or replace function public.following_feed()
returns setof public.sighting_feed
language sql stable security invoker
as $$
  select f.*
  from public.sighting_feed f
  where f.user_id = auth.uid()
     or f.user_id in (select public.friend_ids())
  order by f.created_at desc
  limit 100;
$$;

-- Visibility-aware RLS
drop policy if exists "Sightings are viewable by everyone" on public.sightings;
create policy "Sightings are viewable by everyone"
  on public.sightings for select
  using (
    auth.uid() = user_id
    or public.can_view_sighting(auth.uid(), user_id, visibility, published_at)
  );

grant execute on function public.are_friends(uuid, uuid) to authenticated;
grant execute on function public.can_view_sighting(uuid, uuid, public.sighting_visibility, timestamptz) to authenticated;

-- Backfill public coords for existing rows (exact until recomputed on edit)
update public.sightings
  set public_latitude = latitude,
      public_longitude = longitude
  where latitude is not null
    and public_latitude is null;
