-- Journal entries are editable only before they are posted to profile.
drop policy if exists "Users can update their own sightings" on public.sightings;
drop policy if exists "Users can update unpublished journal sightings" on public.sightings;

create policy "Users can update unpublished journal sightings"
  on public.sightings for update
  using (auth.uid() = user_id and published_at is null)
  with check (auth.uid() = user_id);
