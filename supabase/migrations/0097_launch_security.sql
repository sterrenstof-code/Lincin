-- 0097 — laatste veiligheidsronde vóór de lancering (okt 2026).
--
-- 1. approve_event_join / decline_event_join keken `host <> auth.uid()`.
--    Zonder sessie is auth.uid() null, en `x <> null` is null — niet waar —
--    dus de controle liet iedereen met de publieke sleutel door. Nu wordt
--    een ontbrekende sessie expliciet geweigerd, en een beslissing raakt
--    alleen een verzoek dat nog openstaat. Daarna: alle RPC's die de app
--    aanroept, alleen nog voor wie ingelogd is.
-- 2. Beelden in de posts-bucket: de oude leesregel "friends can read each
--    other's posts" (0024) bestond nog — 0091 verwijderde een naam die nooit
--    bestaan had. En een bijdrage, albumfoto of reactie mocht naar een
--    bestand in andermans map verwijzen; via de leesregel van 0091 kreeg je
--    dan een ondertekende link naar dat bestand. Nu alleen je eigen map.
-- 3. notification_insert_ok was aan te roepen voor elk paar mensen: een
--    orakel voor "wie is bevriend met wie". Nu enkel met jezelf als actor.
-- 4. Schrijfrechten die verder gingen dan de app:
--    a. een emoji onder een reactie die je niet mag zien;
--    b. poll_votes rechtstreeks wissen (vote_poll_option regelt intrekken);
--    c. activity_events op eigen naam met een verwijzing naar wat dan ook —
--       de app schrijft ze niet meer zelf, triggers doen het;
--    d. chats: elke kolom (ook call_room, created_by, type) was bij te werken;
--    e. notifications: idem, ook user_id — nu alleen `read`.
-- 5. profile_devices: iedereen las ieders toestelnamen en laatst-gezien.
--    Nu alleen wat nodig is om te versleutelen.
-- 6. Indexen op verwijzingen en filters die nog zonder zaten.
-- 7. De publieke sleutel (anon) leest of schrijft geen enkele tabel meer.

-- ---------------------------------------------------------------
-- 1. Beslissen over verzoeken, en RPC's alleen voor wie ingelogd is
-- ---------------------------------------------------------------

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
  if auth.uid() is null or host <> auth.uid() then raise exception 'alleen de host beslist over verzoeken'; end if;

  if (select count(*) from public.event_members where event_id = p_event_id) >= cap then
    raise exception 'event is vol';
  end if;

  update public.event_join_requests
     set status = 'approved', decided_at = now(), decided_by = auth.uid()
   where event_id = p_event_id and user_id = p_user_id and status = 'pending';
  if not found then raise exception 'verzoek niet gevonden'; end if;

  insert into public.event_members (event_id, user_id, role)
    values (p_event_id, p_user_id, 'guest')
    on conflict (event_id, user_id) do nothing;

  -- De gast hoort te weten dat hij binnen is.
  if p_user_id <> auth.uid() then
    insert into public.notifications (user_id, actor_id, type, event_id)
      values (p_user_id, auth.uid(), 'event_join_approved', p_event_id);
  end if;

  -- Het activiteitsmoment ('event_joined' op naam van de gast) stond hier.
  -- Het komt nu uit de trigger op event_members (punt 4c), net als bij
  -- join_event; hier nog eens invoegen gaf het dubbel.
end;
$$;
revoke all on function public.approve_event_join(uuid, uuid) from public, anon;
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
  if auth.uid() is null or host <> auth.uid() then raise exception 'alleen de host beslist over verzoeken'; end if;

  -- Alleen een openstaand verzoek: een goedgekeurde gast stond anders als
  -- 'declined' in de boeken terwijl hij gewoon lid bleef.
  update public.event_join_requests
     set status = 'declined', decided_at = now(), decided_by = auth.uid()
   where event_id = p_event_id and user_id = p_user_id and status = 'pending';
  if not found then raise exception 'verzoek niet gevonden'; end if;

  -- Een weigering gaat bewust zónder melding naar de gast. Wie geweigerd
  -- wordt hoeft daar geen bericht over te krijgen; de host hoeft zich niet
  -- te verantwoorden.
end;
$$;
revoke all on function public.decline_event_join(uuid, uuid) from public, anon;
grant execute on function public.decline_event_join(uuid, uuid) to authenticated;

-- De RPC's die de app aanroept (lib/api/*, lib/read-state.ts). Supabase geeft
-- nieuwe functies standaard ook aan anon; elk van deze heeft een eigen
-- `grant ... to authenticated` en blijft daarmee werken voor wie ingelogd is.
-- (add_recipient_payload, match_contacts, my_messages_missing_payloads en
-- redeem_friend_code waren al dicht voor anon.)
revoke execute on function public.add_chat_member(uuid, uuid) from public, anon;
revoke execute on function public.create_group_chat(text, uuid[]) from public, anon;
revoke execute on function public.get_or_create_direct_chat(uuid) from public, anon;
revoke execute on function public.mark_chat_read(uuid) from public, anon;
revoke execute on function public.mark_chat_unread(uuid) from public, anon;
revoke execute on function public.my_chat_unread_counts() from public, anon;
revoke execute on function public.join_event(text) from public, anon;
revoke execute on function public.get_event_meta(uuid) from public, anon;
revoke execute on function public.list_my_events() from public, anon;
revoke execute on function public.list_event_join_requests(uuid) from public, anon;
revoke execute on function public.poll_results(uuid) from public, anon;
revoke execute on function public.poll_voter_count(uuid) from public, anon;
revoke execute on function public.vote_poll_option(uuid) from public, anon;
revoke execute on function public.propose_poll_option(uuid, text) from public, anon;
revoke execute on function public.remove_poll_option(uuid) from public, anon;
revoke execute on function public.touch_reading_state(timestamptz) from public, anon;

-- ---------------------------------------------------------------
-- 2. Beelden in de posts-bucket: alleen je eigen map
-- ---------------------------------------------------------------

-- De echte naam van de oude leesregel op de map van je lincs (0024).
drop policy if exists "friends can read each other's posts" on storage.objects;

-- De app uploadt altijd naar `<user_id>/...` (lib/api/posts.ts,
-- lib/api/entity-comments.ts), en de uploadregel van 0024 dwingt dat af.
-- Een rij mag dus ook alleen naar een bestand in de map van zijn eigenaar
-- wijzen. Bestaande rijen worden niet meteen getoetst (`not valid`); de
-- validatie daarna slaagt of meldt alleen dat er oude rijen afwijken.
alter table public.posts drop constraint if exists posts_media_own_folder;
alter table public.posts add constraint posts_media_own_folder check (
  (image_path is null or split_part(image_path, '/', 1) = user_id::text)
  and (video_path is null or split_part(video_path, '/', 1) = user_id::text)
) not valid;

do $$
begin
  alter table public.posts validate constraint posts_media_own_folder;
exception when check_violation then
  raise notice '0097: posts_media_own_folder blijft not valid — oude rijen wijzen buiten de eigen map';
end $$;

drop policy if exists "post_images: own insert" on public.post_images;
create policy "post_images: own insert"
  on public.post_images for insert
  with check (
    exists (select 1 from public.posts p where p.id = post_images.post_id and p.user_id = auth.uid())
    and split_part(post_images.image_path, '/', 1) = auth.uid()::text
  );

drop policy if exists "entity_comments: op wat je ziet" on public.entity_comments;
create policy "entity_comments: op wat je ziet"
  on public.entity_comments for insert
  with check (
    auth.uid() = user_id
    and (image_path is null or split_part(image_path, '/', 1) = auth.uid()::text)
    and case entity_type
      when 'post' then exists (select 1 from public.posts po where po.id = entity_id)
      when 'poll' then public.can_see_poll(entity_id)
      when 'call_plan' then public.can_see_call_plan(entity_id)
      when 'list' then public.can_see_list(entity_id)
      else false
    end
  );

-- ---------------------------------------------------------------
-- 3. Meldingen: alleen jezelf als afzender
-- ---------------------------------------------------------------

create or replace function public.notification_insert_ok(
  p_actor uuid, p_user uuid, p_type text,
  p_post uuid, p_poll uuid, p_list uuid, p_call uuid
) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_actor = auth.uid()
    and p_type in ('invited_to_list', 'invited_to_call', 'vote_on_call', 'mention', 'vote_on_poll')
    and (
      exists (select 1 from friendships f
               where f.status = 'accepted'
                 and ((f.requester_id = p_actor and f.addressee_id = p_user)
                   or (f.requester_id = p_user and f.addressee_id = p_actor)))
      or exists (select 1 from chat_members a join chat_members b on b.chat_id = a.chat_id
                  where a.user_id = p_actor and b.user_id = p_user)
    )
    and (p_poll is null or exists (select 1 from polls where id = p_poll and user_id = p_user))
    and (p_list is null or exists (select 1 from shared_lists where id = p_list and user_id = p_actor))
    and (p_call is null or exists (select 1 from call_plans where id = p_call and user_id in (p_actor, p_user)))
$$;
revoke all on function public.notification_insert_ok(uuid, uuid, text, uuid, uuid, uuid, uuid) from public, anon;
grant execute on function public.notification_insert_ok(uuid, uuid, text, uuid, uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------
-- 4. Schrijfrechten
-- ---------------------------------------------------------------

-- a. Een emoji alleen onder een reactie die je mag zien (dezelfde regel als
--    lezen, 0063: de RLS van entity_comments beslist).
drop policy if exists "comment_reactions: react as yourself" on public.comment_reactions;
create policy "comment_reactions: react as yourself"
  on public.comment_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.entity_comments c where c.id = comment_reactions.comment_id)
  );

-- b. Een stem intrekken gaat via vote_poll_option (0085), dat ook gesloten
--    polls bewaakt. Rechtstreeks wissen sloeg dat over.
drop policy if exists "poll_votes: own delete" on public.poll_votes;

-- c. Activiteitsmomenten. De app schreef ze zelf (lib/api/activity-events.ts),
--    op eigen naam maar met een verwijzing naar elke bijdrage, elk event of
--    elke persoon. Elk van die vier momenten volgt rechtstreeks uit een rij
--    die al bestaat, dus nu schrijven triggers ze en de app niet meer.
--    - post_created:    na een nieuwe bijdrage (createFind, voor elke zichtbaarheid;
--                       wie hem mag zien regelt de leesregel van 0074).
--                       De app schreef dit ook voor polls, maar post_id verwijst
--                       naar posts: die rij werd door de foreign key altijd
--                       geweigerd. Dat blijft zo — geen trigger op polls.
--    - friend_accepted: wanneer een verzoek 'accepted' wordt; de aanvaarder
--                       is actor, de aanvrager friend_id.
--    - event_created:   na een nieuw event, op naam van de host.
--    - event_joined:    na een nieuwe gast in event_members (open event via
--                       join_event, of goedgekeurd via approve_event_join).
drop policy if exists "activity_events: authenticated insert" on public.activity_events;

create or replace function public.activity_post_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_events (actor_id, kind, post_id)
    values (new.user_id, 'post_created', new.id);
  return new;
end;
$$;
revoke all on function public.activity_post_created() from public, anon, authenticated;

drop trigger if exists posts_activity_created on public.posts;
create trigger posts_activity_created
  after insert on public.posts
  for each row execute function public.activity_post_created();

create or replace function public.activity_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.activity_events (actor_id, kind, friend_id)
      values (new.addressee_id, 'friend_accepted', new.requester_id);
  end if;
  return new;
end;
$$;
revoke all on function public.activity_friend_accepted() from public, anon, authenticated;

drop trigger if exists friendships_activity_accepted on public.friendships;
create trigger friendships_activity_accepted
  after update of status on public.friendships
  for each row execute function public.activity_friend_accepted();

create or replace function public.activity_event_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.activity_events (actor_id, kind, event_id)
    values (new.host_user_id, 'event_created', new.id);
  return new;
end;
$$;
revoke all on function public.activity_event_created() from public, anon, authenticated;

drop trigger if exists events_activity_created on public.events;
create trigger events_activity_created
  after insert on public.events
  for each row execute function public.activity_event_created();

create or replace function public.activity_event_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role = 'guest' then
    insert into public.activity_events (actor_id, kind, event_id)
      values (new.user_id, 'event_joined', new.event_id);
  end if;
  return new;
end;
$$;
revoke all on function public.activity_event_joined() from public, anon, authenticated;

drop trigger if exists event_members_activity_joined on public.event_members;
create trigger event_members_activity_joined
  after insert on public.event_members
  for each row execute function public.activity_event_joined();

-- d. Een groep bijwerken: de app zet alleen de naam en de groepsfoto
--    (lib/api/chats.ts). last_message_at loopt via een security
--    definer-trigger (0022), call_room via 0096.
revoke update on public.chats from authenticated, anon;
grant update (name, avatar_url) on public.chats to authenticated;

-- e. Een melding bijwerken = hem gelezen zetten (lib/api/notifications.ts).
--    De regel van 0032 had geen `with check`: een melding kon zo naar
--    iemand anders verhuizen.
revoke update on public.notifications from authenticated, anon;
grant update (read) on public.notifications to authenticated;

-- ---------------------------------------------------------------
-- 5. Toestellen: alleen de sleutel is van iedereen
-- ---------------------------------------------------------------
-- Om voor iemand te versleutelen heb je zijn toestellen en hun publieke
-- sleutel nodig — niet de naam die hij ze gaf of wanneer hij er laatst op
-- zat. De app leest deze tabel vandaag niet; de leesregel blijft `true`,
-- maar alleen deze drie kolommen zijn nog leesbaar.
revoke select on public.profile_devices from authenticated, anon;
grant select (user_id, device_id, identity_pubkey) on public.profile_devices to authenticated;

-- ---------------------------------------------------------------
-- 6. Indexen
-- ---------------------------------------------------------------

-- activity_events: de feed sorteert op tijd; de rest zijn verwijzingen die
-- bij elke delete van een bijdrage, event of account opgezocht worden.
create index if not exists activity_events_actor_idx on public.activity_events (actor_id);
create index if not exists activity_events_post_idx on public.activity_events (post_id);
create index if not exists activity_events_event_idx on public.activity_events (event_id);
create index if not exists activity_events_friend_idx on public.activity_events (friend_id);
create index if not exists activity_events_created_idx on public.activity_events (created_at desc);

-- Feedpolls en -belafspraken van één persoon; ook wat polls_claim_chat
-- (0063/0064) bij elk nieuw bericht zoekt.
create index if not exists polls_user_feed_idx on public.polls (user_id, created_at desc) where chat_id is null;
create index if not exists call_plans_user_feed_idx on public.call_plans (user_id, created_at desc) where chat_id is null;

-- notifications: elke verwijzing cascadeert bij een delete.
create index if not exists notifications_post_idx on public.notifications (post_id);
create index if not exists notifications_entity_comment_idx on public.notifications (entity_comment_id);
create index if not exists notifications_poll_idx on public.notifications (poll_id);
create index if not exists notifications_call_plan_idx on public.notifications (call_plan_id);
create index if not exists notifications_list_idx on public.notifications (list_id);
create index if not exists notifications_event_idx on public.notifications (event_id);
create index if not exists notifications_bug_report_idx on public.notifications (bug_report_id);
create index if not exists notifications_actor_idx on public.notifications (actor_id);

create index if not exists poll_options_poll_idx on public.poll_options (poll_id);
create index if not exists call_plan_slots_call_plan_idx on public.call_plan_slots (call_plan_id);
create index if not exists messages_sender_created_idx on public.messages (sender_id, created_at desc);
create index if not exists entity_comments_parent_idx on public.entity_comments (parent_id);
create index if not exists entity_comments_user_idx on public.entity_comments (user_id);
create index if not exists shared_lists_user_idx on public.shared_lists (user_id);
create index if not exists comment_hides_comment_idx on public.comment_hides (comment_id);
create index if not exists key_transfers_user_idx on public.key_transfers (user_id);
create index if not exists event_contributions_user_idx on public.event_contributions (user_id);
create index if not exists chats_created_by_idx on public.chats (created_by);
create index if not exists list_items_user_idx on public.list_items (user_id);
create index if not exists content_reports_reporter_idx on public.content_reports (reporter_id);

-- ---------------------------------------------------------------
-- 7. Niets voor wie niet ingelogd is
-- ---------------------------------------------------------------
-- Geen enkel scherm leest of schrijft een tabel vóór het inloggen: /e/[code]
-- en /c/[code] onthouden de code en wachten op een sessie, /add/[username]
-- stuurt door, en (auth)/* praat alleen met supabase.auth. Elke rij in
-- public was voor anon al afgeschermd door RLS; nu ook de rechten zelf.
revoke all on all tables in schema public from anon;
