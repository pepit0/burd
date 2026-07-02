-- Profile cover banner preset id or custom URL.

alter table public.profiles
  add column if not exists cover_url text;

-- Recreate sighting_feed when an older migration cannot replace a newer view definition.
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
  and s.published_at is not null;

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
