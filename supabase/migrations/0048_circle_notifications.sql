-- 0048_circle_notifications.sql
--
-- Meldingen voor wat er in de kring gebeurt.
--
-- ---------------------------------------------------------------
-- HET PRINCIPE: BETROKKENHEID, NIET EIGENDOM
-- ---------------------------------------------------------------
-- Tot nu toe kreeg je bericht over een vondst als je hem geplaatst had,
-- of als je hem uitdrukkelijk volgde. Dat is te smal. Wie een emoji
-- achterlaat, wie een vondst omhoog duwt, wie er één zin onder typt —
-- die heeft er iets mee, en wil weten hoe het verder gaat.
--
-- Vanaf hier bestaat er één begrip: de **kring rond een vondst**. Daar
-- hoor je bij zodra je er op welke manier dan ook iets mee gedaan hebt:
--
--     plaatsen · reageren · omhoog duwen · een emoji geven · volgen
--
-- Elke nieuwe beweging op die vondst gaat naar iedereen in die kring,
-- behalve naar degene die de beweging maakte. `post_audience()` hieronder
-- is de enige plek waar dat begrip gedefinieerd staat — de drie triggers
-- lezen er allemaal uit, dus de kring kan nooit per gebeurtenis verschillen.
--
-- ---------------------------------------------------------------
-- WAAROM IN DE DATABASE EN NIET IN DE APP
-- ---------------------------------------------------------------
-- Dezelfde reden als in 0047: de app maakte deze meldingen zelf aan,
-- fire-and-forget, ná het plaatsen. Dat werkt alleen als de handeling via
-- dát ene scherm binnenkomt en de gebruiker blijft staan tot het verzoek
-- klaar is. Geen van beide is gegarandeerd. Een melding die soms wél en
-- soms niet komt is erger dan geen melding: je gaat het systeem
-- wantrouwen. Nu gebeurt het in dezelfde transactie als de handeling.
--
-- Wat de app zelf aanmaakte (`comment_on_post`, `comment_on_thread`,
-- `post_boost`) verhuist hierheen. De aanroepen in `lib/api/` zijn in
-- dezelfde wijziging verwijderd, anders komt alles dubbel.

-- ===============================================================
-- 1. Twee kolommen erbij
-- ===============================================================
-- `comment_id` wijst naar de oude `comments`-tabel. De app schrijft al
-- lang naar `entity_comments` en kon die kolom dus niet meer vullen —
-- daardoor stond er nooit een fragment van de reactie in de melding.
-- Met een eigen verwijzing komt de tekst terug, in de lijst én in de push.
alter table public.notifications
  add column if not exists entity_comment_id uuid
    references public.entity_comments(id) on delete cascade;

-- `detail` draagt het ene detail dat per soort verschilt en te klein is
-- voor een eigen kolom: bij een emoji-reactie de emoji zelf. "Sara ❤️ je
-- vondst" zegt meer dan "Sara reageerde op je vondst".
alter table public.notifications
  add column if not exists detail text;

comment on column public.notifications.entity_comment_id is
  'De reactie waar deze melding over gaat (entity_comments). `comment_id` is de oude tabel.';
comment on column public.notifications.detail is
  'Het soort-specifieke detail. Nu: de emoji bij post_reaction / thread_reaction.';

-- ===============================================================
-- 2. Geen herhaling voor signalen
-- ===============================================================
-- Een reactie is elke keer nieuws. Een duw of een emoji is dat niet: wie
-- zijn emoji weghaalt en er een andere neerzet, of twee emoji's geeft,
-- hoort niet twee keer in je lijst te staan. Eén melding per persoon per
-- vondst per soort, afgedwongen door de index en opgevangen met
-- `on conflict do nothing` in de triggers.
--
-- Eerst opruimen wat er al dubbel staat — anders kan de index niet aan.
delete from public.notifications a
 using public.notifications b
 where a.type in ('post_boost', 'thread_boost', 'post_reaction',
                  'thread_reaction', 'friend_post')
   and a.type = b.type
   and a.user_id = b.user_id
   and a.actor_id = b.actor_id
   and a.post_id is not distinct from b.post_id
   and a.id > b.id;

create unique index if not exists notifications_signal_once
  on public.notifications (user_id, actor_id, type, post_id)
  where type in ('post_boost', 'thread_boost', 'post_reaction',
                 'thread_reaction', 'friend_post');

-- ===============================================================
-- 3. De kring rond een vondst
-- ===============================================================
-- Eén definitie, vijf manieren om erbij te horen. `security definer` want
-- de triggers moeten de hele kring zien, ook de leden die de handelende
-- gebruiker zelf niet mag opvragen.
create or replace function public.post_audience(p_post_id uuid, p_actor uuid)
-- De uitvoerkolom heet `uid` en niet `user_id`: bij `returns table` komt die
-- naam als parameter in scope te staan, en dan kan een onbedoeld
-- ongekwalificeerde verwijzing in de body ineens de uitvoerkolom raken in
-- plaats van de tabelkolom. Een andere naam sluit dat uit.
returns table (uid uuid)
language sql
stable
security definer
set search_path = public
as $$
  select distinct k.user_id
    from (
      select p.user_id from public.posts p            where p.id      = p_post_id
      union
      select c.user_id from public.entity_comments c  where c.entity_id = p_post_id
                                                        and c.entity_type = 'post'
      union
      select b.user_id from public.post_boosts b      where b.post_id = p_post_id
      union
      select r.user_id from public.post_reactions r   where r.post_id = p_post_id
      union
      select f.user_id from public.post_follows f     where f.post_id = p_post_id
    ) k
   where k.user_id <> p_actor;
$$;

comment on function public.post_audience(uuid, uuid) is
  'Iedereen die iets met deze vondst gedaan heeft — geplaatst, gereageerd, geduwd, een emoji gegeven of gevolgd — behalve p_actor.';

-- ===============================================================
-- 4. Een nieuwe vondst van iemand uit je kring
-- ===============================================================
-- De ontvangers zijn exact de mensen die de vondst mogen zien: het
-- leespolicy op `posts` (0002) laat je eigen vondsten door plus die van
-- geaccepteerde vrienden. `accepted_friends` is diezelfde lijst, dus er
-- kan geen melding ontstaan over iets wat je niet kunt openen.
create or replace function public.notify_friends_of_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, type, post_id)
  select af.user_id, new.user_id, 'friend_post', new.id
    from public.accepted_friends af
   where af.friend_id = new.user_id
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists posts_notify_friends on public.posts;
create trigger posts_notify_friends
  after insert on public.posts
  for each row
  execute function public.notify_friends_of_post();

-- ===============================================================
-- 5. Een reactie op een vondst
-- ===============================================================
-- Vervangt `notify_post_followers` uit 0047. Die keek alleen naar
-- `post_follows`; deze kijkt naar de hele kring. De eigenaar krijgt een
-- eigen soort, want "op jouw vondst" leest anders dan "op een vondst waar
-- jij ook in zit".
create or replace function public.notify_comment_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if new.entity_type <> 'post' then
    return new;
  end if;

  select p.user_id into v_owner from public.posts p where p.id = new.entity_id;
  if v_owner is null then
    return new;
  end if;

  if v_owner <> new.user_id then
    insert into public.notifications
      (user_id, actor_id, type, post_id, entity_comment_id)
    values
      (v_owner, new.user_id, 'comment_on_post', new.entity_id, new.id);
  end if;

  insert into public.notifications
    (user_id, actor_id, type, post_id, entity_comment_id)
  select a.uid, new.user_id, 'comment_on_thread', new.entity_id, new.id
    from public.post_audience(new.entity_id, new.user_id) a
   where a.uid <> v_owner;

  return new;
end;
$$;

drop trigger if exists entity_comments_notify_followers on public.entity_comments;
drop trigger if exists entity_comments_notify_audience  on public.entity_comments;
create trigger entity_comments_notify_audience
  after insert on public.entity_comments
  for each row
  execute function public.notify_comment_audience();

drop function if exists public.notify_post_followers();

-- ===============================================================
-- 6. Een duw omhoog
-- ===============================================================
create or replace function public.notify_boost_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select p.user_id into v_owner from public.posts p where p.id = new.post_id;
  if v_owner is null then
    return new;
  end if;

  if v_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id)
    values (v_owner, new.user_id, 'post_boost', new.post_id)
    on conflict do nothing;
  end if;

  insert into public.notifications (user_id, actor_id, type, post_id)
  select a.uid, new.user_id, 'thread_boost', new.post_id
    from public.post_audience(new.post_id, new.user_id) a
   where a.uid <> v_owner
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists post_boosts_notify_audience on public.post_boosts;
create trigger post_boosts_notify_audience
  after insert on public.post_boosts
  for each row
  execute function public.notify_boost_audience();

-- ===============================================================
-- 7. Een emoji op een vondst
-- ===============================================================
-- De emoji reist mee in `detail`. Bij de tweede emoji van dezelfde
-- persoon vangt de index het af: de eerste melding blijft staan, met de
-- eerste emoji erin. Dat is de bedoeling — het gaat om "Sara reageerde",
-- niet om een teller.
create or replace function public.notify_reaction_audience()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select p.user_id into v_owner from public.posts p where p.id = new.post_id;
  if v_owner is null then
    return new;
  end if;

  if v_owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, type, post_id, detail)
    values (v_owner, new.user_id, 'post_reaction', new.post_id, new.emoji)
    on conflict do nothing;
  end if;

  insert into public.notifications (user_id, actor_id, type, post_id, detail)
  select a.uid, new.user_id, 'thread_reaction', new.post_id, new.emoji
    from public.post_audience(new.post_id, new.user_id) a
   where a.uid <> v_owner
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists post_reactions_notify_audience on public.post_reactions;
create trigger post_reactions_notify_audience
  after insert on public.post_reactions
  for each row
  execute function public.notify_reaction_audience();
