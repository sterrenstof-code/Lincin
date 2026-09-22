-- 0068 — een lijst aanmaken kon helemaal niet.
--
-- `createSharedList` kreeg van PostgREST een 403 met 42501: "new row
-- violates row-level security policy for table shared_lists". Niet soms,
-- altijd — met een geldig token (rol `authenticated`, niet verlopen) en
-- een `user_id` die letterlijk de `sub` uit datzelfde token was. De
-- insert-policy leest `auth.uid() = user_id`, dus op papier hoort dat te
-- kloppen; in de database kwam de schrijfkant er niet doorheen.
--
-- Wat er precies scheef stond valt van buitenaf niet meer te zien, en het
-- maakt voor de oplossing niet uit: de policies worden hier opnieuw gezet,
-- nu mét een expliciete `to authenticated`. Zonder die rolbepaling valt een
-- policy terug op `public`, en dan hangt het van de grants af of een
-- ingelogde sessie er iets aan heeft. Al deze handelingen horen bij een
-- ingelogde gebruiker en bij niemand anders, dus staat dat er nu.
--
-- De delete-policy uit 0037 ontbrak bovendien in `pg_policies`: je kon je
-- eigen lijst niet weggooien. Die staat hieronder weer.
--
-- Dit was de laatste reden dat gedeelde lijsten dood in de app zaten. De
-- schermen (`list-compose`, `list/[id]`, `lists`) en de API bestonden al.

-- ── shared_lists ────────────────────────────────────────────────────────────
drop policy if exists "shared_lists: read"   on public.shared_lists;
drop policy if exists "shared_lists: insert" on public.shared_lists;
drop policy if exists "shared_lists: update" on public.shared_lists;
drop policy if exists "shared_lists: delete" on public.shared_lists;

-- Eigenaar of lid. `can_see_list` is SECURITY DEFINER (0065/0066) en kijkt
-- dus buiten RLS om; daarmee blijft de kringverwijzing weg die 0066 brak.
create policy "shared_lists: read"
  on public.shared_lists for select
  to authenticated
  using (public.can_see_list(id));

create policy "shared_lists: insert"
  on public.shared_lists for insert
  to authenticated
  with check (auth.uid() = user_id);

-- `with check` erbij: zonder dat kun je een rij die van jou is wegschrijven
-- naar een `user_id` die niet van jou is, en hem zo kwijtraken.
create policy "shared_lists: update"
  on public.shared_lists for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "shared_lists: delete"
  on public.shared_lists for delete
  to authenticated
  using (auth.uid() = user_id);

-- ── list_members ────────────────────────────────────────────────────────────
-- Dezelfde rolbepaling, want `createSharedList` schrijft hier meteen na de
-- lijst zelf in: zou dit dezelfde kwaal hebben, dan maak je wel een lijst
-- maar deel je hem met niemand.
drop policy if exists "list_members: read"   on public.list_members;
drop policy if exists "list_members: insert" on public.list_members;
drop policy if exists "list_members: delete" on public.list_members;

create policy "list_members: read"
  on public.list_members for select
  to authenticated
  using (public.can_see_list(list_id));

create policy "list_members: insert"
  on public.list_members for insert
  to authenticated
  with check (public.is_list_owner(list_id));

create policy "list_members: delete"
  on public.list_members for delete
  to authenticated
  using (auth.uid() = user_id or public.is_list_owner(list_id));

-- ── list_items ──────────────────────────────────────────────────────────────
drop policy if exists "list_items: read"   on public.list_items;
drop policy if exists "list_items: insert" on public.list_items;
drop policy if exists "list_items: update" on public.list_items;
drop policy if exists "list_items: delete" on public.list_items;

create policy "list_items: read"
  on public.list_items for select
  to authenticated
  using (public.can_see_list(list_id));

create policy "list_items: insert"
  on public.list_items for insert
  to authenticated
  with check (auth.uid() = user_id and public.can_see_list(list_id));

-- Afvinken doet iedereen die de lijst ziet; dat is de hele bedoeling van
-- een gedeelde lijst. De `with check` houdt tegen dat je een regel naar een
-- andere lijst verplaatst die je níet mag zien.
create policy "list_items: update"
  on public.list_items for update
  to authenticated
  using (public.can_see_list(list_id))
  with check (public.can_see_list(list_id));

create policy "list_items: delete"
  on public.list_items for delete
  to authenticated
  using (auth.uid() = user_id or public.is_list_owner(list_id));
