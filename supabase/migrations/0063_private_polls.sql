-- 0063 — een poll in een gesprek is van dat gesprek.
--
-- Tot nu toe (0031) mocht élke ingelogde gebruiker élke poll lezen, met
-- zijn keuzes en stemmen, en toonde de feed ze allemaal — ook een poll die
-- in een gesprek tussen twee mensen gestuurd was. Voortaan:
--
--   * een poll uit een gesprek draagt `chat_id` en is alleen zichtbaar voor
--     de leden van dat gesprek;
--   * een poll in de feed (geen `chat_id`) is zichtbaar voor de maker en
--     zijn lincs — hetzelfde model als een bijdrage (0002);
--   * keuzes, stemmen en comments volgen de poll.
--
-- En meteen dicht wat op dezelfde manier openstond: comments op een
-- bijdrage, en de emoji-reacties op bijdragen en comments, waren ook voor
-- iedereen leesbaar. Die volgen nu de bijdrage of comment waar ze onder
-- staan.

-- ---------------------------------------------------------------
-- De kolom, en de polls die al in een gesprek stonden
-- ---------------------------------------------------------------

alter table public.polls
  add column if not exists chat_id uuid references public.chats (id) on delete cascade;

create index if not exists polls_chat_idx on public.polls (chat_id);

-- Welk bericht bij een poll hoort staat versleuteld in het bericht zelf;
-- de database ziet alleen afzender en tijd. Een poll uit een gesprek wordt
-- aangemaakt en direct daarna als bericht verstuurd, door dezelfde
-- persoon. Dus: het eerste bericht van de maker binnen 30 seconden na de
-- poll wijst het gesprek aan. Een feedpoll die toevallig binnen 30 seconden
-- door een bericht gevolgd werd, wordt zo privé — fout in de veilige
-- richting.
update public.polls p
   set chat_id = hit.chat_id
  from (
    select distinct on (p2.id) p2.id as poll_id, m.chat_id
      from public.polls p2
      join public.messages m
        on m.sender_id = p2.user_id
       and m.created_at >= p2.created_at
       and m.created_at <= p2.created_at + interval '30 seconds'
     where p2.chat_id is null
     order by p2.id, m.created_at
  ) hit
 where hit.poll_id = p.id;

-- Hetzelfde voor wat er nog binnenkomt van een oudere app, die de poll
-- zonder `chat_id` aanmaakt en daarna het bericht stuurt. De nieuwe app
-- zet `chat_id` zelf; dan doet dit niets.
create or replace function public.polls_claim_chat()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.polls
     set chat_id = new.chat_id
   where user_id = new.sender_id
     and chat_id is null
     and created_at >= new.created_at - interval '30 seconds'
     and created_at <= new.created_at;
  return new;
end;
$$;

drop trigger if exists messages_claim_poll on public.messages;
create trigger messages_claim_poll
  after insert on public.messages
  for each row execute function public.polls_claim_chat();

-- ---------------------------------------------------------------
-- Wie een poll mag zien
-- ---------------------------------------------------------------

create or replace function public.can_see_poll(p_poll_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.polls p
     where p.id = p_poll_id
       and (
         p.user_id = auth.uid()
         or (
           p.chat_id is not null
           and exists (
             select 1 from public.chat_members cm
              where cm.chat_id = p.chat_id and cm.user_id = auth.uid()
           )
         )
         or (
           p.chat_id is null
           and exists (
             select 1 from public.accepted_friends af
              where af.user_id = auth.uid() and af.friend_id = p.user_id
           )
         )
       )
  );
$$;
grant execute on function public.can_see_poll(uuid) to authenticated;

-- polls
drop policy if exists "polls: authenticated read" on public.polls;
drop policy if exists "polls: owner insert" on public.polls;
drop policy if exists "polls: wie hem mag zien" on public.polls;
drop policy if exists "polls: als jezelf, in je eigen gesprek" on public.polls;

create policy "polls: wie hem mag zien"
  on public.polls for select
  using (public.can_see_poll(id));

create policy "polls: als jezelf, in je eigen gesprek"
  on public.polls for insert
  with check (
    auth.uid() = user_id
    and (chat_id is null or public.is_chat_member(chat_id))
  );

-- poll_options
drop policy if exists "poll_options: authenticated read" on public.poll_options;
drop policy if exists "poll_options: met de poll" on public.poll_options;

create policy "poll_options: met de poll"
  on public.poll_options for select
  using (public.can_see_poll(poll_id));

-- poll_votes
drop policy if exists "poll_votes: authenticated read" on public.poll_votes;
drop policy if exists "poll_votes: authenticated insert" on public.poll_votes;
drop policy if exists "poll_votes: met de poll" on public.poll_votes;
drop policy if exists "poll_votes: stem op wat je ziet" on public.poll_votes;

create policy "poll_votes: met de poll"
  on public.poll_votes for select
  using (
    exists (
      select 1 from public.poll_options po
       where po.id = poll_option_id and public.can_see_poll(po.poll_id)
    )
  );

create policy "poll_votes: stem op wat je ziet"
  on public.poll_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.poll_options po
       where po.id = poll_option_id and public.can_see_poll(po.poll_id)
    )
  );

-- ---------------------------------------------------------------
-- Comments en reacties volgen wat ze betreffen
-- ---------------------------------------------------------------

-- Een bijdrage: de RLS op posts (0002) beslist. Een poll: can_see_poll.
-- Belafspraken en lijsten houden hun oude regel; die hebben geen eigen
-- zichtbaarheid om naar te verwijzen.
drop policy if exists "entity_comments: authenticated read" on public.entity_comments;
drop policy if exists "entity_comments: authenticated insert" on public.entity_comments;
drop policy if exists "entity_comments: met wat ze betreffen" on public.entity_comments;
drop policy if exists "entity_comments: op wat je ziet" on public.entity_comments;

create policy "entity_comments: met wat ze betreffen"
  on public.entity_comments for select
  using (
    case entity_type
      when 'post' then exists (select 1 from public.posts po where po.id = entity_id)
      when 'poll' then public.can_see_poll(entity_id)
      else auth.role() = 'authenticated'
    end
  );

create policy "entity_comments: op wat je ziet"
  on public.entity_comments for insert
  with check (
    auth.uid() = user_id
    and case entity_type
      when 'post' then exists (select 1 from public.posts po where po.id = entity_id)
      when 'poll' then public.can_see_poll(entity_id)
      else true
    end
  );

drop policy if exists "post_reactions: authenticated read" on public.post_reactions;
drop policy if exists "post_reactions: met de bijdrage" on public.post_reactions;

create policy "post_reactions: met de bijdrage"
  on public.post_reactions for select
  using (exists (select 1 from public.posts po where po.id = post_id));

drop policy if exists "comment_reactions: authenticated read" on public.comment_reactions;
drop policy if exists "comment_reactions: met de comment" on public.comment_reactions;

create policy "comment_reactions: met de comment"
  on public.comment_reactions for select
  using (exists (select 1 from public.entity_comments c where c.id = comment_id));

comment on column public.polls.chat_id is
  'Het gesprek waarin de poll gestuurd werd; alleen de leden zien hem. null = feedpoll, zichtbaar voor de maker en zijn lincs.';
