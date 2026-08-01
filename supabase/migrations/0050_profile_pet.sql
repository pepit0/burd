-- Pocket Bird pet shown hopping on the user's profile banner.

alter table public.profiles
  add column if not exists pet_species_id text,
  add column if not exists profile_pet_enabled boolean not null default true;

comment on column public.profiles.pet_species_id is
  'Pocket Bird species id displayed on the profile banner.';
comment on column public.profiles.profile_pet_enabled is
  'When false, the profile pet is hidden for all viewers.';
