-- Versoepel de call_plan lees-policy:
-- Vrienden van de maker mogen een call plan ook zien,
-- ook als ze nog niet expliciet uitgenodigd zijn.
-- (Uitnodiging blijft nodig om te stemmen.)

drop policy if exists "call_plans: creator or invitee read" on public.call_plans;

create policy "call_plans: creator or friend read"
  on public.call_plans for select
  using (
    -- Jij bent de maker
    auth.uid() = user_id
    or
    -- Jij bent expliciet uitgenodigd
    exists (
      select 1 from public.call_plan_invites
      where call_plan_id = id
        and user_id = auth.uid()
    )
    or
    -- Jij bent een vriend van de maker (accepted friendship)
    exists (
      select 1 from public.friendships
      where status = 'accepted'
        and (
          (requester_id = user_id and addressee_id = auth.uid())
          or
          (addressee_id = user_id and requester_id = auth.uid())
        )
    )
  );

-- Zelfde versoepeling voor slots
drop policy if exists "call_plan_slots: creator or invitee read" on public.call_plan_slots;

create policy "call_plan_slots: creator or friend read"
  on public.call_plan_slots for select
  using (
    exists (
      select 1 from public.call_plans cp
      where cp.id = call_plan_id
        and (
          cp.user_id = auth.uid()
          or exists (
            select 1 from public.call_plan_invites
            where call_plan_id = cp.id and user_id = auth.uid()
          )
          or exists (
            select 1 from public.friendships
            where status = 'accepted'
              and (
                (requester_id = cp.user_id and addressee_id = auth.uid())
                or (addressee_id = cp.user_id and requester_id = auth.uid())
              )
          )
        )
    )
  );

-- Zelfde voor votes
drop policy if exists "call_plan_votes: creator or invitee read" on public.call_plan_votes;

create policy "call_plan_votes: creator or friend read"
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
            where call_plan_id = cp.id and user_id = auth.uid()
          )
          or exists (
            select 1 from public.friendships
            where status = 'accepted'
              and (
                (requester_id = cp.user_id and addressee_id = auth.uid())
                or (addressee_id = cp.user_id and requester_id = auth.uid())
              )
          )
        )
    )
  );

-- Stemmen: ook vrienden mogen stemmen (niet alleen uitgenodigden)
drop policy if exists "call_plan_votes: invitee insert" on public.call_plan_votes;

create policy "call_plan_votes: friend insert"
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
            where call_plan_id = cp.id and user_id = auth.uid()
          )
          or exists (
            select 1 from public.friendships
            where status = 'accepted'
              and (
                (requester_id = cp.user_id and addressee_id = auth.uid())
                or (addressee_id = cp.user_id and requester_id = auth.uid())
              )
          )
        )
    )
  );
