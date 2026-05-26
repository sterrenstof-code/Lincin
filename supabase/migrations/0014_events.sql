-- Events feature (Once-style)
--
-- Een gebruiker maakt een event aan met datum + zichtbaarheidsregels.
-- Mensen worden uitgenodigd via QR/link. Tijdens of na het event kunnen
-- ze foto's en tekst bijdragen. De foto's worden zichtbaar volgens de
-- 'reveal' regel: tijdens, na, of na een delay.

-- Postgres ondersteunt geen `create type if not exists`, dus we wrappen in DO
do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_reveal') then
    create type public.event_reveal as enum (
      'during',     -- foto's direct zichtbaar tijdens event
      'after',      -- foto's pas zichtbaar na event-einde
      'delayed'     -- na event-einde + reveal_delay_hours
    );
  end if;
end $$;

create table if not exists public.events (
  id                  uuid primary key default gen_random_uuid(),
  host_user_id        uuid not null references public.profiles(id) on delete cascade,
  name                text not null check (char_length(name) between 1 and 80),
  description         text,
  cover_image_path    text,        -- optionele cover-foto in posts bucket
  starts_at           timestamptz not null,
  ends_at             timestamptz not null,
  reveal              public.event_reveal not null default 'after',
  reveal_delay_hours  int not null default 0 check (reveal_delay_hours >= 0),
  max_guests          int not null default 100 check (max_guests between 1 and 1000),
  /** Onveranderlijk geheim voor join-QR. Generated server-side. */
  join_code           text not null unique default encode(gen_random_bytes(12), 'base64'),
  created_at          timestamptz not null default now()
);

create index if not exists events_host_idx on public.events (host_user_id);
create index if not exists events_dates_idx on public.events (starts_at, ends_at);

-- Event-leden (gasten die het event "geopend" hebben via link/QR)
create table if not exists public.event_members (
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       text not null default 'guest' check (role in ('host', 'guest')),
  joined_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_members_user_idx on public.event_members (user_id);

-- Event-contributies (foto's en/of tekst die gasten plaatsen)
create table if not exists public.event_contributions (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references public.events(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  image_path text,
  caption    text,
  link_url   text,
  created_at timestamptz not null default now(),
  constraint event_contributions_has_content
    check (image_path is not null or link_url is not null or coalesce(char_length(trim(caption)), 0) > 0)
);

create index if not exists event_contributions_event_idx
  on public.event_contributions (event_id, created_at desc);

-- ---------- RLS ----------
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.event_contributions enable row level security;

-- Events: zichtbaar voor host + alle members
drop policy if exists "see events you host or are in" on public.events;
create policy "see events you host or are in"
  on public.events for select
  to authenticated
  using (
    host_user_id = auth.uid()
    or exists (
      select 1 from public.event_members em
       where em.event_id = events.id and em.user_id = auth.uid()
    )
  );

drop policy if exists "create event as host" on public.events;
create policy "create event as host"
  on public.events for insert
  to authenticated
  with check (host_user_id = auth.uid());

drop policy if exists "host can update event" on public.events;
create policy "host can update event"
  on public.events for update
  to authenticated
  using (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

drop policy if exists "host can delete event" on public.events;
create policy "host can delete event"
  on public.events for delete
  to authenticated
  using (host_user_id = auth.uid());

-- Event members: members zien elkaar
drop policy if exists "see members of events you're in" on public.event_members;
create policy "see members of events you're in"
  on public.event_members for select
  to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.event_members me
       where me.event_id = event_members.event_id and me.user_id = auth.uid()
    )
  );

drop policy if exists "join event as yourself" on public.event_members;
create policy "join event as yourself"
  on public.event_members for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "leave event" on public.event_members;
create policy "leave event"
  on public.event_members for delete
  to authenticated
  using (user_id = auth.uid());

-- Contributions: members zien alle contributies in events waarvan ze lid zijn,
-- onder voorwaarde van de 'reveal' policy. Tijdens-zichtbaarheid valt buiten
-- de schaal van pure RLS — we filteren client-side op `effective_reveal_at`.
-- Voor RLS volstaat: "kan je het event zien".
drop policy if exists "see contributions in your events" on public.event_contributions;
create policy "see contributions in your events"
  on public.event_contributions for select
  to authenticated
  using (
    exists (
      select 1 from public.event_members em
       where em.event_id = event_contributions.event_id
         and em.user_id = auth.uid()
    )
  );

drop policy if exists "contribute as yourself in your events" on public.event_contributions;
create policy "contribute as yourself in your events"
  on public.event_contributions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.event_members em
       where em.event_id = event_contributions.event_id
         and em.user_id = auth.uid()
    )
  );

drop policy if exists "delete own contribution" on public.event_contributions;
create policy "delete own contribution"
  on public.event_contributions for delete
  to authenticated
  using (user_id = auth.uid());

-- ---------- RPC: join via join_code ----------
create or replace function public.join_event(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  event_row record;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select id, max_guests into event_row
    from public.events
   where join_code = p_join_code;
  if not found then
    raise exception 'event not found';
  end if;

  -- Check capacity
  if (select count(*) from public.event_members where event_id = event_row.id)
     >= event_row.max_guests then
    raise exception 'event is vol';
  end if;

  insert into public.event_members (event_id, user_id, role)
    values (event_row.id, me, 'guest')
    on conflict (event_id, user_id) do nothing;

  return event_row.id;
end;
$$;

grant execute on function public.join_event(text) to authenticated;

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'event_contributions'
  ) then
    alter publication supabase_realtime add table public.event_contributions;
  end if;
end $$;

notify pgrst, 'reload schema';
