-- Per-type push notification preferences

alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{
    "likes": true,
    "comments": true,
    "follows": true,
    "reposts": true,
    "nearby_rare": true
  }'::jsonb;
