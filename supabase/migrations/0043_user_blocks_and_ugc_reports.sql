-- User blocks, expanded UGC reports, and block_user RPC (Apple Guideline 1.2).

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists user_blocks_blocker_idx
  on public.user_blocks (blocker_id, created_at desc);

alter table public.user_blocks enable row level security;

drop policy if exists "Users manage own blocks" on public.user_blocks;
create policy "Users manage own blocks"
  on public.user_blocks
  for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

drop policy if exists "Admins read all blocks" on public.user_blocks;
create policy "Admins read all blocks"
  on public.user_blocks
  for select
  using (public.is_admin());

-- Expand post_reports
alter table public.post_reports
  add column if not exists reason text,
  add column if not exists status text not null default 'pending';

do $$ begin
  alter table public.post_reports
    add constraint post_reports_status_check
    check (status in ('pending', 'resolved', 'dismissed'));
exception when duplicate_object then null; end $$;

create table if not exists public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default '',
  source text not null default 'report',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (reporter_id, reported_user_id),
  check (reporter_id <> reported_user_id),
  check (status in ('pending', 'resolved', 'dismissed'))
);

create index if not exists user_reports_status_idx
  on public.user_reports (status, created_at desc);

alter table public.user_reports enable row level security;

drop policy if exists "Users can report users" on public.user_reports;
create policy "Users can report users"
  on public.user_reports
  for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Users read own user reports" on public.user_reports;
create policy "Users read own user reports"
  on public.user_reports
  for select
  using (auth.uid() = reporter_id);

drop policy if exists "Admins read user reports" on public.user_reports;
create policy "Admins read user reports"
  on public.user_reports
  for select
  using (public.is_admin());

create table if not exists public.comment_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  reason text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  unique (reporter_id, comment_id),
  check (status in ('pending', 'resolved', 'dismissed'))
);

create index if not exists comment_reports_status_idx
  on public.comment_reports (status, created_at desc);

alter table public.comment_reports enable row level security;

drop policy if exists "Users can report comments" on public.comment_reports;
create policy "Users can report comments"
  on public.comment_reports
  for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Users read own comment reports" on public.comment_reports;
create policy "Users read own comment reports"
  on public.comment_reports
  for select
  using (auth.uid() = reporter_id);

drop policy if exists "Admins read comment reports" on public.comment_reports;
create policy "Admins read comment reports"
  on public.comment_reports
  for select
  using (public.is_admin());

create or replace function public.is_user_blocked(viewer_id uuid, author_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select viewer_id is not null
    and author_id is not null
    and exists (
      select 1
      from public.user_blocks b
      where b.blocker_id = viewer_id
        and b.blocked_id = author_id
    );
$$;

create or replace function public.block_user(
  p_blocked_id uuid,
  p_reason text default 'Blocked by user'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocker uuid := auth.uid();
  v_reason text := coalesce(nullif(trim(p_reason), ''), 'Blocked by user');
begin
  if v_blocker is null then
    raise exception 'Not authenticated';
  end if;
  if v_blocker = p_blocked_id then
    raise exception 'Cannot block yourself';
  end if;

  insert into public.user_blocks (blocker_id, blocked_id)
  values (v_blocker, p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;

  insert into public.user_reports (
    reporter_id,
    reported_user_id,
    reason,
    source,
    status
  )
  values (v_blocker, p_blocked_id, v_reason, 'block', 'pending')
  on conflict (reporter_id, reported_user_id) do update
  set
    reason = excluded.reason,
    source = excluded.source,
    status = 'pending',
    created_at = now();

  delete from public.follows
  where (follower_id = v_blocker and following_id = p_blocked_id)
     or (follower_id = p_blocked_id and following_id = v_blocker);
end;
$$;

create or replace function public.unblock_user(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_blocker uuid := auth.uid();
begin
  if v_blocker is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.user_blocks
  where blocker_id = v_blocker
    and blocked_id = p_blocked_id;
end;
$$;

create or replace function public.admin_dismiss_report(
  p_report_type text,
  p_report_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_report_type = 'post' then
    update public.post_reports
    set status = 'dismissed'
    where id = p_report_id;
  elsif p_report_type = 'user' then
    update public.user_reports
    set status = 'dismissed'
    where id = p_report_id;
  elsif p_report_type = 'comment' then
    update public.comment_reports
    set status = 'dismissed'
    where id = p_report_id;
  else
    raise exception 'Unknown report type';
  end if;
end;
$$;

create or replace function public.admin_resolve_report(
  p_report_type text,
  p_report_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  if p_report_type = 'post' then
    update public.post_reports
    set status = 'resolved'
    where id = p_report_id;
  elsif p_report_type = 'user' then
    update public.user_reports
    set status = 'resolved'
    where id = p_report_id;
  elsif p_report_type = 'comment' then
    update public.comment_reports
    set status = 'resolved'
    where id = p_report_id;
  else
    raise exception 'Unknown report type';
  end if;
end;
$$;

grant execute on function public.is_user_blocked(uuid, uuid) to authenticated;
grant execute on function public.block_user(uuid, text) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.admin_dismiss_report(text, uuid) to authenticated;
grant execute on function public.admin_resolve_report(text, uuid) to authenticated;

-- Hide blocked authors from the public feed view.
do $repair$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'sightings'
      and column_name = 'visibility'
  ) and exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_view_sighting'
  ) then
    drop function if exists public.nearby_sightings(double precision, double precision, double precision);
    drop function if exists public.following_feed();
    drop view if exists public.sighting_feed;

    execute $view$
      create view public.sighting_feed
      with (security_invoker = on) as
      select
        s.id, s.user_id, s.species, s.scientific_name, s.location_name,
        coalesce(s.public_latitude, s.latitude) as latitude,
        coalesce(s.public_longitude, s.longitude) as longitude,
        s.rarity, s.count, s.notes, s.photo_url, s.photo_count, s.created_at,
        p.username, p.avatar_color, p.avatar_url, p.full_name,
        coalesce(l.like_count, 0) as like_count,
        s.confidence, s.detected_by,
        s.observed_at, s.location_city, s.location_address,
        s.author_disqualified,
        s.audio_url,
        s.published_at,
        s.visibility,
        s.public_latitude,
        s.public_longitude,
        s.location_obscured_reason
      from public.sightings s
      join public.profiles p on p.id = s.user_id
      left join (
        select sighting_id, count(*)::int as like_count
        from public.likes group by sighting_id
      ) l on l.sighting_id = s.id
      where s.removed_at is null
        and s.published_at is not null
        and public.can_view_sighting(
          auth.uid(),
          s.user_id,
          s.visibility,
          s.published_at
        )
        and not public.is_user_blocked(auth.uid(), s.user_id)
    $view$;

    execute $fn$
      create or replace function public.nearby_sightings(
        in_lat double precision,
        in_lng double precision,
        in_radius_km double precision
      )
      returns setof public.sighting_feed
      language sql stable security invoker
      as $body$
        select f.*
        from public.sighting_feed f
        where f.latitude is not null
          and f.longitude is not null
          and (
            in_radius_km is null
            or public.km_between(in_lat, in_lng, f.latitude, f.longitude) <= in_radius_km
          )
        order by f.published_at desc
        limit 100;
      $body$;
    $fn$;

    execute $fn$
      create or replace function public.following_feed()
      returns setof public.sighting_feed
      language sql stable security invoker
      as $body$
        select f.*
        from public.sighting_feed f
        where f.user_id = auth.uid()
           or f.user_id in (select public.friend_ids())
        order by f.published_at desc
        limit 100;
      $body$;
    $fn$;
  end if;
end
$repair$;
