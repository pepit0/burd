-- Convert existing directional follows into mutual friends.
-- We reuse public.follows as the edge store:
-- - pending request: A -> B exists, B -> A missing
-- - friends: both A -> B and B -> A exist
--
-- This migration inserts reciprocal edges for all existing rows.
-- Triggers are disabled during backfill to avoid generating activity spam.

do $$ begin
  alter table public.follows disable trigger trg_on_follow_created;
exception when undefined_object then null; end $$;

do $$ begin
  alter table public.follows disable trigger trg_on_follow_deleted;
exception when undefined_object then null; end $$;

insert into public.follows (follower_id, following_id)
select f.following_id, f.follower_id
from public.follows f
where not exists (
  select 1
  from public.follows r
  where r.follower_id = f.following_id
    and r.following_id = f.follower_id
)
on conflict do nothing;

do $$ begin
  alter table public.follows enable trigger trg_on_follow_created;
exception when undefined_object then null; end $$;

do $$ begin
  alter table public.follows enable trigger trg_on_follow_deleted;
exception when undefined_object then null; end $$;

