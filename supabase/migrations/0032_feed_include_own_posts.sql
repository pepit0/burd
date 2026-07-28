-- Include the current user's published posts in home feed RPCs.

drop function if exists public.nearby_sightings(double precision, double precision, double precision);
drop function if exists public.following_feed();

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
  where f.user_id = auth.uid()
     or f.user_id in (select public.friend_ids())
  order by f.created_at desc
  limit 100;
$$;
