-- Veiligheidscontrole vóór productie (okt 2026): de toegangsregels.
-- Elk punt hieronder liet een gewone ingelogde gebruiker (of iedereen met
-- de publieke sleutel) iets doen wat de app zelf nooit doet.

-- ---------------------------------------------------------------
-- 1. De privésleutels van de versleuteling
-- ---------------------------------------------------------------
-- `profiles.identity_privkey` stond in een tabel die elke ingelogde
-- gebruiker volledig mag lezen: wie de API rechtstreeks aansprak, kreeg
-- ieders sleutel. Ze verhuizen naar een eigen tabel waar alleen jij je
-- eigen rij ziet; de kolom verdwijnt.

create table if not exists public.private_keys (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  privkey    text not null,
  updated_at timestamptz not null default now()
);
alter table public.private_keys enable row level security;

drop policy if exists "private_keys: own read" on public.private_keys;
create policy "private_keys: own read" on public.private_keys
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "private_keys: own insert" on public.private_keys;
create policy "private_keys: own insert" on public.private_keys
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "private_keys: own update" on public.private_keys;
create policy "private_keys: own update" on public.private_keys
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.private_keys from anon;

insert into public.private_keys (user_id, privkey)
select id, identity_privkey from public.profiles where identity_privkey is not null
on conflict (user_id) do nothing;

alter table public.profiles drop column if exists identity_privkey;

-- ---------------------------------------------------------------
-- 2. Vriendschappen
-- ---------------------------------------------------------------
-- Iedereen kon een rij met status 'accepted' invoegen, of zijn eigen
-- verzoek op 'accepted' zetten: linc met wie je wil, zonder ja. Nu:
-- invoegen alleen als verzoek, aanvaarden alleen door wie het kreeg, en
-- wie-met-wie ligt vast. (Codes en uitnodigingen lopen via security
-- definer-functies en vallen hier buiten.)

drop policy if exists "send a friend request as yourself" on public.friendships;
create policy "send a friend request as yourself" on public.friendships
  for insert to authenticated
  with check (auth.uid() = requester_id and requester_id <> addressee_id and status = 'pending' and accepted_at is null);

drop policy if exists "addressee can accept or decline" on public.friendships;
create policy "addressee can accept or decline" on public.friendships
  for update to authenticated
  using (auth.uid() = addressee_id and status = 'pending')
  with check (auth.uid() = addressee_id and status in ('pending', 'accepted'));

create or replace function public.friendships_freeze_parties()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'friendship parties cannot change';
  end if;
  return new;
end $$;
drop trigger if exists friendships_freeze_parties on public.friendships;
create trigger friendships_freeze_parties before update on public.friendships
  for each row execute function public.friendships_freeze_parties();

-- De view met alle vriendschappen draaide als eigenaar (buiten RLS) en was
-- leesbaar zonder in te loggen: het hele vriendennetwerk lag open.
alter view public.accepted_friends set (security_invoker = true);
revoke all on public.accepted_friends from anon;

-- ---------------------------------------------------------------
-- 3. Gesprekken
-- ---------------------------------------------------------------
-- Wie een chat-id kende, kon zichzelf toevoegen (ook als eigenaar), en een
-- lid kon zichzelf tot eigenaar maken. Lid worden gaat nu alleen via
-- create_group_chat / get_or_create_direct_chat / add_chat_member; zelf
-- aanpassen kan alleen gelezen-tot en verborgen.

drop policy if exists "add yourself as a chat member" on public.chat_members;
revoke update on public.chat_members from authenticated, anon;
grant update (last_read_at, hidden_at) on public.chat_members to authenticated;

-- Een eigen bericht bewerken mocht het ook naar een andere chat verhuizen.
drop policy if exists "Gebruiker mag eigen berichten bewerken" on public.messages;
create policy "Gebruiker mag eigen berichten bewerken" on public.messages
  for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid() and public.is_chat_member(chat_id));

-- Opnieuw versleutelen voor een nieuw lid mocht ook de kopie van een
-- bestaand lid overschrijven (met een eigen tekst). Nu alleen toevoegen,
-- en alleen voor wie echt lid is.
create or replace function public.add_recipient_payload(
  p_message_id uuid,
  p_user_id    text,
  p_payload    jsonb
)
returns void
language sql
security definer
set search_path = public
as $$
  update messages
     set recipient_payloads = recipient_payloads || jsonb_build_object(p_user_id, p_payload)
   where id = p_message_id
     and not (recipient_payloads ? p_user_id)
     and chat_id in (select chat_id from chat_members where user_id = auth.uid())
     and exists (select 1 from chat_members m where m.chat_id = messages.chat_id and m.user_id::text = p_user_id);
$$;
revoke all on function public.add_recipient_payload(uuid, text, jsonb) from public, anon;
grant execute on function public.add_recipient_payload(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------
-- 4. Events
-- ---------------------------------------------------------------
-- Iedereen kon zichzelf lid maken van elk event (gesloten, vol of niet).
-- Meedoen gaat via join_event / approve_event_join; de app voegt zelf
-- alleen de host toe bij het aanmaken.
drop policy if exists "join event as yourself" on public.event_members;
create policy "host joins own event" on public.event_members
  for insert to authenticated
  with check (
    user_id = auth.uid() and role = 'host'
    and exists (select 1 from public.events e where e.id = event_id and e.host_user_id = auth.uid())
  );

-- ---------------------------------------------------------------
-- 5. Polls
-- ---------------------------------------------------------------
-- Stemmen gaat via vote_poll_option (0085), dat gesloten polls en één
-- keuze afdwingt. Rechtstreeks invoegen sloeg die regels over.
drop policy if exists "poll_votes: stem op wat je ziet" on public.poll_votes;

-- ---------------------------------------------------------------
-- 6. Kleinere lekken
-- ---------------------------------------------------------------
-- Wie bij een bijdrage betrokken is: alleen voor de triggers.
revoke execute on function public.post_audience(uuid, uuid) from public, anon, authenticated;

-- Volgen en omhoogduwen: alleen bij bijdragen die je mag zien.
drop policy if exists "post_follows: read" on public.post_follows;
create policy "post_follows: read" on public.post_follows
  for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));
drop policy if exists "post_boosts: read" on public.post_boosts;
create policy "post_boosts: read" on public.post_boosts
  for select to authenticated using (exists (select 1 from public.posts p where p.id = post_id));

alter function public.cleanup_expired_key_transfers() set search_path = public;
revoke execute on function public.cleanup_expired_key_transfers() from public, anon, authenticated;

-- Links die mensen invoeren: alleen http(s), nooit javascript: of data:.
alter table public.posts drop constraint if exists posts_link_url_http;
alter table public.posts add constraint posts_link_url_http check (link_url is null or link_url ~* '^https?://');
alter table public.event_contributions drop constraint if exists event_contributions_link_url_http;
alter table public.event_contributions add constraint event_contributions_link_url_http check (link_url is null or link_url ~* '^https?://');
alter table public.profiles drop constraint if exists profiles_avatar_url_http;
alter table public.profiles add constraint profiles_avatar_url_http check (avatar_url is null or avatar_url ~* '^https?://');
alter table public.profiles drop constraint if exists profiles_hero_url_http;
alter table public.profiles add constraint profiles_hero_url_http check (hero_url is null or hero_url ~* '^https?://');
