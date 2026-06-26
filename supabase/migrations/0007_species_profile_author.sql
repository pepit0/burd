-- Credit the first birder to log a photo sighting as field guide author.
alter table public.species_profiles
  add column if not exists author_user_id uuid references public.profiles(id) on delete set null;

create index if not exists species_profiles_author_user_id_idx
  on public.species_profiles (author_user_id);

create or replace function public.get_species_field_guide_author(
  in_scientific_name text,
  in_common_name text
)
returns table (
  user_id uuid,
  username text,
  full_name text,
  authored_at timestamptz
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
    coalesce(s.observed_at, s.created_at) as authored_at
  from public.sightings s
  join public.profiles p on p.id = s.user_id
  where s.photo_url is not null
    and (
      lower(trim(coalesce(s.scientific_name, ''))) = lower(trim(in_scientific_name))
      or lower(trim(s.species)) = lower(trim(in_common_name))
    )
  order by coalesce(s.observed_at, s.created_at) asc, s.created_at asc
  limit 1;
$$;

grant execute on function public.get_species_field_guide_author(text, text) to authenticated;
