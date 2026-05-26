-- Multi-device support voor E2E encryption.
--
-- Elke browser/toestel registreert zich als een aparte "device" met eigen
-- identity keypair. Senders encrypteren message envelopes voor élke device
-- van élke ontvanger. Daardoor kan iemand op meerdere toestellen tegelijk
-- berichten ontvangen en ontsleutelen.
--
-- `profiles.identity_pubkey` blijft bestaan als "legacy single-device" key
-- voor backwards-compat met oude messages. Nieuwe senders gebruiken voortaan
-- `profile_devices` als bron van waarheid.

create table if not exists public.profile_devices (
  user_id          uuid not null references public.profiles(id) on delete cascade,
  device_id        text not null,
  identity_pubkey  text not null,
  label            text,
  created_at       timestamptz not null default now(),
  last_seen_at     timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index if not exists profile_devices_user_idx
  on public.profile_devices (user_id);

alter table public.profile_devices enable row level security;

drop policy if exists "anyone can read device pubkeys" on public.profile_devices;
drop policy if exists "users manage own devices" on public.profile_devices;

-- Iedereen die ingelogd is mag pubkeys lezen — nodig om voor hen te encrypten
create policy "anyone can read device pubkeys"
  on public.profile_devices for select
  to authenticated
  using (true);

-- Eigenaar beheert eigen devices
create policy "users manage own devices"
  on public.profile_devices for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

notify pgrst, 'reload schema';
