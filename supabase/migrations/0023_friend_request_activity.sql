-- Friend request activity triggers (reusing public.follows).
-- We keep activity.type = 'follow' for compatibility, but change the detail:
-- - A -> B inserted and B -> A missing: "sent you a friend request"
-- - A -> B inserted and B -> A exists: "accepted your friend request" (this insert was the acceptance)

create or replace function public.on_follow_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  reciprocal_exists boolean;
begin
  select exists(
    select 1
    from public.follows r
    where r.follower_id = new.following_id
      and r.following_id = new.follower_id
  ) into reciprocal_exists;

  if reciprocal_exists then
    -- Acceptance: notify the original requester (new.following_id).
    insert into public.activity (recipient_id, actor_id, type, detail)
    values (new.following_id, new.follower_id, 'follow', 'accepted your friend request');
  else
    -- Request: notify the recipient (new.following_id).
    insert into public.activity (recipient_id, actor_id, type, detail)
    values (new.following_id, new.follower_id, 'follow', 'sent you a friend request');
  end if;

  return new;
end;
$$;

create or replace function public.on_follow_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Best-effort cleanup of friend-request / acceptance activity between these two users.
  delete from public.activity
   where type = 'follow'
     and actor_id = old.follower_id
     and recipient_id = old.following_id;
  return old;
end;
$$;

drop trigger if exists trg_on_follow_created on public.follows;
create trigger trg_on_follow_created
  after insert on public.follows
  for each row execute function public.on_follow_created();

drop trigger if exists trg_on_follow_deleted on public.follows;
create trigger trg_on_follow_deleted
  after delete on public.follows
  for each row execute function public.on_follow_deleted();

