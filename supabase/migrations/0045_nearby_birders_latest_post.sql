-- Nearby birders: only users whose *latest* published post is within radius.

create or replace function public.nearby_birders(
  in_lat double precision,
  in_lng double precision,
  in_radius_km double precision
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  avatar_color text,
  avatar_url text,
  is_verified boolean,
  is_beta boolean,
  location_name text,
  distance_km double precision
)
language sql
stable
security invoker
set search_path = public
as $$
  with latest_posts as (
    select distinct on (f.user_id)
      f.user_id,
      f.latitude,
      f.longitude,
      f.location_name,
      f.published_at
    from public.sighting_feed f
    where f.user_id <> auth.uid()
      and f.latitude is not null
      and f.longitude is not null
      and not public.is_user_blocked(auth.uid(), f.user_id)
    order by f.user_id, f.published_at desc nulls last
  )
  select
    p.id as user_id,
    p.username,
    p.full_name,
    p.avatar_color,
    p.avatar_url,
    p.is_verified,
    p.is_beta,
    lp.location_name,
    public.km_between(in_lat, in_lng, lp.latitude, lp.longitude) as distance_km
  from latest_posts lp
  join public.profiles p on p.id = lp.user_id
  where in_radius_km is null
     or public.km_between(in_lat, in_lng, lp.latitude, lp.longitude) <= in_radius_km
  order by distance_km asc, p.username asc
  limit 100;
$$;

grant execute on function public.nearby_birders(double precision, double precision, double precision)
  to authenticated;
