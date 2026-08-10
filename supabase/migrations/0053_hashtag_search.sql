-- Hashtag index for searching published post captions (sightings.notes).

create table if not exists public.hashtags (
  tag text primary key,
  created_at timestamptz not null default now()
);

create table if not exists public.sighting_hashtags (
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  tag text not null references public.hashtags(tag) on delete cascade,
  primary key (sighting_id, tag)
);

create index if not exists sighting_hashtags_tag_idx
  on public.sighting_hashtags (tag);

alter table public.hashtags enable row level security;
alter table public.sighting_hashtags enable row level security;

create policy "hashtags are readable"
  on public.hashtags for select
  to authenticated
  using (true);

create policy "sighting_hashtags are readable"
  on public.sighting_hashtags for select
  to authenticated
  using (true);

create or replace function public.extract_hashtag_tags(p_text text)
returns text[]
language plpgsql
immutable
set search_path = public
as $$
declare
  tags text[] := '{}';
  match text;
begin
  if p_text is null or btrim(p_text) = '' then
    return tags;
  end if;

  for match in
    select (regexp_matches(p_text, '(?:^|\s)#([\w-]+)', 'g'))[1]
  loop
    if match is not null and btrim(match) <> '' then
      tags := array_append(tags, lower(btrim(match)));
    end if;
  end loop;

  return coalesce(
    (
      select array_agg(distinct t order by t)
      from unnest(tags) as t
    ),
    '{}'::text[]
  );
end;
$$;

create or replace function public.sync_sighting_hashtags()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_tags text[];
begin
  delete from public.sighting_hashtags
  where sighting_id = new.id;

  new_tags := public.extract_hashtag_tags(new.notes);

  if coalesce(array_length(new_tags, 1), 0) = 0 then
    return new;
  end if;

  insert into public.hashtags (tag)
  select unnest(new_tags)
  on conflict (tag) do nothing;

  insert into public.sighting_hashtags (sighting_id, tag)
  select new.id, unnest(new_tags)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists sync_sighting_hashtags_trigger on public.sightings;

create trigger sync_sighting_hashtags_trigger
after insert or update of notes on public.sightings
for each row
execute function public.sync_sighting_hashtags();

-- Backfill hashtags from existing captions / notes.
insert into public.hashtags (tag)
select distinct lower(m[1])
from public.sightings s,
     regexp_matches(s.notes, '(?:^|\s)#([\w-]+)', 'g') as m
where s.notes is not null
on conflict (tag) do nothing;

insert into public.sighting_hashtags (sighting_id, tag)
select distinct s.id, lower(m[1])
from public.sightings s,
     regexp_matches(s.notes, '(?:^|\s)#([\w-]+)', 'g') as m
where s.notes is not null
on conflict do nothing;

create or replace function public.search_sightings_by_hashtag(p_query text)
returns setof public.sighting_feed
language sql
stable
security invoker
set search_path = public
as $$
  with normalized as (
    select lower(trim(both '#' from coalesce(p_query, ''))) as q
  )
  select sf.*
  from public.sighting_feed sf
  join public.sighting_hashtags sh on sh.sighting_id = sf.id
  cross join normalized n
  where n.q <> ''
    and (
      sh.tag = n.q
      or sh.tag like n.q || '%'
      or n.q like sh.tag || '%'
      or sh.tag like '%' || n.q || '%'
    )
  order by sf.published_at desc nulls last
  limit 100;
$$;

grant execute on function public.search_sightings_by_hashtag(text) to authenticated;
