-- 0073 — een event krijgt een plek (handoff 23 sep, EVENTS: "◎ Marken").
--
-- Vrije tekst, optioneel. Tot nu toe stond de plek hooguit in de
-- beschrijving. De twee meta-RPC's geven hem mee; een kolom toevoegen aan
-- `returns table (...)` kan niet met `create or replace`, dus ze worden
-- opnieuw aangemaakt (dezelfde definitie als 0043, plus `place`).

alter table public.events add column if not exists place text
  check (place is null or char_length(place) <= 80);

comment on column public.events.place is 'Waar het event is, vrije tekst (hoogstens 80 tekens).';

drop function if exists public.list_my_events();

create function public.list_my_events()
returns table (
  id uuid,
  host_user_id uuid,
  name text,
  description text,
  place text,
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
    e.id, e.host_user_id, e.name, e.description, e.place, e.cover_image_path,
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
  place text,
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
    e.id, e.host_user_id, e.name, e.description, e.place, e.cover_image_path,
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
