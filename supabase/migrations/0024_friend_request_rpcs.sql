-- Friend request RPCs (security definer) to work with existing RLS on public.follows.
-- These functions are used by the client to accept/decline/cancel/unfriend.

create or replace function public.send_friend_request(target_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.follows (follower_id, following_id)
  values (auth.uid(), target_id)
  on conflict do nothing;
$$;

create or replace function public.cancel_friend_request(target_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.follows
  where follower_id = auth.uid()
    and following_id = target_id;
$$;

create or replace function public.accept_friend_request(requester_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Ensure there is an incoming request.
  if not exists (
    select 1 from public.follows
    where follower_id = requester_id
      and following_id = auth.uid()
  ) then
    return;
  end if;

  insert into public.follows (follower_id, following_id)
  values (auth.uid(), requester_id)
  on conflict do nothing;
end;
$$;

create or replace function public.decline_friend_request(requester_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.follows
  where follower_id = requester_id
    and following_id = auth.uid();
$$;

create or replace function public.unfriend(friend_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.follows
  where (follower_id = auth.uid() and following_id = friend_id)
     or (follower_id = friend_id and following_id = auth.uid());
$$;

