-- ============================================================
-- Burd — AI identification metadata
-- Run in Supabase Dashboard → SQL Editor after 0001_init.sql.
-- ============================================================

alter table public.sightings
  add column if not exists confidence double precision,
  add column if not exists detected_by text not null default 'manual';

do $$ begin
  alter table public.sightings
    add constraint sightings_detected_by_check
    check (detected_by in ('manual', 'image', 'audio'));
exception when duplicate_object then null; end $$;

-- Re-create the feed view with the new columns appended at the end.
create or replace view public.sighting_feed
with (security_invoker = on) as
select
  s.id, s.user_id, s.species, s.scientific_name, s.location_name,
  s.latitude, s.longitude, s.rarity, s.count, s.notes, s.photo_url, s.created_at,
  p.username, p.avatar_color, p.full_name,
  coalesce(l.like_count, 0) as like_count,
  s.confidence, s.detected_by
from public.sightings s
join public.profiles p on p.id = s.user_id
left join (
  select sighting_id, count(*)::int as like_count
  from public.likes group by sighting_id
) l on l.sighting_id = s.id;
