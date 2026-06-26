-- ============================================================
-- Burd — observed time + structured location on sightings
-- Run in Supabase Dashboard → SQL Editor after 0002_inference.sql.
-- ============================================================

alter table public.sightings
  add column if not exists observed_at timestamptz,
  add column if not exists location_city text,
  add column if not exists location_address text;

update public.sightings
set observed_at = created_at
where observed_at is null;

create or replace view public.sighting_feed
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
) l on l.sighting_id = s.id;
