-- User devices voor push notifications
--
-- Eén gebruiker kan op meerdere toestellen ingelogd zijn (iPhone, web, iPad).
-- Per toestel slaan we hun Expo push-token op. Bij een nieuw bericht of
-- vriendschapsverzoek roept een Edge Function dit op om te bepalen waar
-- naartoe te pushen.

create table if not exists public.user_devices (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  push_token  text not null,
  platform    text not null check (platform in ('ios', 'android', 'web')),
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (push_token)
);

create index if not exists user_devices_user_idx
  on public.user_devices (user_id);

alter table public.user_devices enable row level security;

-- Een gebruiker beheert zijn eigen device-rijen.
create policy "users manage their own devices"
  on public.user_devices for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
