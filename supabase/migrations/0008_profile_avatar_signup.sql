-- Profile photos + signup username handling.

alter table public.profiles
  add column if not exists avatar_url text;

create or replace function public.check_signup_availability(
  check_email text,
  check_username text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text;
  email_taken boolean := false;
  username_taken boolean := false;
begin
  normalized_username := lower(trim(check_username));
  normalized_username := regexp_replace(normalized_username, '^@+', '');
  normalized_username := regexp_replace(normalized_username, '[^a-z0-9_]', '', 'g');

  if check_email is not null and trim(check_email) <> '' then
    select exists(
      select 1 from auth.users where lower(email) = lower(trim(check_email))
    ) into email_taken;
  end if;

  if normalized_username <> '' then
    select exists(
      select 1 from public.profiles where lower(username) = normalized_username
    ) into username_taken;
  end if;

  return jsonb_build_object(
    'email_taken', email_taken,
    'username_taken', username_taken
  );
end;
$$;

grant execute on function public.check_signup_availability(text, text) to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  chosen_username text;
  colors text[] := array['#5f9470','#c8693a','#8a6e3a','#c8a03a','#7c6e9e','#3a7a8a','#6e7a3a'];
begin
  chosen_username := lower(trim(coalesce(new.raw_user_meta_data->>'username', '')));
  chosen_username := regexp_replace(chosen_username, '^@+', '');
  chosen_username := regexp_replace(chosen_username, '[^a-z0-9_]', '', 'g');

  if chosen_username = '' or length(chosen_username) < 3 then
    chosen_username := regexp_replace(
      split_part(coalesce(new.email, 'birder'), '@', 1),
      '[^a-z0-9_]',
      '',
      'g'
    );
    if length(chosen_username) < 3 then
      chosen_username := 'birder';
    end if;
    chosen_username := chosen_username || '_' || substr(md5(random()::text), 1, 4);
  end if;

  while exists (select 1 from public.profiles where username = chosen_username) loop
    chosen_username := chosen_username || substr(md5(random()::text), 1, 2);
  end loop;

  insert into public.profiles (id, username, full_name, avatar_color)
  values (
    new.id,
    chosen_username,
    coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), chosen_username),
    colors[1 + floor(random() * array_length(colors, 1))::int]
  );
  return new;
end;
$$;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

do $$ begin
  create policy "Avatar photos are publicly readable"
    on storage.objects for select
    using (bucket_id = 'avatars');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can upload their avatar"
    on storage.objects for insert
    with check (
      bucket_id = 'avatars'
      and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can update their avatar"
    on storage.objects for update
    using (
      bucket_id = 'avatars'
      and auth.role() = 'authenticated'
      and (storage.foldername(name))[1] = auth.uid()::text
    );
exception when duplicate_object then null; end $$;
