-- "range" is a PostgreSQL reserved type name; rename for PostgREST compatibility.
alter table public.species_profiles
  rename column range to geographic_range;
