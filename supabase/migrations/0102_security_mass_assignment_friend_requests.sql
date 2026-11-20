-- 0102 — derde veiligheidscontrole (nov 2026).
--
-- 1. Vriendschapsverzoeken waren onbeperkt. Wie iemands id kende kon
--    verzoek → intrekken → verzoek herhalen, en bij elk verzoek stuurt
--    send-push een melding ("… wil je toevoegen op Lincin"). Nu: hoogstens
--    20 verzoeken per dag per afzender, en hetzelfde paar maar één keer per
--    dag. Elk verzoek wordt gelogd; intrekken wist de log niet.
-- 2. Velden die de server bepaalt, waren via een gewone update te zetten:
--    - posts.created_at (een bijdrage "in de toekomst" bleef bovenaan);
--    - list_items.user_id en checked_by (iets op naam van een ander zetten);
--    - call_plan_votes kon naar een tijdslot van een plan dat je niet ziet.

-- ---- 1. Vriendschapsverzoeken -------------------------------------------

create table if not exists public.friend_request_log (
  id bigint generated always as identity primary key,
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists friend_request_log_requester_idx on public.friend_request_log (requester_id, created_at);
create index if not exists friend_request_log_pair_idx on public.friend_request_log (requester_id, addressee_id, created_at);
alter table public.friend_request_log enable row level security;
revoke all on public.friend_request_log from anon, authenticated;

-- Alleen verzoeken die iemand zelf stuurt (pending, op eigen naam). Een
-- vriendschap via een uitnodigingslink (redeem_friend_code met token, of de
-- trigger bij een nieuwe account) is meteen 'accepted' en telt niet.
create or replace function public.friendships_limit_requests()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'pending' or auth.uid() is null or new.requester_id <> auth.uid() then
    return new;
  end if;
  perform pg_advisory_xact_lock(hashtext('friendreq:' || new.requester_id::text));
  if exists (
    select 1 from public.friend_request_log
     where requester_id = new.requester_id and addressee_id = new.addressee_id
       and created_at > now() - interval '24 hours'
  ) then
    raise exception 'friend request rate limited' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  if (select count(*) from public.friend_request_log
       where requester_id = new.requester_id and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'friend request rate limited' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.friend_request_log (requester_id, addressee_id) values (new.requester_id, new.addressee_id);
  return new;
end;
$$;
revoke all on function public.friendships_limit_requests() from public, anon, authenticated;

drop trigger if exists friendships_limit_requests on public.friendships;
create trigger friendships_limit_requests
  before insert on public.friendships
  for each row execute function public.friendships_limit_requests();

-- ---- 2. Velden die de server bepaalt ------------------------------------

create or replace function public.posts_freeze_server_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.id := old.id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  return new;
end;
$$;
drop trigger if exists posts_freeze_server_fields on public.posts;
create trigger posts_freeze_server_fields
  before update on public.posts
  for each row execute function public.posts_freeze_server_fields();

-- Afvinken mag iedereen die de lijst ziet, maar alleen op eigen naam.
create or replace function public.list_items_freeze_server_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.id := old.id;
  new.list_id := old.list_id;
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  if new.checked_by is distinct from old.checked_by
     and new.checked_by is not null
     and new.checked_by is distinct from auth.uid() then
    raise exception 'checked_by must be the current user' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists list_items_freeze_server_fields on public.list_items;
create trigger list_items_freeze_server_fields
  before update on public.list_items
  for each row execute function public.list_items_freeze_server_fields();

-- De update-policy had geen with check: een stem kon naar elk tijdslot.
drop policy if exists "call_plan_votes: update own" on public.call_plan_votes;
do $$
declare pol text;
begin
  for pol in select policyname from pg_policies
              where schemaname = 'public' and tablename = 'call_plan_votes' and cmd = 'UPDATE'
  loop
    execute format('drop policy %I on public.call_plan_votes', pol);
  end loop;
end $$;
create policy "call_plan_votes: update own" on public.call_plan_votes
  for update to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.call_plan_slots s
       where s.id = call_plan_votes.call_plan_slot_id and public.can_see_call_plan(s.call_plan_id)
    )
  );
