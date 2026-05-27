-- Tijdelijke key-overdrachtsrecords voor QR-apparaatkoppeling.
-- Brontoestel slaat encrypted private key op; nieuw toestel haalt hem op via token.
-- Records verlopen na 10 minuten en zijn eenmalig.

create table if not exists public.key_transfers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  -- SHA-256(transfer_secret) in base64 — server ziet nooit het geheim zelf
  token       text not null unique,
  -- base64( nonce || XChaCha20Poly1305(key=transfer_secret, plaintext=private_key) )
  blob        text not null,
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  created_at  timestamptz not null default now()
);

-- Enkel de eigenaar mag zijn eigen records lezen/schrijven/verwijderen
alter table public.key_transfers enable row level security;

create policy "key_transfers_select" on public.key_transfers
  for select using (auth.uid() = user_id);

create policy "key_transfers_insert" on public.key_transfers
  for insert with check (auth.uid() = user_id);

create policy "key_transfers_delete" on public.key_transfers
  for delete using (auth.uid() = user_id);

-- Automatische opruiming van verlopen records (aanroepen vanuit cron of Edge Function)
create or replace function public.cleanup_expired_key_transfers()
returns void language sql security definer as $$
  delete from public.key_transfers where expires_at < now();
$$;
