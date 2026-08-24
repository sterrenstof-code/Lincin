-- Bio, een vondst volgen, en een vondst omhoog duwen.
--
-- Drie kleine dingen die bij elkaar horen: ze gaan alle drie over wat je
-- met een vondst of met een profiel kunt doen zonder er een reactie onder
-- te typen.

-- ---------------------------------------------------------------
-- 1. Bio op je profiel
-- ---------------------------------------------------------------
alter table public.profiles add column if not exists bio text;

-- ---------------------------------------------------------------
-- 2. Een vondst volgen
-- ---------------------------------------------------------------
-- Wie een vondst volgt, krijgt een melding bij elke nieuwe reactie —
-- ook zonder zelf gereageerd te hebben.
create table if not exists public.post_follows (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_follows_post_idx on public.post_follows(post_id);

alter table public.post_follows enable row level security;

-- Leesbaar voor iedereen die is ingelogd: wie een reactie plaatst moet de
-- volgers van die vondst kunnen opzoeken om ze een melding te sturen.
-- Welke vondsten je überhaupt ziet, regelt de RLS op `posts`.
drop policy if exists "post_follows: read" on public.post_follows;
create policy "post_follows: read"
  on public.post_follows for select
  using (auth.role() = 'authenticated');

drop policy if exists "post_follows: own insert" on public.post_follows;
create policy "post_follows: own insert"
  on public.post_follows for insert
  with check (auth.uid() = user_id);

drop policy if exists "post_follows: own delete" on public.post_follows;
create policy "post_follows: own delete"
  on public.post_follows for delete
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------
-- 3. Een vondst omhoog duwen
-- ---------------------------------------------------------------
-- Eén duw per persoon per vondst — de primaire sleutel houdt dat vast.
-- De feed kan hierop sorteren en de thematische weergave kan er de
-- "hier wordt over gepraat"-plek mee vullen.
create table if not exists public.post_boosts (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_boosts_post_idx on public.post_boosts(post_id);

alter table public.post_boosts enable row level security;

drop policy if exists "post_boosts: read" on public.post_boosts;
create policy "post_boosts: read"
  on public.post_boosts for select
  using (auth.role() = 'authenticated');

drop policy if exists "post_boosts: own insert" on public.post_boosts;
create policy "post_boosts: own insert"
  on public.post_boosts for insert
  with check (auth.uid() = user_id);

drop policy if exists "post_boosts: own delete" on public.post_boosts;
create policy "post_boosts: own delete"
  on public.post_boosts for delete
  using (auth.uid() = user_id);
