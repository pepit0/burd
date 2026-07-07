-- Admin RPC: update any user's username safely.

do $$ begin
  alter table public.moderation_actions
    drop constraint if exists moderation_actions_action_check;
exception when undefined_table then null; end $$;

do $$ begin
  alter table public.moderation_actions
    add constraint moderation_actions_action_check
    check (
      action in (
        'remove_post',
        'edit_post',
        'suspend_user',
        'unsuspend_user',
        'grant_admin',
        'revoke_admin',
        'remove_field_guide_author',
        'change_username'
      )
    );
exception when duplicate_object then null; end $$;

create or replace function public.admin_update_username(
  p_user_id uuid,
  p_new_username text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned_username text;
  old_username text;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  cleaned_username := lower(trim(regexp_replace(coalesce(p_new_username, ''), '^@+', '')));

  if cleaned_username !~ '^[a-z][a-z0-9_]{2,29}$' then
    raise exception 'Usernames must be 3-30 chars, start with a letter, and use only letters, numbers, underscores';
  end if;

  select username into old_username
  from public.profiles
  where id = p_user_id;

  if old_username is null then
    raise exception 'User not found';
  end if;

  if old_username = cleaned_username then
    return;
  end if;

  begin
    update public.profiles
    set username = cleaned_username
    where id = p_user_id;
  exception when unique_violation then
    raise exception 'That username is already taken';
  end;

  perform public.log_moderation_action(
    'change_username',
    p_user_id,
    null,
    'Changed username from @' || old_username || ' to @' || cleaned_username,
    jsonb_build_object(
      'old_username', old_username,
      'new_username', cleaned_username
    )
  );

  insert into public.activity (recipient_id, actor_id, type, detail)
  values (
    p_user_id,
    auth.uid(),
    'moderation',
    'Your username was updated to @' || cleaned_username || ' by an admin'
  );
end;
$$;

