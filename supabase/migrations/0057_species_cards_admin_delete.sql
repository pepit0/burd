-- Admins can delete species cards so they can be earned again.

drop policy if exists "Admins can delete species cards" on public.species_cards;
create policy "Admins can delete species cards"
  on public.species_cards for delete
  using (public.is_admin());
