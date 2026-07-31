-- Up to 3 achievement badge ids chosen for the profile showcase row.

alter table public.profiles
  add column if not exists showcase_badge_ids text[] not null default '{}';

alter table public.profiles
  drop constraint if exists profiles_showcase_badge_ids_max_len;

alter table public.profiles
  add constraint profiles_showcase_badge_ids_max_len
  check (cardinality(showcase_badge_ids) <= 3);
