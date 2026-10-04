-- 0083 — wat je al zag, op al je toestellen (handoff okt 2026).
--
-- Tot nu toe stond "gezien" alleen op het toestel (lib/read-state.ts): op
-- je laptop was nieuw wat je op je telefoon al gelezen had. Nu staat het
-- ook hier, zodat Nieuw/Gezien overal hetzelfde is.
--
-- Het blijft van jou alleen. Dit is GEEN leesbevestiging: de policies
-- hieronder laten alleen de eigenaar lezen en schrijven, er is geen
-- functie die het voor een ander ontsluit, en niets in de app toont een
-- maker wie zijn bijdrage zag. Dat was de reden om het lokaal te houden;
-- die reden blijft gelden en wordt hier afgedwongen in plaats van door de
-- opslagplek.
--
--   item_seen      de bijdragen en polls die je opende (geen foreign key:
--                  het zijn ids van verschillende tabellen)
--   reading_state  het einde van je vorige bezoek, het laatste van al je
--                  toestellen: wat daarvóór gedeeld werd, telt als gezien

create table if not exists public.item_seen (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index if not exists item_seen_recent_idx on public.item_seen (user_id, seen_at desc);

alter table public.item_seen enable row level security;

drop policy if exists "item_seen: own" on public.item_seen;
create policy "item_seen: own"
  on public.item_seen for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.reading_state (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  last_active_at timestamptz not null default now()
);

alter table public.reading_state enable row level security;

drop policy if exists "reading_state: own" on public.reading_state;
create policy "reading_state: own"
  on public.reading_state for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

/**
 * "Ik ben hier nu." Schuift alleen vooruit: een toestel met een oude klok
 * of een trage verbinding zet de grens nooit terug.
 */
create or replace function public.touch_reading_state(p_at timestamptz)
returns timestamptz
language sql
security invoker
set search_path = public
as $$
  insert into public.reading_state (user_id, last_active_at)
  values (auth.uid(), least(p_at, now()))
  on conflict (user_id) do update
    set last_active_at = greatest(public.reading_state.last_active_at, excluded.last_active_at)
  returning last_active_at;
$$;

grant execute on function public.touch_reading_state(timestamptz) to authenticated;
