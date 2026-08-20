-- Collectible species cards earned from in-app camera Photo ID.

create table if not exists public.species_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  species text not null,
  scientific_name text not null,
  catalog_id text not null,
  photo_url text not null,
  location_city text,
  location_country text,
  sighting_id uuid references public.sightings(id) on delete set null,
  unlocked_at timestamptz not null default now(),
  unique (user_id, catalog_id)
);

create index if not exists species_cards_user_unlocked_at_idx
  on public.species_cards (user_id, unlocked_at desc);

alter table public.species_cards enable row level security;

drop policy if exists "Species cards viewable by owner" on public.species_cards;
create policy "Species cards viewable by owner"
  on public.species_cards for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own species cards" on public.species_cards;
create policy "Users can insert their own species cards"
  on public.species_cards for insert
  with check (auth.uid() = user_id and not public.is_suspended());
