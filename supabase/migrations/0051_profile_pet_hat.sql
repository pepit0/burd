-- Pocket Bird hat worn on the user's profile pet.

alter table public.profiles
  add column if not exists pet_hat_id text;

comment on column public.profiles.pet_hat_id is
  'Pocket Bird hat id displayed on the profile pet.';
