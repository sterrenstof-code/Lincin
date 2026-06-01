-- Wie is uitgenodigd voor een call plan?
-- Enkel de maker + uitgenodigden zien het plan in hun feed.

create table if not exists public.call_plan_invites (
  id             uuid primary key default gen_random_uuid(),
  call_plan_id   uuid not null references public.call_plans(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  created_at     timestamptz not null default now(),
  unique (call_plan_id, user_id)
);

create index if not exists call_plan_invites_user_id_idx
  on public.call_plan_invites(user_id);

alter table public.call_plan_invites enable row level security;

-- Iedereen die ingelogd is mag uitnodigingen lezen (voor de feed-filter)
create policy "call_plan_invites: authenticated read"
  on public.call_plan_invites for select
  using (auth.role() = 'authenticated');

-- Alleen de maker van de call plan mag uitnodigen
create policy "call_plan_invites: owner insert"
  on public.call_plan_invites for insert
  with check (
    auth.uid() = (
      select user_id from public.call_plans where id = call_plan_id
    )
  );

create policy "call_plan_invites: owner delete"
  on public.call_plan_invites for delete
  using (
    auth.uid() = (
      select user_id from public.call_plans where id = call_plan_id
    )
  );
