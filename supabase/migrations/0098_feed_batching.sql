-- 0098 — de feed in een handvol vragen in plaats van tientallen.
--
-- Een koude feed kostte per poll zes vragen (keuzes, uitslag, aantal
-- stemmers, stemmen, profielen …) en voor de tellers onder elke vondst
-- haalde de app álle emoji-, duw- en reactierijen op om ze in JavaScript
-- te tellen. Twee functies vangen dat in één vraag per soort.
--
-- Beide zijn `security invoker`: ze lezen met de rechten van wie vraagt,
-- dus RLS bepaalt nog steeds wat er meetelt. Ze geven niets terug wat de
-- app met losse selects niet ook al kon zien.

-- ---------------------------------------------------------------
-- 1. Polls met keuzes, aantallen en eigen stem — één rij per poll
-- ---------------------------------------------------------------
-- Welke polls: wat de policy op `polls` toelaat (maker, lincs, leden van
-- het gesprek). Een id die je niet mag zien levert gewoon geen rij op.
--
-- De aantallen komen uit `poll_results` en `poll_voter_count` (0085/0086).
-- Die blijven security definer, en met reden: bij een anonieme poll laat
-- de policy op `poll_votes` alleen je eigen stem zien, maar het aantal
-- moet iedereen zien. Ze controleren zelf `can_see_poll`.
--
-- Wie stemde (`voter_ids`) komt rechtstreeks uit `poll_votes`, dus door
-- diezelfde policy heen; bij een anonieme poll geven we daarbovenop
-- altijd een lege lijst terug. Een anonieme poll lekt hier dus nooit wie
-- wat koos — alleen je eigen keuze, in `my_option_ids`.
create or replace function public.feed_polls_with_details(p_poll_ids uuid[])
returns table (
  id uuid,
  user_id uuid,
  question text,
  ends_at timestamptz,
  created_at timestamptz,
  allow_multiple boolean,
  swatch text,
  anonymous boolean,
  allow_proposals boolean,
  options jsonb,
  my_option_ids uuid[],
  voter_count integer
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id, p.user_id, p.question, p.ends_at, p.created_at,
    p.allow_multiple, p.swatch, p.anonymous, p.allow_proposals,
    coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', po.id,
                 'poll_id', po.poll_id,
                 'label', po.label,
                 'position', po.position,
                 'created_by', po.created_by,
                 'votes', coalesce(r.votes, 0),
                 'voter_ids', case
                   when p.anonymous then '[]'::jsonb
                   else coalesce((
                     select jsonb_agg(v.user_id order by v.created_at)
                       from public.poll_votes v
                      where v.poll_option_id = po.id
                   ), '[]'::jsonb)
                 end
               )
               order by po.position
             )
        from public.poll_options po
        left join public.poll_results(p.id) r on r.option_id = po.id
       where po.poll_id = p.id
    ), '[]'::jsonb) as options,
    coalesce((
      select array_agg(v.poll_option_id order by v.created_at)
        from public.poll_votes v
        join public.poll_options po on po.id = v.poll_option_id
       where po.poll_id = p.id
         and v.user_id = auth.uid()
    ), '{}'::uuid[]) as my_option_ids,
    coalesce(public.poll_voter_count(p.id), 0) as voter_count
  from public.polls p
  where p.id = any(p_poll_ids)
  order by p.created_at desc;
$$;

revoke execute on function public.feed_polls_with_details(uuid[]) from public, anon;
grant execute on function public.feed_polls_with_details(uuid[]) to authenticated;

-- ---------------------------------------------------------------
-- 2. Tellers per vondst — emoji, duwen en reacties in één vraag
-- ---------------------------------------------------------------
-- Telt precies de rijen die de app eerder zelf ophaalde en telde: de
-- policies op `post_reactions`, `post_boosts` en `entity_comments` lopen
-- via "mag je de post zien", en invoker houdt die in stand. Het verschil
-- is alleen dat de rijen niet meer over de lijn gaan (en dat de tellers
-- niet meer stilletjes stoppen bij de rijlimiet van PostgREST).
--
-- De twee venstergrenzen komen van de app (RECENT_WINDOW_MS en
-- MONTH_WINDOW_MS in lib/api/posts.ts), zodat er één plek blijft waar ze
-- staan.
create or replace function public.post_counts(
  p_post_ids uuid[],
  p_recent_since timestamptz,
  p_month_since timestamptz
)
returns table (
  post_id uuid,
  reactions integer,
  recent_reactions integer,
  month_reactions integer,
  boosts integer,
  recent_boosts integer,
  month_boosts integer,
  comments integer,
  recent_comments integer,
  month_comments integer
)
language sql
stable
security invoker
set search_path = public
as $$
  with r as (
    select pr.post_id,
           count(*)::int as n,
           (count(*) filter (where pr.created_at >= p_recent_since))::int as recent,
           (count(*) filter (where pr.created_at >= p_month_since))::int as month
      from public.post_reactions pr
     where pr.post_id = any(p_post_ids)
     group by pr.post_id
  ), b as (
    select pb.post_id,
           count(*)::int as n,
           (count(*) filter (where pb.created_at >= p_recent_since))::int as recent,
           (count(*) filter (where pb.created_at >= p_month_since))::int as month
      from public.post_boosts pb
     where pb.post_id = any(p_post_ids)
     group by pb.post_id
  ), c as (
    select ec.entity_id as post_id,
           count(*)::int as n,
           (count(*) filter (where ec.created_at >= p_recent_since))::int as recent,
           (count(*) filter (where ec.created_at >= p_month_since))::int as month
      from public.entity_comments ec
     where ec.entity_type = 'post'
       and ec.entity_id = any(p_post_ids)
     group by ec.entity_id
  )
  select ids.id,
         coalesce(r.n, 0), coalesce(r.recent, 0), coalesce(r.month, 0),
         coalesce(b.n, 0), coalesce(b.recent, 0), coalesce(b.month, 0),
         coalesce(c.n, 0), coalesce(c.recent, 0), coalesce(c.month, 0)
    from (select distinct unnest(p_post_ids) as id) ids
    left join r on r.post_id = ids.id
    left join b on b.post_id = ids.id
    left join c on c.post_id = ids.id
   where r.post_id is not null or b.post_id is not null or c.post_id is not null;
$$;

revoke execute on function public.post_counts(uuid[], timestamptz, timestamptz) from public, anon;
grant execute on function public.post_counts(uuid[], timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------
-- 3. Zoeken op gebruikersnaam
-- ---------------------------------------------------------------
-- `profiles_username_idx` staat op lower(username) met de gewone collatie,
-- en daar kan een prefix-LIKE geen gebruik van maken. Deze wel — zodra de
-- zoekvraag `lower(username) like 'abc%'` is. De app vraagt nu nog met
-- `ilike` (lib/api/profiles.ts), en PostgREST kan geen filter op een
-- expressie uitdrukken; overstappen kan pas via een RPC. Bij zeven
-- profielen maakt het niets uit, dus dat wacht tot het ertoe doet.
create index if not exists profiles_username_lower_idx
  on public.profiles (lower(username) text_pattern_ops);
