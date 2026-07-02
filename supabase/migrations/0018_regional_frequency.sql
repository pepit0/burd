-- Regional sighting frequency aggregates (grid cell only — no raw coordinates).

create table if not exists public.regional_sighting_counts (
  cell_id text not null,
  month smallint not null check (month between 1 and 12),
  scientific_name text not null,
  sighting_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (cell_id, month, scientific_name)
);

create index if not exists regional_sighting_counts_cell_month_idx
  on public.regional_sighting_counts (cell_id, month);

alter table public.regional_sighting_counts enable row level security;

drop policy if exists "Regional counts readable by authenticated users"
  on public.regional_sighting_counts;
create policy "Regional counts readable by authenticated users"
  on public.regional_sighting_counts for select
  to authenticated
  using (true);

-- 1° grid cell id (matches lib/cellId.ts NA_GRID_DEG = 1).
create or replace function public.regional_cell_id(
  lat double precision,
  lng double precision,
  grid_deg double precision default 1
)
returns text
language sql
immutable
as $$
  select (floor(lat / grid_deg) * grid_deg)::int::text || '_' ||
         (floor(lng / grid_deg) * grid_deg)::int::text;
$$;

create or replace function public.regional_month_from_timestamptz(ts timestamptz)
returns smallint
language sql
immutable
as $$
  select extract(month from ts)::smallint;
$$;

create or replace function public.bump_regional_sighting_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cell text;
  v_month smallint;
  v_scientific text;
begin
  if new.latitude is null or new.longitude is null then
    return new;
  end if;

  v_cell := public.regional_cell_id(new.latitude, new.longitude, 1);
  v_month := public.regional_month_from_timestamptz(
    coalesce(new.observed_at, new.created_at)
  );

  v_scientific := lower(trim(coalesce(new.scientific_name, '')));
  if v_scientific = '' then
    v_scientific := lower(trim(new.species));
  end if;

  if v_scientific = '' then
    return new;
  end if;

  insert into public.regional_sighting_counts (
    cell_id, month, scientific_name, sighting_count
  )
  values (v_cell, v_month, v_scientific, 1)
  on conflict (cell_id, month, scientific_name)
  do update set
    sighting_count = public.regional_sighting_counts.sighting_count + 1,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists sightings_bump_regional_count on public.sightings;
create trigger sightings_bump_regional_count
  after insert on public.sightings
  for each row
  execute function public.bump_regional_sighting_count();
