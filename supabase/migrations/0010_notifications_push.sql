-- In-app notification read state
alter table public.activity
  add column if not exists read_at timestamptz;

create index if not exists activity_unread_idx
  on public.activity (recipient_id, read_at, created_at desc);

do $$ begin
  create policy "Users can mark activity read"
    on public.activity for update using (auth.uid() = recipient_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can clear their activity"
    on public.activity for delete using (auth.uid() = recipient_id);
exception when duplicate_object then null; end $$;

-- Expo push tokens per device
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web', 'unknown')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

do $$ begin
  create policy "Users manage their push tokens"
    on public.push_tokens for all using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

create or replace function public.unread_activity_count()
returns integer
language sql stable security invoker
as $$
  select count(*)::integer
  from public.activity
  where recipient_id = auth.uid()
    and read_at is null;
$$;

-- Queue push delivery when activity is created (best-effort; never blocks inserts)
create extension if not exists pg_net with schema extensions;

create or replace function public.enqueue_activity_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  project_url text;
begin
  project_url := current_setting('app.settings.supabase_url', true);
  if project_url is null or project_url = '' then
    project_url := 'https://ldluootquzvmfvhpmcfx.supabase.co';
  end if;

  perform net.http_post(
    url := project_url || '/functions/v1/activity-push',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('activity_id', NEW.id)
  );

  return NEW;
exception when others then
  return NEW;
end;
$$;

drop trigger if exists trg_enqueue_activity_push on public.activity;
create trigger trg_enqueue_activity_push
  after insert on public.activity
  for each row execute function public.enqueue_activity_push();

-- Realtime updates for in-app badge
alter publication supabase_realtime add table public.activity;
