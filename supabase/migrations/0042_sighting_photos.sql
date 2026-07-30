-- Multi-photo journal entries and post carousels.
create table if not exists public.sighting_photos (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  sort_order smallint not null default 0,
  photo_url text not null,
  captured_at timestamptz,
  species text,
  scientific_name text,
  count integer not null default 1 check (count >= 1 and count <= 99),
  confidence double precision,
  detected_by text not null default 'manual',
  created_at timestamptz not null default now(),
  unique (sighting_id, sort_order)
);

create index if not exists sighting_photos_sighting_idx
  on public.sighting_photos (sighting_id, sort_order);

alter table public.sightings
  add column if not exists photo_count smallint not null default 0;

alter table public.sighting_photos enable row level security;

drop policy if exists "sighting_photos_select" on public.sighting_photos;
drop policy if exists "sighting_photos_insert" on public.sighting_photos;
drop policy if exists "sighting_photos_update" on public.sighting_photos;
drop policy if exists "sighting_photos_delete" on public.sighting_photos;

do $policies$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sightings'
      and column_name = 'visibility'
  ) and exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_view_sighting'
  ) then
    execute $policy$
      create policy "sighting_photos_select"
      on public.sighting_photos
      for select
      using (
        exists (
          select 1
          from public.sightings s
          where s.id = sighting_id
            and s.removed_at is null
            and (
              s.user_id = auth.uid()
              or (
                s.published_at is not null
                and public.can_view_sighting(
                  auth.uid(),
                  s.user_id,
                  s.visibility,
                  s.published_at
                )
              )
            )
        )
      )
    $policy$;
  else
    execute $policy$
      create policy "sighting_photos_select"
      on public.sighting_photos
      for select
      using (
        exists (
          select 1
          from public.sightings s
          where s.id = sighting_id
            and s.removed_at is null
            and (
              s.user_id = auth.uid()
              or s.published_at is not null
            )
        )
      )
    $policy$;
  end if;
end
$policies$;

drop policy if exists "sighting_photos_insert" on public.sighting_photos;
create policy "sighting_photos_insert"
  on public.sighting_photos
  for insert
  with check (
    exists (
      select 1
      from public.sightings s
      where s.id = sighting_id
        and s.user_id = auth.uid()
        and s.removed_at is null
    )
  );

drop policy if exists "sighting_photos_update" on public.sighting_photos;
create policy "sighting_photos_update"
  on public.sighting_photos
  for update
  using (
    exists (
      select 1
      from public.sightings s
      where s.id = sighting_id
        and s.user_id = auth.uid()
        and s.removed_at is null
    )
  );

drop policy if exists "sighting_photos_delete" on public.sighting_photos;
create policy "sighting_photos_delete"
  on public.sighting_photos
  for delete
  using (
    exists (
      select 1
      from public.sightings s
      where s.id = sighting_id
        and s.user_id = auth.uid()
        and s.removed_at is null
    )
  );

-- Backfill existing single-photo sightings.
insert into public.sighting_photos (
  sighting_id,
  sort_order,
  photo_url,
  captured_at,
  species,
  scientific_name,
  count,
  confidence,
  detected_by
)
select
  s.id,
  0,
  s.photo_url,
  coalesce(s.observed_at, s.created_at),
  s.species,
  s.scientific_name,
  s.count,
  s.confidence,
  coalesce(s.detected_by, 'manual')
from public.sightings s
where s.photo_url is not null
  and not exists (
    select 1
    from public.sighting_photos sp
    where sp.sighting_id = s.id
  );

update public.sightings s
set photo_count = coalesce(
  (
    select count(*)::smallint
    from public.sighting_photos sp
    where sp.sighting_id = s.id
  ),
  0
)
where s.photo_count = 0
  and exists (
    select 1
    from public.sighting_photos sp
    where sp.sighting_id = s.id
  );

-- Extend feed view with photo_count (schema-aware rebuild).
do $repair$
begin
  if not exists (
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
  drop view if exists public.sighting_feed;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sightings'
      and column_name = 'public_latitude'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sightings'
      and column_name = 'visibility'
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
        s.rarity, s.count, s.notes, s.photo_url, s.photo_count, s.created_at,
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
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sightings'
      and column_name = 'public_latitude'
  ) then
    execute $view$
      create view public.sighting_feed
      with (security_invoker = on) as
      select
        s.id, s.user_id, s.species, s.scientific_name, s.location_name,
        coalesce(s.public_latitude, s.latitude) as latitude,
        coalesce(s.public_longitude, s.longitude) as longitude,
        s.rarity, s.count, s.notes, s.photo_url, s.photo_count, s.created_at,
        p.username, p.avatar_color, p.avatar_url, p.full_name,
        coalesce(l.like_count, 0) as like_count,
        s.confidence, s.detected_by,
        s.observed_at, s.location_city, s.location_address,
        s.author_disqualified,
        s.audio_url,
        s.published_at,
        s.public_latitude,
        s.public_longitude
      from public.sightings s
      join public.profiles p on p.id = s.user_id
      left join (
        select sighting_id, count(*)::int as like_count
        from public.likes group by sighting_id
      ) l on l.sighting_id = s.id
      where s.removed_at is null
        and s.published_at is not null
    $view$;
  else
    execute $view$
      create view public.sighting_feed
      with (security_invoker = on) as
      select
        s.id, s.user_id, s.species, s.scientific_name, s.location_name,
        s.latitude, s.longitude, s.rarity, s.count, s.notes, s.photo_url,
        s.photo_count, s.created_at,
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

grant select on public.sighting_photos to authenticated;
grant all on public.sighting_photos to authenticated;
