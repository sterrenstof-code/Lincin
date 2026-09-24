-- 0074 — een bijdrage voor één groep.
--
-- Handoff 24 sep, Nieuwe bijdrage: "Wie ziet het: Al je lincs · 6 / Kamp
-- '26 · 5". Tot nu toe was een bijdrage altijd voor al je lincs (0002).
-- Voortaan kan hij ook voor één groepsgesprek zijn:
--
--   * `posts.audience_chat_id` null   → al je lincs, zoals altijd;
--   * `posts.audience_chat_id` gezet  → je lincs die óók lid zijn van dat
--     gesprek. Iemand in de groep die geen linc van je is ziet hem niet:
--     een bijdrage blijft iets tussen vrienden.
--
-- Bewust GEEN foreign key met `on delete set null`: verdwijnt de groep,
-- dan zou de bijdrage stilletjes naar al je lincs gaan. Zonder sleutel
-- valt hij dicht — alleen jij ziet hem nog — en dat is de veilige kant.
-- Ook geen `on delete cascade`: iemand anders die een groep opheft hoort
-- jouw foto niet weg te gooien.
--
-- Wat er verder moest meebewegen, omdat het de vriendencheck van 0002
-- herhaalde in plaats van de policy op `posts` te volgen:
--
--   1. de melding bij een nieuwe bijdrage (`notify_friends_of_post`, 0048);
--   2. het album (`post_images`, 0045);
--   3. de activiteitsregels in de feed ("X plaatste iets", 0064);
--   4. reageren, volgen en duwen: die mochten op élk post-id, ook op een
--      bijdrage die je niet kunt zien. Nu alleen op wat je ziet.
--
-- De bestanden in de bucket `posts` blijven leesbaar voor je lincs per map
-- (0003). Hun pad bevat het willekeurige id van de bijdrage en is alleen
-- te vinden via rijen die de RLS hieronder al filtert.

alter table public.posts
  add column if not exists audience_chat_id uuid;

create index if not exists posts_audience_chat_idx
  on public.posts (audience_chat_id)
  where audience_chat_id is not null;

comment on column public.posts.audience_chat_id is
  'Voor één groepsgesprek: alleen lincs die lid zijn zien de bijdrage. null = al je lincs. Geen FK: verdwijnt de groep, dan ziet alleen de maker hem nog.';

-- ---------------------------------------------------------------
-- Wie een bijdrage mag zien
-- ---------------------------------------------------------------

drop policy if exists "see your own posts and posts from accepted friends" on public.posts;
drop policy if exists "posts: jij, en je lincs in het publiek" on public.posts;

create policy "posts: jij, en je lincs in het publiek"
  on public.posts for select
  to authenticated
  using (
    user_id = auth.uid()
    or (
      exists (
        select 1 from public.accepted_friends af
         where af.user_id = auth.uid()
           and af.friend_id = posts.user_id
      )
      and (
        posts.audience_chat_id is null
        or exists (
          select 1 from public.chat_members cm
           where cm.chat_id = posts.audience_chat_id
             and cm.user_id = auth.uid()
        )
      )
    )
  );

-- Plaatsen en bijwerken: alleen voor een groep waar je zelf in zit.
drop policy if exists "create posts as yourself" on public.posts;
create policy "create posts as yourself"
  on public.posts for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and (audience_chat_id is null or public.is_chat_member(audience_chat_id))
  );

drop policy if exists "update your own posts" on public.posts;
create policy "update your own posts"
  on public.posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (audience_chat_id is null or public.is_chat_member(audience_chat_id))
  );

-- ---------------------------------------------------------------
-- 1. De melding bij een nieuwe bijdrage
-- ---------------------------------------------------------------

create or replace function public.notify_friends_of_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Hetzelfde als 0048, met één voorwaarde erbij: een bijdrage voor een
  -- groep gaat alleen naar de lincs in die groep.
  insert into public.notifications (user_id, actor_id, type, post_id)
  select af.user_id, new.user_id, 'friend_post', new.id
    from public.accepted_friends af
   where af.friend_id = new.user_id
     and (
       new.audience_chat_id is null
       or exists (
         select 1 from public.chat_members cm
          where cm.chat_id = new.audience_chat_id and cm.user_id = af.user_id
       )
     )
  on conflict do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------
-- 2. Het album volgt de bijdrage
-- ---------------------------------------------------------------

drop policy if exists "post_images: read with post" on public.post_images;
create policy "post_images: read with post"
  on public.post_images for select
  using (exists (select 1 from public.posts p where p.id = post_images.post_id));

-- ---------------------------------------------------------------
-- 3. Activiteit over een bijdrage alleen voor wie hem ziet
-- ---------------------------------------------------------------

drop policy if exists "activity_events: jij en je lincs" on public.activity_events;
create policy "activity_events: jij en je lincs"
  on public.activity_events for select
  using (
    (
      actor_id = auth.uid()
      or exists (
        select 1 from public.accepted_friends af
         where af.user_id = auth.uid() and af.friend_id = activity_events.actor_id
      )
    )
    and (
      activity_events.post_id is null
      -- `post_id` wijst ook naar polls (post-compose zet dat zo); die
      -- volgen hun eigen regel (0063). Beide subqueries lopen door de RLS,
      -- dus wat je niet mag zien telt hier niet. Een regel over een
      -- verwijderde bijdrage verdwijnt daarmee ook — hij verwees naar niets.
      or exists (select 1 from public.posts p where p.id = activity_events.post_id)
      or exists (select 1 from public.polls pl where pl.id = activity_events.post_id)
    )
  );

-- ---------------------------------------------------------------
-- 4. Reageren, volgen en duwen: alleen op wat je ziet
-- ---------------------------------------------------------------

drop policy if exists "post_reactions: react as yourself" on public.post_reactions;
create policy "post_reactions: react as yourself"
  on public.post_reactions for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = post_reactions.post_id)
  );

drop policy if exists "post_follows: own insert" on public.post_follows;
create policy "post_follows: own insert"
  on public.post_follows for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = post_follows.post_id)
  );

drop policy if exists "post_boosts: own insert" on public.post_boosts;
create policy "post_boosts: own insert"
  on public.post_boosts for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.posts p where p.id = post_boosts.post_id)
  );

-- ---------------------------------------------------------------
-- Eén leesregel, niet meer
-- ---------------------------------------------------------------
-- Policies tellen op ("of"): een vergeten tweede leespolicy op `posts` of
-- `post_images` — met de hand in het dashboard gezet, of uit een oude
-- migratie met een andere naam — zou alles hierboven omzeilen. Dus weg
-- ermee, en zeg welke het waren.
do $$
declare
  r record;
begin
  for r in
    select tablename, policyname
      from pg_policies
     where schemaname = 'public'
       and tablename in ('posts', 'post_images')
       and cmd in ('SELECT', 'ALL')
       and policyname not in ('posts: jij, en je lincs in het publiek', 'post_images: read with post')
  loop
    raise notice '0074: extra leespolicy verwijderd: %.%', r.tablename, r.policyname;
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end
$$;

notify pgrst, 'reload schema';
