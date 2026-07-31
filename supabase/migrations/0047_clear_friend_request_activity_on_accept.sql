-- Remove pending friend-request notifications when the request is accepted.

create or replace function public.accept_friend_request(requester_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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

  delete from public.activity
  where type = 'follow'
    and recipient_id = auth.uid()
    and actor_id = requester_id
    and detail = 'sent you a friend request';
end;
$$;
