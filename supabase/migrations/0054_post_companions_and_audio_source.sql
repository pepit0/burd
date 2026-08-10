-- Tag people "with" on posts and borrow audio from friends' public posts.

create table if not exists public.sighting_companions (
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (sighting_id, user_id)
);

create index if not exists sighting_companions_user_idx
  on public.sighting_companions (user_id);

alter table public.sighting_companions enable row level security;

drop policy if exists "sighting_companions are readable" on public.sighting_companions;
drop policy if exists "owners manage sighting_companions" on public.sighting_companions;

create policy "sighting_companions are readable"
  on public.sighting_companions for select
  to authenticated
  using (true);

create policy "owners manage sighting_companions"
  on public.sighting_companions for all
  to authenticated
  using (
    exists (
      select 1
      from public.sightings s
      where s.id = sighting_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sightings s
      where s.id = sighting_id
        and s.user_id = auth.uid()
    )
  );

alter table public.sightings
  add column if not exists audio_source_sighting_id uuid
    references public.sightings(id) on delete set null;

create index if not exists sightings_audio_source_idx
  on public.sightings (audio_source_sighting_id)
  where audio_source_sighting_id is not null;

do $repair$
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
    drop function if exists public.search_sightings_by_hashtag(text);
    drop function if exists public.nearby_sightings(double precision, double precision, double precision);
    drop function if exists public.following_feed();
    drop view if exists public.sighting_feed;

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
        s.audio_source_sighting_id,
        s.published_audio_start_ms,
        s.published_audio_end_ms,
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
        and not public.is_user_blocked(auth.uid(), s.user_id)
    $view$;

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

    execute $fn$
      create or replace function public.search_sightings_by_hashtag(p_query text)
      returns setof public.sighting_feed
      language sql
      stable
      security invoker
      set search_path = public
      as $body$
        with normalized as (
          select lower(trim(both '#' from coalesce(p_query, ''))) as q
        )
        select sf.*
        from public.sighting_feed sf
        join public.sighting_hashtags sh on sh.sighting_id = sf.id
        cross join normalized n
        where n.q <> ''
          and (
            sh.tag = n.q
            or sh.tag like n.q || '%'
            or n.q like sh.tag || '%'
            or sh.tag like '%' || n.q || '%'
          )
        order by sf.published_at desc nulls last
        limit 100;
      $body$;
    $fn$;

    execute 'grant execute on function public.search_sightings_by_hashtag(text) to authenticated';
  end if;
end;
$repair$;
