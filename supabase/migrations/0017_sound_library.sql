-- Sound clips on sightings + personal sound library.

alter table public.sightings
  add column if not exists audio_url text,
  add column if not exists audio_predictions jsonb;

create table if not exists public.sound_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  audio_url text not null,
  duration_ms integer not null default 0,
  recorded_at timestamptz not null default now(),
  predictions jsonb not null default '[]'::jsonb,
  label text,
  sighting_id uuid references public.sightings(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists sound_library_user_id_idx
  on public.sound_library (user_id, created_at desc);

create index if not exists sound_library_sighting_id_idx
  on public.sound_library (sighting_id);

alter table public.sound_library enable row level security;

drop policy if exists "Sound library viewable by owner" on public.sound_library;
create policy "Sound library viewable by owner"
  on public.sound_library for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own sounds" on public.sound_library;
create policy "Users can insert their own sounds"
  on public.sound_library for insert
  with check (auth.uid() = user_id and not public.is_suspended());

drop policy if exists "Users can update their own sounds" on public.sound_library;
create policy "Users can update their own sounds"
  on public.sound_library for update
  using (auth.uid() = user_id and not public.is_suspended());

drop policy if exists "Users can delete their own sounds" on public.sound_library;
create policy "Users can delete their own sounds"
  on public.sound_library for delete
  using (auth.uid() = user_id);

-- Storage bucket for bird call clips
insert into storage.buckets (id, name, public)
values ('sound_clips', 'sound_clips', true)
on conflict (id) do nothing;

drop policy if exists "Sound clips are publicly readable" on storage.objects;
create policy "Sound clips are publicly readable"
  on storage.objects for select
  using (bucket_id = 'sound_clips');

drop policy if exists "Authenticated users can upload sound clips" on storage.objects;
create policy "Authenticated users can upload sound clips"
  on storage.objects for insert
  with check (
    bucket_id = 'sound_clips'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete their own sound clips" on storage.objects;
create policy "Users can delete their own sound clips"
  on storage.objects for delete
  using (
    bucket_id = 'sound_clips'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

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
  s.audio_url
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
