-- Journal entries stay editable after posting; posting only controls feed/profile visibility.
drop policy if exists "Users can update unpublished journal sightings" on public.sightings;
drop policy if exists "Users can update their own journal sightings" on public.sightings;

create policy "Users can update their own journal sightings"
  on public.sightings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
