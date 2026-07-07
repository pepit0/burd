-- Friend system helpers (reusing public.follows).
-- Mutual edges = friends.
-- Single directional edge = pending friend request.

-- Mutual friend ids for the current user.
create or replace function public.friend_ids()
returns setof uuid
language sql stable security invoker
as $$
  select f.following_id
  from public.follows f
  where f.follower_id = auth.uid()
    and exists (
      select 1
      from public.follows r
      where r.follower_id = f.following_id
        and r.following_id = auth.uid()
    );
$$;

-- Incoming friend requests (who requested me).
create or replace function public.incoming_friend_request_ids()
returns setof uuid
language sql stable security invoker
as $$
  select f.follower_id
  from public.follows f
  where f.following_id = auth.uid()
    and not exists (
      select 1
      from public.follows r
      where r.follower_id = auth.uid()
        and r.following_id = f.follower_id
    );
$$;

-- Outgoing friend requests (who I requested).
create or replace function public.outgoing_friend_request_ids()
returns setof uuid
language sql stable security invoker
as $$
  select f.following_id
  from public.follows f
  where f.follower_id = auth.uid()
    and not exists (
      select 1
      from public.follows r
      where r.follower_id = f.following_id
        and r.following_id = auth.uid()
    );
$$;

-- Replace following_feed with friends-only feed (mutual only).
drop function if exists public.following_feed();

create or replace function public.following_feed()
returns setof public.sighting_feed
language sql stable security invoker
as $$
  select f.*
  from public.sighting_feed f
  where f.user_id in (select public.friend_ids())
  order by f.created_at desc
  limit 100;
$$;

