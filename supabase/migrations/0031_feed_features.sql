-- ============================================================
-- Feed features: polls, call planners, activity events
-- ============================================================

-- ------------------------------------------------------------
-- POLLS
-- ------------------------------------------------------------
create table if not exists polls (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  question      text not null,
  ends_at       timestamptz,           -- null = geen deadline
  created_at    timestamptz not null default now()
);

create table if not exists poll_options (
  id         uuid primary key default gen_random_uuid(),
  poll_id    uuid not null references polls(id) on delete cascade,
  label      text not null,
  position   smallint not null default 0
);

create table if not exists poll_votes (
  id               uuid primary key default gen_random_uuid(),
  poll_option_id   uuid not null references poll_options(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now(),
  unique (poll_option_id, user_id)
);

-- RLS
alter table polls        enable row level security;
alter table poll_options enable row level security;
alter table poll_votes   enable row level security;

-- Iedereen in de app kan polls lezen/aanmaken/stemmen (zelfde model als posts)
create policy "polls: authenticated read"   on polls        for select using (auth.role() = 'authenticated');
create policy "polls: owner insert"         on polls        for insert with check (auth.uid() = user_id);
create policy "polls: owner delete"         on polls        for delete using (auth.uid() = user_id);

create policy "poll_options: authenticated read" on poll_options for select using (auth.role() = 'authenticated');
create policy "poll_options: owner insert"       on poll_options for insert with check (
  exists (select 1 from polls where id = poll_id and user_id = auth.uid())
);
create policy "poll_options: owner delete" on poll_options for delete using (
  exists (select 1 from polls where id = poll_id and user_id = auth.uid())
);

create policy "poll_votes: authenticated read"   on poll_votes for select using (auth.role() = 'authenticated');
create policy "poll_votes: authenticated insert" on poll_votes for insert with check (auth.uid() = user_id);
create policy "poll_votes: own delete"           on poll_votes for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- CALL PLANNERS  (Doodle-stijl)
-- ------------------------------------------------------------
create table if not exists call_plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table if not exists call_plan_slots (
  id           uuid primary key default gen_random_uuid(),
  call_plan_id uuid not null references call_plans(id) on delete cascade,
  starts_at    timestamptz not null,
  ends_at      timestamptz not null
);

create table if not exists call_plan_votes (
  id               uuid primary key default gen_random_uuid(),
  call_plan_slot_id uuid not null references call_plan_slots(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  available        boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (call_plan_slot_id, user_id)
);

alter table call_plans       enable row level security;
alter table call_plan_slots  enable row level security;
alter table call_plan_votes  enable row level security;

create policy "call_plans: authenticated read"   on call_plans for select using (auth.role() = 'authenticated');
create policy "call_plans: owner insert"         on call_plans for insert with check (auth.uid() = user_id);
create policy "call_plans: owner delete"         on call_plans for delete using (auth.uid() = user_id);

create policy "call_plan_slots: authenticated read"   on call_plan_slots for select using (auth.role() = 'authenticated');
create policy "call_plan_slots: owner insert"         on call_plan_slots for insert with check (
  exists (select 1 from call_plans where id = call_plan_id and user_id = auth.uid())
);
create policy "call_plan_slots: owner delete" on call_plan_slots for delete using (
  exists (select 1 from call_plans where id = call_plan_id and user_id = auth.uid())
);

create policy "call_plan_votes: authenticated read"   on call_plan_votes for select using (auth.role() = 'authenticated');
create policy "call_plan_votes: authenticated upsert" on call_plan_votes for insert with check (auth.uid() = user_id);
create policy "call_plan_votes: own update"           on call_plan_votes for update using (auth.uid() = user_id);
create policy "call_plan_votes: own delete"           on call_plan_votes for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- ACTIVITY EVENTS  (momentjes)
-- ------------------------------------------------------------
create type activity_kind as enum (
  'friend_accepted',
  'post_created',
  'event_created',
  'event_joined'
);

create table if not exists activity_events (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid not null references auth.users(id) on delete cascade,
  kind         activity_kind not null,
  -- optionele verwijzingen naar het object
  post_id      uuid references posts(id) on delete set null,
  event_id     uuid references events(id) on delete set null,
  friend_id    uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

alter table activity_events enable row level security;

create policy "activity_events: authenticated read" on activity_events for select using (auth.role() = 'authenticated');
create policy "activity_events: authenticated insert" on activity_events for insert with check (auth.uid() = actor_id);
