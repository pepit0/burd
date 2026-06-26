-- ============================================================
-- Burd — initial schema
-- Run this in Supabase Dashboard → SQL Editor (whole file).
-- Safe to re-run (idempotent where practical).
-- ============================================================

-- Distance for the "nearby" feed uses a plain haversine formula
-- (see public.km_between below) so no extra extensions are required.

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------
do $$ begin
  create type public.rarity as enum ('common', 'uncommon', 'rare');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.activity_type as enum ('like', 'follow', 'comment', 'milestone', 'log');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- PROFILES (1:1 with auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  full_name text,
  avatar_color text not null default '#5f9470',
  bio text,
  location_name text,
  latitude double precision,
  longitude double precision,
  search_radius_km integer not null default 25,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

do $$ begin
  create policy "Profiles are viewable by everyone"
    on public.profiles for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can insert their own profile"
    on public.profiles for insert with check (auth.uid() = id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can update their own profile"
    on public.profiles for update using (auth.uid() = id);
exception when duplicate_object then null; end $$;

-- Auto-create a profile when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  colors text[] := array['#5f9470','#c8693a','#8a6e3a','#c8a03a','#7c6e9e','#3a7a8a','#6e7a3a'];
begin
  base_username := split_part(coalesce(new.email, 'birder'), '@', 1);
  insert into public.profiles (id, username, full_name, avatar_color)
  values (
    new.id,
    base_username || '_' || substr(md5(random()::text), 1, 4),
    coalesce(new.raw_user_meta_data->>'full_name', base_username),
    colors[1 + floor(random() * array_length(colors, 1))::int]
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for any users that already exist
insert into public.profiles (id, username, full_name, avatar_color)
select
  u.id,
  split_part(coalesce(u.email, 'birder'), '@', 1) || '_' || substr(md5(random()::text), 1, 4),
  coalesce(u.raw_user_meta_data->>'full_name', split_part(coalesce(u.email, 'birder'), '@', 1)),
  '#5f9470'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- ------------------------------------------------------------
-- SIGHTINGS
-- ------------------------------------------------------------
create table if not exists public.sightings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  species text not null,
  scientific_name text,
  location_name text,
  latitude double precision,
  longitude double precision,
  rarity public.rarity not null default 'common',
  count integer not null default 1,
  notes text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.sightings enable row level security;
create index if not exists sightings_created_at_idx on public.sightings (created_at desc);
create index if not exists sightings_user_id_idx on public.sightings (user_id);

do $$ begin
  create policy "Sightings are viewable by everyone"
    on public.sightings for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can insert their own sightings"
    on public.sightings for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can update their own sightings"
    on public.sightings for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can delete their own sightings"
    on public.sightings for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- FOLLOWS
-- ------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

do $$ begin
  create policy "Follows are viewable by everyone"
    on public.follows for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can follow others"
    on public.follows for insert with check (auth.uid() = follower_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can unfollow"
    on public.follows for delete using (auth.uid() = follower_id);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- LIKES
-- ------------------------------------------------------------
create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sighting_id)
);

alter table public.likes enable row level security;
create index if not exists likes_sighting_id_idx on public.likes (sighting_id);

do $$ begin
  create policy "Likes are viewable by everyone"
    on public.likes for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can like"
    on public.likes for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can unlike"
    on public.likes for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- ACTIVITY (notifications) — populated by triggers
-- ------------------------------------------------------------
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete cascade,
  type public.activity_type not null,
  sighting_id uuid references public.sightings(id) on delete cascade,
  detail text,
  created_at timestamptz not null default now()
);

alter table public.activity enable row level security;
create index if not exists activity_recipient_idx on public.activity (recipient_id, created_at desc);

do $$ begin
  create policy "Users can view their own activity"
    on public.activity for select using (auth.uid() = recipient_id);
exception when duplicate_object then null; end $$;

-- Like → activity for the sighting owner
create or replace function public.on_like_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; sp text;
begin
  select user_id, species into owner, sp from public.sightings where id = new.sighting_id;
  if owner is not null and owner <> new.user_id then
    insert into public.activity (recipient_id, actor_id, type, sighting_id, detail)
    values (owner, new.user_id, 'like', new.sighting_id, 'liked your ' || sp || ' sighting');
  end if;
  return new;
end; $$;

drop trigger if exists trg_on_like_created on public.likes;
create trigger trg_on_like_created after insert on public.likes
  for each row execute function public.on_like_created();

create or replace function public.on_like_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.activity
   where type = 'like' and actor_id = old.user_id and sighting_id = old.sighting_id;
  return old;
end; $$;

drop trigger if exists trg_on_like_deleted on public.likes;
create trigger trg_on_like_deleted after delete on public.likes
  for each row execute function public.on_like_deleted();

-- Follow → activity for the followed user
create or replace function public.on_follow_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.activity (recipient_id, actor_id, type, detail)
  values (new.following_id, new.follower_id, 'follow', 'started following you');
  return new;
end; $$;

drop trigger if exists trg_on_follow_created on public.follows;
create trigger trg_on_follow_created after insert on public.follows
  for each row execute function public.on_follow_created();

create or replace function public.on_follow_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.activity
   where type = 'follow' and actor_id = old.follower_id and recipient_id = old.following_id;
  return old;
end; $$;

drop trigger if exists trg_on_follow_deleted on public.follows;
create trigger trg_on_follow_deleted after delete on public.follows
  for each row execute function public.on_follow_deleted();

-- ------------------------------------------------------------
-- FEED VIEW (sighting + author + like_count)
-- ------------------------------------------------------------
create or replace view public.sighting_feed
with (security_invoker = on) as
select
  s.id, s.user_id, s.species, s.scientific_name, s.location_name,
  s.latitude, s.longitude, s.rarity, s.count, s.notes, s.photo_url, s.created_at,
  p.username, p.avatar_color, p.full_name,
  coalesce(l.like_count, 0) as like_count
from public.sightings s
join public.profiles p on p.id = s.user_id
left join (
  select sighting_id, count(*)::int as like_count
  from public.likes group by sighting_id
) l on l.sighting_id = s.id;

-- ------------------------------------------------------------
-- Geo helper: great-circle distance in km (haversine, no extensions)
-- ------------------------------------------------------------
create or replace function public.km_between(
  lat1 double precision,
  lng1 double precision,
  lat2 double precision,
  lng2 double precision
)
returns double precision
language sql immutable
as $$
  select 6371 * acos(
    least(1.0, greatest(-1.0,
      cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lng2) - radians(lng1))
      + sin(radians(lat1)) * sin(radians(lat2))
    ))
  );
$$;

-- ------------------------------------------------------------
-- RPCs for feed modes
-- ------------------------------------------------------------
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
-- STORAGE bucket for sighting photos
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('sightings', 'sightings', true)
on conflict (id) do nothing;

do $$ begin
  create policy "Sighting photos are publicly readable"
    on storage.objects for select using (bucket_id = 'sightings');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Authenticated users can upload sighting photos"
    on storage.objects for insert
    with check (bucket_id = 'sightings' and auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
