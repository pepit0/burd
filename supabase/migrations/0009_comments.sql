-- Threaded comments on sightings
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  sighting_id uuid not null references public.sightings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists comments_sighting_id_idx
  on public.comments (sighting_id, created_at);

create index if not exists comments_parent_id_idx
  on public.comments (parent_id);

alter table public.comments enable row level security;

do $$ begin
  create policy "Comments are viewable by everyone"
    on public.comments for select using (true);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can comment"
    on public.comments for insert with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can edit their own comments"
    on public.comments for update using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can delete their own comments"
    on public.comments for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- Replies must belong to the same sighting as their parent
create or replace function public.validate_comment_parent()
returns trigger language plpgsql as $$
declare parent_sighting uuid;
begin
  if new.parent_id is not null then
    select sighting_id into parent_sighting
    from public.comments where id = new.parent_id;
    if parent_sighting is null or parent_sighting <> new.sighting_id then
      raise exception 'Parent comment must belong to the same sighting';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_validate_comment_parent on public.comments;
create trigger trg_validate_comment_parent
  before insert or update on public.comments
  for each row execute function public.validate_comment_parent();

-- Comment → activity for sighting owner and parent comment author
create or replace function public.on_comment_created()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  owner uuid;
  parent_author uuid;
  sp text;
begin
  select user_id, species into owner, sp
  from public.sightings where id = new.sighting_id;

  if owner is not null and owner <> new.user_id then
    insert into public.activity (recipient_id, actor_id, type, sighting_id, detail)
    values (
      owner,
      new.user_id,
      'comment',
      new.sighting_id,
      'commented on your ' || sp || ' sighting'
    );
  end if;

  if new.parent_id is not null then
    select user_id into parent_author from public.comments where id = new.parent_id;
    if parent_author is not null
       and parent_author <> new.user_id
       and parent_author is distinct from owner then
      insert into public.activity (recipient_id, actor_id, type, sighting_id, detail)
      values (
        parent_author,
        new.user_id,
        'comment',
        new.sighting_id,
        'replied to your comment'
      );
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists trg_on_comment_created on public.comments;
create trigger trg_on_comment_created after insert on public.comments
  for each row execute function public.on_comment_created();
