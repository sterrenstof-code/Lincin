-- 0070 — voorkeuren per gebruiker, over toestellen heen.
--
-- HANDOFF (23 sep) §Vaste gedragsregels: "voorkeuren worden onthouden …
-- in productie: per gebruiker opslaan". Wat hierin staat: de weergave van
-- de feed, welke vrienden je openklapte, de taal en de schakelaars van
-- Instellingen. Het thema staat al op het profiel (0058).
--
-- Een eigen tabel en geen kolom op `profiles`: profielen zijn leesbaar voor
-- vrienden, dit is alleen van jou. Gelezen-status staat hier bewust níet in
-- (lib/read-state.ts: lokaal, zodat het geen leesbevestiging wordt).

create table if not exists public.user_prefs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

comment on table public.user_prefs is
  'Voorkeuren van één gebruiker (feed-weergave, open vrienden, taal, schakelaars). Alleen leesbaar voor de eigenaar.';

alter table public.user_prefs enable row level security;

drop policy if exists user_prefs_select on public.user_prefs;
create policy user_prefs_select on public.user_prefs
  for select using (auth.uid() = user_id);

drop policy if exists user_prefs_insert on public.user_prefs;
create policy user_prefs_insert on public.user_prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists user_prefs_update on public.user_prefs;
create policy user_prefs_update on public.user_prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
