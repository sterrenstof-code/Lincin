-- 0101 — je sleutel terug met een passkey (nov 2026).
--
-- Naast de herstelcode (0094): een kopie van de privésleutel, versleuteld
-- met wat een passkey via WebAuthn-PRF teruggeeft (lib/crypto/passkey.ts).
-- Die waarde komt alleen uit de passkey zelf, na vingerafdruk of gezicht;
-- de server ziet hem nooit. De passkey staat in Google Wachtwoordbeheer of
-- de iCloud-sleutelhanger, dus hij overleeft gewiste sitegegevens en een
-- nieuw toestel.
--
-- Eén rij per passkey. Alleen je eigen rijen: lezen, toevoegen, wissen.

create table if not exists public.key_passkeys (
  credential_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  wrapped text not null,
  created_at timestamptz not null default now()
);

create index if not exists key_passkeys_user on public.key_passkeys (user_id);

alter table public.key_passkeys enable row level security;

drop policy if exists "key_passkeys: own read" on public.key_passkeys;
create policy "key_passkeys: own read" on public.key_passkeys
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "key_passkeys: own insert" on public.key_passkeys;
create policy "key_passkeys: own insert" on public.key_passkeys
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "key_passkeys: own delete" on public.key_passkeys;
create policy "key_passkeys: own delete" on public.key_passkeys
  for delete to authenticated using (user_id = auth.uid());

revoke all on public.key_passkeys from anon;
