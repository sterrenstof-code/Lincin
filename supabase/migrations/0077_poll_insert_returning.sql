-- Een poll of belafspraak maken gaf "new row violates row-level security
-- policy for table polls".
--
-- De app maakt hem met `insert … returning` (supabase-js `.select()`), en
-- dan moet de nieuwe rij ook door de leesregel. Die regel (0063/0064) roept
-- `can_see_poll(id)` aan, en die zoekt de poll op zijn id op in de tabel.
-- Maar een `stable` functie kijkt naar de stand van vóór de insert: de
-- nieuwe rij bestaat voor hem nog niet, dus "niet zichtbaar", dus
-- geweigerd — ook voor de maker zelf.
--
-- De maker ziet zijn eigen rij nu rechtstreeks aan de kolom `user_id`,
-- zonder opzoeking. Voor alle anderen verandert er niets.

drop policy if exists "polls: wie hem mag zien" on public.polls;
create policy "polls: wie hem mag zien"
  on public.polls for select
  using (user_id = auth.uid() or public.can_see_poll(id));

drop policy if exists "call_plans: wie hem mag zien" on public.call_plans;
create policy "call_plans: wie hem mag zien"
  on public.call_plans for select
  using (user_id = auth.uid() or public.can_see_call_plan(id));

notify pgrst, 'reload schema';
