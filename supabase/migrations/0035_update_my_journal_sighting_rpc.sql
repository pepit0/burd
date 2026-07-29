-- Owners can edit journal fields (including location) even after posting.
-- Security definer so saves work regardless of published_at RLS edge cases.
create or replace function public.update_my_journal_sighting(
  p_sighting_id uuid,
  p_species text,
  p_scientific_name text,
  p_notes text,
  p_location_name text,
  p_location_city text,
  p_location_address text,
  p_observed_at timestamptz,
  p_rarity public.rarity,
  p_count integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.sightings
  set
    species = trim(p_species),
    scientific_name = nullif(trim(p_scientific_name), ''),
    notes = nullif(trim(p_notes), ''),
    location_name = nullif(trim(p_location_name), ''),
    location_city = nullif(trim(p_location_city), ''),
    location_address = nullif(trim(p_location_address), ''),
    observed_at = p_observed_at,
    rarity = p_rarity,
    count = greatest(1, least(p_count, 99))
  where id = p_sighting_id
    and user_id = auth.uid()
    and removed_at is null;

  if not found then
    raise exception 'Sighting not found or not editable';
  end if;
end;
$$;

grant execute on function public.update_my_journal_sighting(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  public.rarity,
  integer
) to authenticated;
