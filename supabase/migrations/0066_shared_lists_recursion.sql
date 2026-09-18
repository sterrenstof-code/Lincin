-- 0066 — gedeelde lijsten laden weer.
--
-- 0037 moest een kringverwijzing breken, maar de kring bleef: de
-- lees-policy van shared_lists kijkt in list_members, en die van
-- list_members kijkt terug in shared_lists. Postgres ziet dat bij het
-- plannen en weigert élke vraag ("infinite recursion", een 500).
--
-- Nu kijkt geen enkele policy nog in een andere tabel met RLS: eigenaar
-- en lidmaatschap worden nagekeken door twee SECURITY DEFINER-functies,
-- buiten de RLS om. can_see_list (0065) = eigenaar of lid.

create or replace function public.is_list_owner(p_list_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.shared_lists sl
     where sl.id = p_list_id and sl.user_id = auth.uid()
  );
$$;
grant execute on function public.is_list_owner(uuid) to authenticated;

-- ── shared_lists ────────────────────────────────────────────────────────────
drop policy if exists "shared_lists: read" on public.shared_lists;
create policy "shared_lists: read"
  on public.shared_lists for select
  using (public.can_see_list(id));

-- ── list_members ────────────────────────────────────────────────────────────
drop policy if exists "list_members: read" on public.list_members;
drop policy if exists "list_members: insert" on public.list_members;
drop policy if exists "list_members: delete" on public.list_members;

-- Wie er op de lijst staat, zie je als je de lijst zelf ziet.
create policy "list_members: read"
  on public.list_members for select
  using (public.can_see_list(list_id));

create policy "list_members: insert"
  on public.list_members for insert
  with check (public.is_list_owner(list_id));

create policy "list_members: delete"
  on public.list_members for delete
  using (auth.uid() = user_id or public.is_list_owner(list_id));

-- ── list_items ──────────────────────────────────────────────────────────────
drop policy if exists "list_items: read" on public.list_items;
drop policy if exists "list_items: insert" on public.list_items;
drop policy if exists "list_items: update" on public.list_items;
drop policy if exists "list_items: delete" on public.list_items;

create policy "list_items: read"
  on public.list_items for select
  using (public.can_see_list(list_id));

create policy "list_items: insert"
  on public.list_items for insert
  with check (auth.uid() = user_id and public.can_see_list(list_id));

create policy "list_items: update"
  on public.list_items for update
  using (public.can_see_list(list_id));

create policy "list_items: delete"
  on public.list_items for delete
  using (auth.uid() = user_id or public.is_list_owner(list_id));
