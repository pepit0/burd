-- Distinct users who have logged a species, ordered by first sighting.

create or replace function public.get_species_observers(
  in_scientific_name text,
  in_common_name text
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  avatar_color text,
  avatar_url text,
  first_seen_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id as user_id,
    p.username,
    p.full_name,
    p.avatar_color,
    p.avatar_url,
    min(coalesce(s.observed_at, s.created_at)) as first_seen_at
  from public.sightings s
  join public.profiles p on p.id = s.user_id
  where s.removed_at is null
    and (
      lower(trim(coalesce(s.scientific_name, ''))) = lower(trim(in_scientific_name))
      or lower(trim(s.species)) = lower(trim(in_common_name))
    )
  group by p.id, p.username, p.full_name, p.avatar_color, p.avatar_url
  order by first_seen_at asc;
$$;

grant execute on function public.get_species_observers(text, text) to authenticated;
