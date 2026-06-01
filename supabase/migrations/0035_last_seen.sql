-- Activiteitsindicator: wanneer was een gebruiker voor het laatst actief?
alter table public.profiles
  add column if not exists last_seen_at timestamptz;

-- RLS: iedereen die ingelogd is mag last_seen_at lezen
-- (update-policy: alleen jezelf)
create policy "profiles: update own last_seen"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);
