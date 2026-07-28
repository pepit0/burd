-- Reposts: users can repost others' published sightings to their profile.

do $$ begin
  alter type public.activity_type add value 'repost';
exception when duplicate_object then null; end $$;

create table if not exists public.reposts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, sighting_id)
);

alter table public.reposts enable row level security;

create index if not exists reposts_user_id_created_at_idx
  on public.reposts (user_id, created_at desc);

create index if not exists reposts_sighting_id_idx
  on public.reposts (sighting_id);

do $$ begin
  create policy "Reposts are viewable by everyone"
    on public.reposts for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can repost published posts by others"
    on public.reposts for insert
    with check (
      auth.uid() = user_id
      and exists (
        select 1
        from public.sightings s
        where s.id = sighting_id
          and s.published_at is not null
          and s.removed_at is null
          and s.user_id <> auth.uid()
      )
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can unrepost"
    on public.reposts for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Repost → activity for the sighting owner
create or replace function public.on_repost_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare owner uuid; sp text;
begin
  select user_id, species into owner, sp from public.sightings where id = new.sighting_id;
  if owner is not null and owner <> new.user_id then
    insert into public.activity (recipient_id, actor_id, type, sighting_id, detail)
    values (owner, new.user_id, 'repost', new.sighting_id, 'reposted your ' || sp || ' sighting');
  end if;
  return new;
end; $$;

drop trigger if exists trg_on_repost_created on public.reposts;
create trigger trg_on_repost_created after insert on public.reposts
  for each row execute function public.on_repost_created();

create or replace function public.on_repost_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.activity
   where type = 'repost' and actor_id = old.user_id and sighting_id = old.sighting_id;
  return old;
end; $$;

drop trigger if exists trg_on_repost_deleted on public.reposts;
create trigger trg_on_repost_deleted after delete on public.reposts
  for each row execute function public.on_repost_deleted();
