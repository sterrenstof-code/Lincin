-- Fix: infinite recursion in shared_lists / list_members / list_items policies
-- Oorzaak: shared_lists-policy checkt list_members, list_members-policy checkt
--          shared_lists → kringverwijzing. Oplossing: elke tabel checkt alleen
--          zijn eigen kolommen of één niveau omhoog, nooit terug.

-- ── shared_lists ────────────────────────────────────────────────────────────
drop policy if exists "shared_lists: member read"   on public.shared_lists;
drop policy if exists "shared_lists: authenticated insert" on public.shared_lists;
drop policy if exists "shared_lists: owner delete"  on public.shared_lists;
drop policy if exists "shared_lists: owner update"  on public.shared_lists;

-- Lees: maker óf jij staat in list_members (directe check, geen join terug)
create policy "shared_lists: read"
  on public.shared_lists for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.list_members lm
      where lm.list_id = id
        and lm.user_id = auth.uid()
    )
  );

create policy "shared_lists: insert"
  on public.shared_lists for insert
  with check (auth.uid() = user_id);

create policy "shared_lists: update"
  on public.shared_lists for update
  using (auth.uid() = user_id);

create policy "shared_lists: delete"
  on public.shared_lists for delete
  using (auth.uid() = user_id);

-- ── list_members ─────────────────────────────────────────────────────────────
drop policy if exists "list_members: member read"  on public.list_members;
drop policy if exists "list_members: owner insert" on public.list_members;
drop policy if exists "list_members: owner delete" on public.list_members;

-- Lees: jij bent zelf lid, ÓÓOF jij bent maker van de lijst
-- (checkt shared_lists.user_id — geen list_members join → geen recursie)
create policy "list_members: read"
  on public.list_members for select
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_lists sl
      where sl.id = list_id
        and sl.user_id = auth.uid()
    )
  );

create policy "list_members: insert"
  on public.list_members for insert
  with check (
    exists (
      select 1 from public.shared_lists sl
      where sl.id = list_id
        and sl.user_id = auth.uid()
    )
  );

create policy "list_members: delete"
  on public.list_members for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_lists sl
      where sl.id = list_id
        and sl.user_id = auth.uid()
    )
  );

-- ── list_items ────────────────────────────────────────────────────────────────
drop policy if exists "list_items: member read"   on public.list_items;
drop policy if exists "list_items: member insert" on public.list_items;
drop policy if exists "list_items: member update" on public.list_items;
drop policy if exists "list_items: owner or author delete" on public.list_items;

-- Hulpfunctie: ben jij lid of maker van deze lijst?
-- (één niveau omhoog naar shared_lists + list_members, geen verdere joins)
create policy "list_items: read"
  on public.list_items for select
  using (
    exists (
      select 1 from public.shared_lists sl
      where sl.id = list_id
        and (
          sl.user_id = auth.uid()
          or exists (select 1 from public.list_members lm where lm.list_id = sl.id and lm.user_id = auth.uid())
        )
    )
  );

create policy "list_items: insert"
  on public.list_items for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.shared_lists sl
      where sl.id = list_id
        and (
          sl.user_id = auth.uid()
          or exists (select 1 from public.list_members lm where lm.list_id = sl.id and lm.user_id = auth.uid())
        )
    )
  );

create policy "list_items: update"
  on public.list_items for update
  using (
    exists (
      select 1 from public.shared_lists sl
      where sl.id = list_id
        and (
          sl.user_id = auth.uid()
          or exists (select 1 from public.list_members lm where lm.list_id = sl.id and lm.user_id = auth.uid())
        )
    )
  );

create policy "list_items: delete"
  on public.list_items for delete
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.shared_lists sl
      where sl.id = list_id and sl.user_id = auth.uid()
    )
  );
