-- Reset auth accounts stuck without a real profile (email signups that never finished onboarding).

update auth.users u
set raw_user_meta_data =
  coalesce(u.raw_user_meta_data, '{}'::jsonb)
  - 'username'
  || jsonb_build_object('username_chosen', false)
where coalesce(u.raw_user_meta_data->>'username_chosen', 'false') <> 'true'
  and not exists (
    select 1
    from public.profiles p
    where p.id = u.id
      and char_length(trim(p.username)) >= 3
      and lower(p.username) !~ '^birder(_[a-f0-9]{4})?$'
  );

-- Drop auto-generated placeholder profiles so complete_user_onboarding() can recreate them.
delete from public.profiles p
where lower(p.username) ~ '^birder(_[a-f0-9]{4})?$'
  and coalesce(
    (select u.raw_user_meta_data->>'username_chosen' from auth.users u where u.id = p.id),
    'false'
  ) <> 'true';
