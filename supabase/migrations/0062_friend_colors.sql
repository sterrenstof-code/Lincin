-- 0062 — jouw kleur per persoon.
--
-- Elke vriend heeft een kleur die uit zijn id komt (lib/design/theme.ts,
-- hueFor). Hier kies je er zelf een voor iemand: die wint dan overal in
-- jóuw app — feed, gesprekken, bladzijde, profiel. Van jou alleen; wie
-- de kleur kreeg ziet je keuze niet.

create table if not exists public.friend_colors (
  owner_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  hue text not null check (hue in ('orange', 'blue', 'ochre', 'green', 'red', 'acid')),
  updated_at timestamptz not null default now(),
  primary key (owner_id, friend_id)
);

alter table public.friend_colors enable row level security;

create policy "friend_colors: eigen keuzes lezen"
  on public.friend_colors for select
  using (owner_id = auth.uid());

create policy "friend_colors: eigen keuzes maken"
  on public.friend_colors for insert
  with check (owner_id = auth.uid());

create policy "friend_colors: eigen keuzes wijzigen"
  on public.friend_colors for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "friend_colors: eigen keuzes wissen"
  on public.friend_colors for delete
  using (owner_id = auth.uid());
