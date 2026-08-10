-- Notify mutual friends when a sighting is published for the first time.

do $$ begin
  alter type public.activity_type add value 'post';
exception when duplicate_object then null; end $$;

alter table public.profiles
  alter column notification_prefs set default '{
    "likes": true,
    "comments": true,
    "follows": true,
    "reposts": true,
    "friend_posts": true,
    "nearby_rare": true
  }'::jsonb;

update public.profiles
set notification_prefs = notification_prefs || '{"friend_posts": true}'::jsonb
where not (notification_prefs ? 'friend_posts');

create or replace function public.on_sighting_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.removed_at is not null then
    delete from public.activity
     where type = 'post'
       and sighting_id = new.id;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.published_at is not null
     and new.published_at is null then
    delete from public.activity
     where type = 'post'
       and sighting_id = new.id;
    return new;
  end if;

  if new.published_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.published_at is not null then
    return new;
  end if;

  insert into public.activity (recipient_id, actor_id, type, sighting_id, detail)
  select
    friend.friend_id,
    new.user_id,
    'post',
    new.id,
    'posted a ' || new.species || ' sighting'
  from (
    select f1.following_id as friend_id
    from public.follows f1
    where f1.follower_id = new.user_id
      and exists (
        select 1
        from public.follows f2
        where f2.follower_id = f1.following_id
          and f2.following_id = new.user_id
      )
  ) as friend
  where friend.friend_id <> new.user_id
    and public.can_view_sighting(
      friend.friend_id,
      new.user_id,
      coalesce(new.visibility, 'public'::public.sighting_visibility),
      new.published_at
    )
    and not public.is_user_blocked(friend.friend_id, new.user_id)
    and not public.is_user_blocked(new.user_id, friend.friend_id);

  return new;
end;
$$;

drop trigger if exists trg_on_sighting_published on public.sightings;
create trigger trg_on_sighting_published
  after insert or update of published_at, removed_at
  on public.sightings
  for each row
  execute function public.on_sighting_published();
