-- 0072 — "Ik kom" / "Misschien" bij een event (handoff 23 sep, EVENTS).
--
-- Eén rij per lid per event. Geen rij = nog niets gezegd. Wie lid is van het
-- event (of de host) ziet wie er komt; je zet en wist alleen je eigen antwoord.

create table if not exists public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('yes', 'maybe')),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

comment on table public.event_rsvps is
  'Wie komt er naar een event: yes (ik kom) of maybe (misschien). Leesbaar voor leden en host.';

alter table public.event_rsvps enable row level security;

drop policy if exists event_rsvps_select on public.event_rsvps;
create policy event_rsvps_select on public.event_rsvps
  for select using (public.is_event_member(event_id) or public.is_event_host(event_id));

drop policy if exists event_rsvps_insert on public.event_rsvps;
create policy event_rsvps_insert on public.event_rsvps
  for insert with check (
    auth.uid() = user_id and (public.is_event_member(event_id) or public.is_event_host(event_id))
  );

drop policy if exists event_rsvps_update on public.event_rsvps;
create policy event_rsvps_update on public.event_rsvps
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists event_rsvps_delete on public.event_rsvps;
create policy event_rsvps_delete on public.event_rsvps
  for delete using (auth.uid() = user_id);
