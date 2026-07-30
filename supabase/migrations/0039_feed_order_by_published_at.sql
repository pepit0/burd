-- Feed RPCs should rank posts by when they were published, not when the journal entry was created.

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
  order by f.published_at desc
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
  order by f.published_at desc
  limit 100;
$$;
