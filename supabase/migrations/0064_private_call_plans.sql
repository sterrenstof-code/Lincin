-- 0064 — een belafspraak in een gesprek is van dat gesprek.
--
-- Hetzelfde lek als bij polls (0063). 0040 liet vrienden van de maker
-- élke belafspraak lezen; 0050 wilde dat beperken tot maker en
-- uitgenodigden, maar liet de policies van 0040 staan. Policies tellen
-- op (OR), dus een belafspraak uit een gesprek tussen twee mensen was
-- leesbaar voor alle vrienden van de maker. En in 0050 wees
-- `call_plan_id = id` in de subquery naar het id van de uitnodiging,
-- niet naar dat van de afspraak.
--
-- Voortaan, via één functie (can_see_call_plan):
--   * in een gesprek (`chat_id`): de maker, de uitgenodigden en de leden
--     van dat gesprek;
--   * in de feed: de maker, de uitgenodigden en zijn lincs — zoals 0040
--     het bedoelde voor de feed.
--
-- Ook dicht:
--   * wie er uitgenodigd is (call_plan_invites) was voor iedereen leesbaar;
--   * comments op een belafspraak of een lijst;
--   * activity_events — wie wat deelde en wie met wie bevriend raakte —
--     was voor iedereen leesbaar; nu voor jezelf en je lincs.

-- ---------------------------------------------------------------
-- De kolom, en de afspraken die al in een gesprek stonden
-- ---------------------------------------------------------------

alter table public.call_plans
  add column if not exists chat_id uuid references public.chats (id) on delete cascade;

create index if not exists call_plans_chat_idx on public.call_plans (chat_id);

-- Zoals bij polls: welk bericht erbij hoort staat versleuteld; de maker
-- stuurt het direct na het aanmaken. Het eerste bericht van de maker
-- binnen 30 seconden wijst het gesprek aan — fout in de veilige richting.
update public.call_plans cp
   set chat_id = hit.chat_id
  from (
    select distinct on (c2.id) c2.id as plan_id, m.chat_id
      from public.call_plans c2
      join public.messages m
        on m.sender_id = c2.user_id
       and m.created_at >= c2.created_at
       and m.created_at <= c2.created_at + interval '30 seconds'
     where c2.chat_id is null
     order by c2.id, m.created_at
  ) hit
 where hit.plan_id = cp.id;

-- De trigger van 0063 claimt voortaan ook belafspraken voor oudere apps.
create or replace function public.polls_claim_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.polls
     set chat_id = new.chat_id
   where user_id = new.sender_id
     and chat_id is null
     and created_at >= new.created_at - interval '30 seconds'
     and created_at <= new.created_at;
  update public.call_plans
     set chat_id = new.chat_id
   where user_id = new.sender_id
     and chat_id is null
     and created_at >= new.created_at - interval '30 seconds'
     and created_at <= new.created_at;
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- Wie een belafspraak mag zien
-- ---------------------------------------------------------------

create or replace function public.can_see_call_plan(p_plan_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.call_plans cp
     where cp.id = p_plan_id
       and (
         cp.user_id = auth.uid()
         or exists (
           select 1 from public.call_plan_invites i
            where i.call_plan_id = cp.id and i.user_id = auth.uid()
         )
         or (
           cp.chat_id is not null
           and exists (
             select 1 from public.chat_members cm
              where cm.chat_id = cp.chat_id and cm.user_id = auth.uid()
           )
         )
         or (
           cp.chat_id is null
           and exists (
             select 1 from public.accepted_friends af
              where af.user_id = auth.uid() and af.friend_id = cp.user_id
           )
         )
       )
  );
$$;
grant execute on function public.can_see_call_plan(uuid) to authenticated;

-- call_plans
drop policy if exists "call_plans: creator or friend read" on public.call_plans;
drop policy if exists "call_plans: creator or invitee read" on public.call_plans;
drop policy if exists "call_plans: wie hem mag zien" on public.call_plans;
drop policy if exists "call_plans: owner insert" on public.call_plans;
drop policy if exists "call_plans: als jezelf, in je eigen gesprek" on public.call_plans;

create policy "call_plans: wie hem mag zien"
  on public.call_plans for select
  using (public.can_see_call_plan(id));

create policy "call_plans: als jezelf, in je eigen gesprek"
  on public.call_plans for insert
  with check (
    auth.uid() = user_id
    and (chat_id is null or public.is_chat_member(chat_id))
  );

-- call_plan_slots
drop policy if exists "call_plan_slots: creator or friend read" on public.call_plan_slots;
drop policy if exists "call_plan_slots: creator or invitee read" on public.call_plan_slots;
drop policy if exists "call_plan_slots: met de afspraak" on public.call_plan_slots;

create policy "call_plan_slots: met de afspraak"
  on public.call_plan_slots for select
  using (public.can_see_call_plan(call_plan_id));

-- call_plan_votes
drop policy if exists "call_plan_votes: creator or friend read" on public.call_plan_votes;
drop policy if exists "call_plan_votes: creator or invitee read" on public.call_plan_votes;
drop policy if exists "call_plan_votes: friend insert" on public.call_plan_votes;
drop policy if exists "call_plan_votes: invitee insert" on public.call_plan_votes;
drop policy if exists "call_plan_votes: met de afspraak" on public.call_plan_votes;
drop policy if exists "call_plan_votes: stem op wat je ziet" on public.call_plan_votes;

create policy "call_plan_votes: met de afspraak"
  on public.call_plan_votes for select
  using (
    exists (
      select 1 from public.call_plan_slots s
       where s.id = call_plan_slot_id and public.can_see_call_plan(s.call_plan_id)
    )
  );

create policy "call_plan_votes: stem op wat je ziet"
  on public.call_plan_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.call_plan_slots s
       where s.id = call_plan_slot_id and public.can_see_call_plan(s.call_plan_id)
    )
  );

-- call_plan_invites: wie er uitgenodigd is, zie je alleen als je de
-- afspraak zelf mag zien.
drop policy if exists "call_plan_invites: authenticated read" on public.call_plan_invites;
drop policy if exists "call_plan_invites: met de afspraak" on public.call_plan_invites;

create policy "call_plan_invites: met de afspraak"
  on public.call_plan_invites for select
  using (user_id = auth.uid() or public.can_see_call_plan(call_plan_id));

-- ---------------------------------------------------------------
-- Comments: nu ook belafspraken en lijsten
-- ---------------------------------------------------------------

drop policy if exists "entity_comments: met wat ze betreffen" on public.entity_comments;
drop policy if exists "entity_comments: op wat je ziet" on public.entity_comments;

create policy "entity_comments: met wat ze betreffen"
  on public.entity_comments for select
  using (
    case entity_type
      when 'post' then exists (select 1 from public.posts po where po.id = entity_id)
      when 'poll' then public.can_see_poll(entity_id)
      when 'call_plan' then public.can_see_call_plan(entity_id)
      when 'list' then exists (select 1 from public.shared_lists sl where sl.id = entity_id)
      else false
    end
  );

create policy "entity_comments: op wat je ziet"
  on public.entity_comments for insert
  with check (
    auth.uid() = user_id
    and case entity_type
      when 'post' then exists (select 1 from public.posts po where po.id = entity_id)
      when 'poll' then public.can_see_poll(entity_id)
      when 'call_plan' then public.can_see_call_plan(entity_id)
      when 'list' then exists (select 1 from public.shared_lists sl where sl.id = entity_id)
      else false
    end
  );

-- ---------------------------------------------------------------
-- activity_events: jijzelf en je lincs
-- ---------------------------------------------------------------

drop policy if exists "activity_events: authenticated read" on public.activity_events;
drop policy if exists "activity_events: jij en je lincs" on public.activity_events;

create policy "activity_events: jij en je lincs"
  on public.activity_events for select
  using (
    actor_id = auth.uid()
    or exists (
      select 1 from public.accepted_friends af
       where af.user_id = auth.uid() and af.friend_id = activity_events.actor_id
    )
  );

comment on column public.call_plans.chat_id is
  'Het gesprek waarin de afspraak gestuurd werd; alleen de leden (en uitgenodigden) zien hem. null = feed.';
