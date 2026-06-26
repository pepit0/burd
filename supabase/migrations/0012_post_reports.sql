-- Post reports (moderation queue — expand later)
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sighting_id, reporter_id)
);

create index if not exists post_reports_sighting_id_idx
  on public.post_reports (sighting_id, created_at desc);

alter table public.post_reports enable row level security;

do $$ begin
  create policy "Users can report posts"
    on public.post_reports for insert
    with check (auth.uid() = reporter_id);
exception when duplicate_object then null; end $$;
