-- Event improvements: server-side reveal enforcement, host moderation,
-- cover-image storage, count RPCs, and event notifications.
--
-- Achtergrond: tot nu toe werd de 'reveal' (wanneer gasten elkaars foto's
-- mogen zien) enkel client-side afgedwongen in listEventContributions. Een
-- gast kon dus in theorie de rijen/opslag rechtstreeks opvragen. Deze migratie
-- verplaatst reveal naar de database (RLS + server now()), voegt host-moderatie
-- toe (host mag elke bijdrage verwijderen), regelt cover-foto's, en stuurt
-- notificaties bij join + nieuwe bijdrage.

-- ---------- Helpers ----------

-- Is de huidige gebruiker de host van dit event? (SECURITY DEFINER → bypasst RLS)
create or replace function public.is_event_host(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.events
     where id = p_event_id and host_user_id = auth.uid()
  );
$$;

grant execute on function public.is_event_host(uuid) to authenticated;

-- Mag de huidige gebruiker de INHOUD van dit event zien? Host altijd; gasten
-- volgens de reveal-regel, gemeten met de SERVER-klok (niet spoofbaar).
create or replace function public.event_is_revealed(p_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select case
    when e.host_user_id = auth.uid() then true
    when e.reveal = 'during'  then now() >= e.starts_at
    when e.reveal = 'after'   then now() >= e.ends_at
    when e.reveal = 'delayed' then now() >= e.ends_at + make_interval(hours => e.reveal_delay_hours)
    else false
  end
  from public.events e
  where e.id = p_event_id;
$$;

grant execute on function public.event_is_revealed(uuid) to authenticated;

-- ---------- event_contributions: reveal + host-moderatie ----------

-- SELECT: je eigen bijdragen zie je altijd; host ziet alles; andere leden
-- pas wanneer het event onthuld is.
drop policy if exists "see contributions in your events" on public.event_contributions;
create policy "see contributions in your events"
  on public.event_contributions for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_event_host(event_id)
    or (public.is_event_member(event_id) and public.event_is_revealed(event_id))
  );

-- DELETE: eigenaar OF host (moderatie).
drop policy if exists "delete own contribution" on public.event_contributions;
drop policy if exists "delete own or host contribution" on public.event_contributions;
create policy "delete own or host contribution"
  on public.event_contributions for delete
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_event_host(event_id)
  );

-- ---------- Storage: reveal + cover + host ----------
-- Padconventies binnen bucket 'event-photos':
--   bijdrage : {event_id}/{user_id}/{uuid}.ext
--   cover    : {event_id}/cover/{uuid}.ext   (enkel host uploadt)

drop policy if exists "event members read event photos" on storage.objects;
drop policy if exists "event members upload event photos" on storage.objects;
drop policy if exists "users delete own event photos" on storage.objects;
drop policy if exists "event-photos: read for event members" on storage.objects;
drop policy if exists "event-photos: upload for event members" on storage.objects;
drop policy if exists "event-photos: delete own" on storage.objects;

-- READ: eigen upload altijd; cover voor leden altijd; host alles; onthulde
-- bijdragen voor leden.
create policy "event-photos: read gated"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'event-photos'
    and (
      (storage.foldername(name))[2] = auth.uid()::text
      or (
        (storage.foldername(name))[2] = 'cover'
        and public.is_event_member(((storage.foldername(name))[1])::uuid)
      )
      or public.is_event_host(((storage.foldername(name))[1])::uuid)
      or (
        public.is_event_member(((storage.foldername(name))[1])::uuid)
        and public.event_is_revealed(((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- UPLOAD: lid van het event, en ofwel je eigen map, ofwel de cover-map als host.
create policy "event-photos: upload gated"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'event-photos'
    and public.is_event_member(((storage.foldername(name))[1])::uuid)
    and (
      auth.uid()::text = (storage.foldername(name))[2]
      or (
        (storage.foldername(name))[2] = 'cover'
        and public.is_event_host(((storage.foldername(name))[1])::uuid)
      )
    )
  );

-- DELETE: eigenaar OF host van het event.
create policy "event-photos: delete own or host"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'event-photos'
    and (
      owner = auth.uid()
      or public.is_event_host(((storage.foldername(name))[1])::uuid)
    )
  );

-- ---------- Count-RPCs (tellingen overleven de reveal-gating) ----------
-- Omdat niet-onthulde bijdragen nu door RLS verborgen zijn, kan de client de
-- totalen niet meer zelf tellen. Deze SECURITY DEFINER functies geven enkel
-- tellingen terug (geen inhoud) voor events waar je host/lid van bent.

create or replace function public.list_my_events()
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
  created_at timestamptz,
  members_count bigint,
  contributions_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    e.id, e.host_user_id, e.name, e.description, e.cover_image_path,
    e.starts_at, e.ends_at, e.reveal, e.reveal_delay_hours, e.max_guests,
    e.join_code, e.created_at,
    (select count(*) from public.event_members em where em.event_id = e.id) as members_count,
    (select count(*) from public.event_contributions ec where ec.event_id = e.id) as contributions_count
  from public.events e
  where e.host_user_id = auth.uid()
     or exists (
       select 1 from public.event_members em
        where em.event_id = e.id and em.user_id = auth.uid()
     )
  order by e.starts_at desc;
$$;

grant execute on function public.list_my_events() to authenticated;

create or replace function public.get_event_meta(p_event_id uuid)
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
  created_at timestamptz,
  members_count bigint,
  contributions_count bigint,
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
    e.join_code, e.created_at,
    (select count(*) from public.event_members em where em.event_id = e.id) as members_count,
    (select count(*) from public.event_contributions ec where ec.event_id = e.id) as contributions_count,
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

-- ---------- Notifications: event_id kolom ----------
alter table public.notifications
  add column if not exists event_id uuid references public.events(id) on delete cascade;

-- ---------- join_event: notificeer de host bij een nieuwe join ----------
create or replace function public.join_event(p_join_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  event_row record;
  inserted_count int := 0;
begin
  if me is null then raise exception 'not authenticated'; end if;

  select id, max_guests, host_user_id into event_row
    from public.events
   where join_code = p_join_code;
  if not found then
    raise exception 'event not found';
  end if;

  if (select count(*) from public.event_members where event_id = event_row.id)
     >= event_row.max_guests then
    raise exception 'event is vol';
  end if;

  insert into public.event_members (event_id, user_id, role)
    values (event_row.id, me, 'guest')
    on conflict (event_id, user_id) do nothing;
  get diagnostics inserted_count = row_count;

  -- Notificeer de host (enkel bij een echt nieuwe join, en niet aan zichzelf)
  if inserted_count > 0 and event_row.host_user_id <> me then
    insert into public.notifications (user_id, actor_id, type, event_id)
      values (event_row.host_user_id, me, 'event_join', event_row.id);
  end if;

  return event_row.id;
end;
$$;

grant execute on function public.join_event(text) to authenticated;

-- ---------- Trigger: notificeer de host bij een nieuwe bijdrage ----------
create or replace function public.notify_host_on_contribution()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host uuid;
begin
  select host_user_id into host from public.events where id = new.event_id;
  if host is not null and host <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, event_id)
      values (host, new.user_id, 'event_contribution', new.event_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_notify_host_on_contribution on public.event_contributions;
create trigger trg_notify_host_on_contribution
  after insert on public.event_contributions
  for each row execute function public.notify_host_on_contribution();

notify pgrst, 'reload schema';
