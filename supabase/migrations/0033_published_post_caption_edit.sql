-- Owners can lightly edit published posts (caption only) without unpublishing.
create or replace function public.update_my_published_post(
  p_sighting_id uuid,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sightings
  set notes = nullif(trim(p_notes), '')
  where id = p_sighting_id
    and user_id = auth.uid()
    and published_at is not null
    and removed_at is null;

  if not found then
    raise exception 'Post not found or not editable';
  end if;
end;
$$;

grant execute on function public.update_my_published_post(uuid, text) to authenticated;
