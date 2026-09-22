-- 0069 — de echte reden dat een lijst aanmaken mislukte.
--
-- 0068 zette de rollen goed, maar dat was niet de kwaal: de insert faalde
-- daarna nog steeds met 42501. Proefondervindelijk: dezelfde insert mét
-- `Prefer: return=minimal` slaagt (201) en de rij is daarna gewoon te
-- lezen. Het was dus nooit de insert-policy, maar de RETURNING.
--
-- `createSharedList` doet `insert(...).select(...)`. Postgres legt bij een
-- INSERT … RETURNING ook de SELECT-policy op de nieuwe rij, en meldt een
-- weigering daar met precies dezelfde tekst als een mislukte WITH CHECK:
-- "new row violates row-level security policy". De lees-policy was
-- `can_see_list(id)`, en die functie zoekt de lijst op in `shared_lists` —
-- waar de rij die dit statement net schrijft nog niet in zijn momentopname
-- staat. Voor je eigen nieuwe lijst gaf hij dus altijd `false`.
--
-- Eigenaarschap staat op de rij zelf; daarvoor hoeft niets opgezocht te
-- worden. Die voorwaarde vooraan, en de functie alleen nog voor wie lid is.

drop policy if exists "shared_lists: read" on public.shared_lists;
create policy "shared_lists: read"
  on public.shared_lists for select
  to authenticated
  using (auth.uid() = user_id or public.can_see_list(id));
