-- Open of gesloten event — wie mag er binnen?
--
-- Tot nu toe was élk event de facto open: wie de join-link of QR had, stond
-- meteen in de gastenlijst. Voor een verjaardag in een café is dat prima,
-- voor een besloten avond niet: de link wordt doorgestuurd en er zitten
-- mensen in je fotostroom die je niet uitgenodigd hebt.
--
-- Daarom krijgt elk event een `join_policy`:
--
--   open     iedereen met de link/QR komt meteen binnen (het oude gedrag)
--   closed   de link/QR levert een *verzoek* op; de host keurt goed of weigert
--
-- De link blijft dus in beide gevallen deelbaar — het verschil zit in wat er
-- aan de andere kant gebeurt. Dat is bewust: een gesloten event waarbij de
-- link niet meer werkt zou betekenen dat de host iedereen apart moet
-- toevoegen, en dat is precies de wrijving die events hier moeten wegnemen.
--
-- Bestaande events worden **gesloten** gezet. Dat is de veilige kant van de
-- keuze: reeds gedeelde links blijven werken, maar er komt niemand meer
-- ongemerkt binnen. De host ziet het verzoek en beslist.

-- ---------- join_policy op events ----------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'event_join_policy') then
    create type public.event_join_policy as enum ('open', 'closed');
  end if;
end $$;

-- `not null default 'closed'` vult meteen álle bestaande rijen met 'closed';
-- daar is geen aparte backfill-update voor nodig.
alter table public.events
  add column if not exists join_policy public.event_join_policy not null default 'closed';

-- ---------- Verzoeken om mee te doen ----------

create table if not exists public.event_join_requests (
  event_id    uuid not null references public.events(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending'
                check (status in ('pending', 'approved', 'declined')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  decided_by  uuid references public.profiles(id) on delete set null,
  primary key (event_id, user_id)
);

create index if not exists event_join_requests_event_idx
  on public.event_join_requests (event_id, status, created_at);

alter table public.event_join_requests enable row level security;

-- Lezen: je eigen verzoek, en als host alle verzoeken voor jouw event.
drop policy if exists "see own or hosted join requests" on public.event_join_requests;
create policy "see own or hosted join requests"
  on public.event_join_requests for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_event_host(event_id)
  );

-- Aanmaken en beslissen loopt uitsluitend via de RPC's hieronder (SECURITY
-- DEFINER). Er is met opzet géén insert/update-policy: anders kon een gast
-- zichzelf op 'approved' zetten.

-- Je eigen verzoek intrekken mag wel rechtstreeks — zolang het nog openstaat.
-- Een beslissing wissen kan niet: dan zou een weigering met één tik uit de
-- boeken verdwijnen.
drop policy if exists "withdraw own join request" on public.event_join_requests;
create policy "withdraw own join request"
  on public.event_join_requests for delete
  to authenticated
  using (user_id = auth.uid() and status = 'pending');

-- ---------- join_event: open = binnen, gesloten = verzoek ----------

-- De returnwaarde verandert van uuid naar jsonb, en dat kan `create or
-- replace` niet — vandaar de drop.
drop function if exists public.join_event(text);

create function public.join_event(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  event_row record;
  inserted_count int := 0;
  existing_status text;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select id, max_guests, host_user_id, join_policy into event_row
    from public.events
   where join_code = p_join_code;
  if not found then
    raise exception 'event not found';
  end if;

  -- Al lid (of de host zelf)? Dan is er niets te doen.
  if exists (
    select 1 from public.event_members
     where event_id = event_row.id and user_id = me
  ) then
    return jsonb_build_object('event_id', event_row.id, 'status', 'member');
  end if;

  if (select count(*) from public.event_members where event_id = event_row.id)
     >= event_row.max_guests then
    raise exception 'event is vol';
  end if;

  -- ---- Gesloten event: een verzoek, geen lidmaatschap ----
  if event_row.join_policy = 'closed' then
    select status into existing_status
      from public.event_join_requests
     where event_id = event_row.id and user_id = me;

    insert into public.event_join_requests (event_id, user_id, status)
      values (event_row.id, me, 'pending')
      on conflict (event_id, user_id) do update
        set status = 'pending',
            created_at = now(),
            decided_at = null,
            decided_by = null;

    -- Enkel bij een écht nieuw verzoek een melding, zodat opnieuw tikken op
    -- de link de host niet blijft porren.
    if existing_status is distinct from 'pending' then
      insert into public.notifications (user_id, actor_id, type, event_id)
        values (event_row.host_user_id, me, 'event_join_request', event_row.id);
    end if;

    return jsonb_build_object('event_id', event_row.id, 'status', 'pending');
  end if;

  -- ---- Open event: meteen binnen (het oude gedrag) ----
  insert into public.event_members (event_id, user_id, role)
    values (event_row.id, me, 'guest')
    on conflict (event_id, user_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count > 0 and event_row.host_user_id <> me then
    insert into public.notifications (user_id, actor_id, type, event_id)
      values (event_row.host_user_id, me, 'event_join', event_row.id);
  end if;

  return jsonb_build_object('event_id', event_row.id, 'status', 'joined');
end;
$$;

grant execute on function public.join_event(text) to authenticated;

-- ---------- De host beslist ----------

create or replace function public.approve_event_join(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  host uuid;
  cap int;
begin
  select host_user_id, max_guests into host, cap
    from public.events where id = p_event_id;
  if host is null then raise exception 'event not found'; end if;
  if host <> auth.uid() then raise exception 'alleen de host beslist over verzoeken'; end if;

  if (select count(*) from public.event_members where event_id = p_event_id) >= cap then
    raise exception 'event is vol';
  end if;

  update public.event_join_requests
     set status = 'approved', decided_at = now(), decided_by = auth.uid()
   where event_id = p_event_id and user_id = p_user_id;
  if not found then raise exception 'verzoek niet gevonden'; end if;

  insert into public.event_members (event_id, user_id, role)
    values (p_event_id, p_user_id, 'guest')
    on conflict (event_id, user_id) do nothing;

  -- De gast hoort te weten dat hij binnen is.
  if p_user_id <> auth.uid() then
    insert into public.notifications (user_id, actor_id, type, event_id)
      values (p_user_id, auth.uid(), 'event_join_approved', p_event_id);
  end if;

  -- Het activiteitsmoment staat op naam van de gast. Dat kan de client niet
  -- zelf: de RLS op activity_events laat enkel een insert op je eigen naam
  -- toe, en hier is de host aan het werk.
  insert into public.activity_events (actor_id, kind, event_id)
    values (p_user_id, 'event_joined', p_event_id);
end;
$$;

grant execute on function public.approve_event_join(uuid, uuid) to authenticated;

create or replace function public.decline_event_join(p_event_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  host uuid;
begin
  select host_user_id into host from public.events where id = p_event_id;
  if host is null then raise exception 'event not found'; end if;
  if host <> auth.uid() then raise exception 'alleen de host beslist over verzoeken'; end if;

  update public.event_join_requests
     set status = 'declined', decided_at = now(), decided_by = auth.uid()
   where event_id = p_event_id and user_id = p_user_id;
  if not found then raise exception 'verzoek niet gevonden'; end if;

  -- Een weigering gaat bewust zónder melding naar de gast. Wie geweigerd
  -- wordt hoeft daar geen bericht over te krijgen; de host hoeft zich niet
  -- te verantwoorden.
end;
$$;

grant execute on function public.decline_event_join(uuid, uuid) to authenticated;

-- Openstaande verzoeken van één event. Host-only; geeft enkel wie en wanneer.
create or replace function public.list_event_join_requests(p_event_id uuid)
returns table (user_id uuid, created_at timestamptz)
language sql
security definer
set search_path = public
stable
as $$
  select r.user_id, r.created_at
    from public.event_join_requests r
   where r.event_id = p_event_id
     and r.status = 'pending'
     and public.is_event_host(p_event_id)
   order by r.created_at asc;
$$;

grant execute on function public.list_event_join_requests(uuid) to authenticated;

-- ---------- De meta-RPC's kennen de nieuwe velden ----------
-- Een kolom toevoegen aan `returns table (...)` kan niet met `create or
-- replace`; de functies worden dus opnieuw aangemaakt.

drop function if exists public.list_my_events();

create function public.list_my_events()
returns table (
  id uuid,
  host_user_id uuid,
  name text,
  description text,
  cover_image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  reveal public.event_reveal,
  reveal_delay_hours int,
  max_guests int,
  join_code text,
  join_policy public.event_join_policy,
  created_at timestamptz,
  members_count bigint,
  contributions_count bigint,
  pending_requests_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.id, e.host_user_id, e.name, e.description, e.cover_image_path,
    e.starts_at, e.ends_at, e.reveal, e.reveal_delay_hours, e.max_guests,
    e.join_code, e.join_policy, e.created_at,
    (select count(*) from public.event_members em where em.event_id = e.id) as members_count,
    (select count(*) from public.event_contributions ec where ec.event_id = e.id) as contributions_count,
    case when e.host_user_id = auth.uid() then (
      select count(*) from public.event_join_requests r
       where r.event_id = e.id and r.status = 'pending'
    ) else 0::bigint end as pending_requests_count
  from public.events e
  where e.host_user_id = auth.uid()
     or exists (
       select 1 from public.event_members em
        where em.event_id = e.id and em.user_id = auth.uid()
     )
  order by e.starts_at desc;
$$;

grant execute on function public.list_my_events() to authenticated;

drop function if exists public.get_event_meta(uuid);

create function public.get_event_meta(p_event_id uuid)
returns table (
  id uuid,
  host_user_id uuid,
  name text,
  description text,
  cover_image_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  reveal public.event_reveal,
  reveal_delay_hours int,
  max_guests int,
  join_code text,
  join_policy public.event_join_policy,
  created_at timestamptz,
  members_count bigint,
  contributions_count bigint,
  pending_requests_count bigint,
  is_revealed boolean,
  is_active boolean,
  is_host boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.id, e.host_user_id, e.name, e.description, e.cover_image_path,
    e.starts_at, e.ends_at, e.reveal, e.reveal_delay_hours, e.max_guests,
    e.join_code, e.join_policy, e.created_at,
    (select count(*) from public.event_members em where em.event_id = e.id) as members_count,
    (select count(*) from public.event_contributions ec where ec.event_id = e.id) as contributions_count,
    case when e.host_user_id = auth.uid() then (
      select count(*) from public.event_join_requests r
       where r.event_id = e.id and r.status = 'pending'
    ) else 0::bigint end as pending_requests_count,
    public.event_is_revealed(e.id) as is_revealed,
    (now() >= e.starts_at and now() <= e.ends_at) as is_active,
    (e.host_user_id = auth.uid()) as is_host
  from public.events e
  where e.id = p_event_id
    and (
      e.host_user_id = auth.uid()
      or exists (
        select 1 from public.event_members em
         where em.event_id = e.id and em.user_id = auth.uid()
      )
    );
$$;

grant execute on function public.get_event_meta(uuid) to authenticated;

notify pgrst, 'reload schema';
