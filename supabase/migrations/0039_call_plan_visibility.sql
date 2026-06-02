-- Beperk zichtbaarheid van call_plans tot maker + uitgenodigden.
-- Vervangt de te permissieve "authenticated read" policies.

-- ── call_plans ───────────────────────────────────────────────────────────────
drop policy if exists "call_plans: authenticated read" on public.call_plans;

create policy "call_plans: creator or invitee read"
  on public.call_plans for select
  using (
    -- Jij bent de maker
    auth.uid() = user_id
    or
    -- Jij bent uitgenodigd
    exists (
      select 1 from public.call_plan_invites
      where call_plan_id = id
        and user_id = auth.uid()
    )
  );

-- ── call_plan_slots ──────────────────────────────────────────────────────────
drop policy if exists "call_plan_slots: authenticated read" on public.call_plan_slots;

create policy "call_plan_slots: creator or invitee read"
  on public.call_plan_slots for select
  using (
    exists (
      select 1 from public.call_plans cp
      where cp.id = call_plan_id
        and (
          cp.user_id = auth.uid()
          or exists (
            select 1 from public.call_plan_invites
            where call_plan_id = cp.id
              and user_id = auth.uid()
          )
        )
    )
  );

-- ── call_plan_votes ──────────────────────────────────────────────────────────
drop policy if exists "call_plan_votes: authenticated read" on public.call_plan_votes;

create policy "call_plan_votes: creator or invitee read"
  on public.call_plan_votes for select
  using (
    exists (
      select 1 from public.call_plan_slots s
      join public.call_plans cp on cp.id = s.call_plan_id
      where s.id = call_plan_slot_id
        and (
          cp.user_id = auth.uid()
          or exists (
            select 1 from public.call_plan_invites
            where call_plan_id = cp.id
              and user_id = auth.uid()
          )
        )
    )
  );

-- Alleen uitgenodigden (of maker) mogen stemmen
drop policy if exists "call_plan_votes: authenticated upsert" on public.call_plan_votes;

create policy "call_plan_votes: invitee insert"
  on public.call_plan_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.call_plan_slots s
      join public.call_plans cp on cp.id = s.call_plan_id
      where s.id = call_plan_slot_id
        and (
          cp.user_id = auth.uid()
          or exists (
            select 1 from public.call_plan_invites
            where call_plan_id = cp.id
              and user_id = auth.uid()
          )
        )
    )
  );
