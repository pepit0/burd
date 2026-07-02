-- Likes on comments
create table if not exists public.comment_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index if not exists comment_likes_comment_id_idx
  on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

do $$ begin
  create policy "Comment likes are viewable by everyone"
    on public.comment_likes for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can like comments"
    on public.comment_likes for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can unlike comments"
    on public.comment_likes for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Link comment-like notifications to a specific comment
alter table public.activity
  add column if not exists comment_id uuid references public.comments(id) on delete cascade;

create or replace function public.on_comment_like_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  author uuid;
  sid uuid;
begin
  select user_id, sighting_id into author, sid
  from public.comments where id = new.comment_id;

  if author is not null and author <> new.user_id then
    insert into public.activity (recipient_id, actor_id, type, sighting_id, comment_id, detail)
    values (author, new.user_id, 'like', sid, new.comment_id, 'liked your comment');
  end if;

  return new;
end; $$;

drop trigger if exists trg_on_comment_like_created on public.comment_likes;
create trigger trg_on_comment_like_created after insert on public.comment_likes
  for each row execute function public.on_comment_like_created();

create or replace function public.on_comment_like_deleted()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.activity
   where type = 'like'
     and actor_id = old.user_id
     and comment_id = old.comment_id;
  return old;
end; $$;

drop trigger if exists trg_on_comment_like_deleted on public.comment_likes;
create trigger trg_on_comment_like_deleted after delete on public.comment_likes
  for each row execute function public.on_comment_like_deleted();
