-- Cached field guide encyclopedia content (generated once per species via edge function).
create table public.species_profiles (
  species_id text primary key,
  common_name text not null,
  scientific_name text not null,
  family text,
  size text not null default '',
  habitat text not null default '',
  range text not null default '',
  diet text not null default '',
  summary text not null default '',
  field_marks jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.species_profiles enable row level security;

create policy "Authenticated users can read species profiles"
  on public.species_profiles for select
  to authenticated
  using (true);
