-- Trim bounds for audio shared on profile posts. Journal keeps the full audio_url.

alter table public.sightings
  add column if not exists published_audio_start_ms integer,
  add column if not exists published_audio_end_ms integer;

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
  end if;
end;
$repair$;
