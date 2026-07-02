-- Allow combined photo + sound identification.
alter table public.sightings
  drop constraint if exists sightings_detected_by_check;

alter table public.sightings
  add constraint sightings_detected_by_check
  check (detected_by in ('manual', 'image', 'audio', 'both'));
  