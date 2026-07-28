-- 0042_feed_finds.sql
--
-- Feed-upgrade: van "posts" naar **vondsten**.
--
-- De feed is niet langer een fotostroom maar een gedeeld commonplace book:
-- links, video's, muziek, fragmenten uit boeken, weetjes en ideeën die
-- iemand uit de wereld meebrengt naar de kring. Een vondst heeft daarom
-- een *bron* (wie/wat) naast de *deler* (wie het meebracht).
--
-- Ontwerpkeuze: de unfurl-metadata wordt bij het plaatsen als momentopname
-- in `posts.meta` geschreven, niet bij het lezen opgehaald. Dat geeft drie
-- dingen: geen N+1 fetches in de feed, geen extra RLS-oppervlak, en een
-- vondst behoudt de titel die ze had toen ze gedeeld werd — ook als de
-- pagina later verdwijnt. `link_previews` is puur een server-side cache.
--
-- Achterwaarts compatibel: bestaande rijen krijgen automatisch het juiste
-- `kind` via de backfill onderaan. Bestaande queries blijven werken.

-- ---------------------------------------------------------------
-- 1. posts — nieuwe kolommen
-- ---------------------------------------------------------------

alter table public.posts
  add column if not exists kind          text not null default 'note',
  add column if not exists source_title  text,
  add column if not exists source_author text,
  add column if not exists body_text     text,
  add column if not exists tags          text[] not null default '{}',
  add column if not exists meta          jsonb  not null default '{}'::jsonb;

comment on column public.posts.kind is
  'note | image | link | video | music | fragment | fact | idea';
comment on column public.posts.source_title is
  'Titel van de bron: boektitel, artikelkop, albumnaam.';
comment on column public.posts.source_author is
  'Auteur van de bron — NIET de deler. Schrijver, artiest, maker.';
comment on column public.posts.body_text is
  'Het citaat/fragment zelf. Los van `caption`, die de toelichting van de deler is.';
comment on column public.posts.meta is
  'Momentopname van de unfurl-metadata (provider, embed_url, image_url, duration_s, …).';

-- `link_url` blijft de canonieke URL-kolom voor álle link-achtige soorten.
-- Een boekfragment heeft geen URL, wel source_title + source_author.

-- ---------------------------------------------------------------
-- 2. Constraints
-- ---------------------------------------------------------------

alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts
  add constraint posts_kind_check
  check (kind in ('note', 'image', 'link', 'video', 'music', 'fragment', 'fact', 'idea'));

-- Een fragment kan enkel body_text hebben (geen caption/foto/link),
-- dus de bestaande content-check moet verruimd worden.
alter table public.posts drop constraint if exists posts_has_content;
alter table public.posts
  add constraint posts_has_content
  check (
    image_path is not null
    or link_url is not null
    or coalesce(char_length(trim(caption)), 0) > 0
    or coalesce(char_length(trim(body_text)), 0) > 0
  )
  not valid;

-- Rem op ongelimiteerde tags: max 6 stuks, samen max 200 tekens.
-- (Een CHECK mag geen subquery bevatten, dus geen per-element lengtecheck
--  hier — `normalizeTags` in lib/api/posts.ts kapt elke tag af op 24.)
alter table public.posts drop constraint if exists posts_tags_sane;
alter table public.posts
  add constraint posts_tags_sane
  check (
    cardinality(tags) <= 6
    and char_length(array_to_string(tags, ',')) <= 200
  )
  not valid;

-- ---------------------------------------------------------------
-- 3. Indexen
-- ---------------------------------------------------------------

create index if not exists posts_tags_idx
  on public.posts using gin (tags);

create index if not exists posts_kind_created_idx
  on public.posts (kind, created_at desc);

-- ---------------------------------------------------------------
-- 4. link_previews — server-side unfurl cache
-- ---------------------------------------------------------------
--
-- Bewust GEEN client-toegang: RLS staat aan zonder policies, dus enkel de
-- service role (de `unfurl` edge function) kan lezen/schrijven. De client
-- krijgt metadata altijd via de edge function, nooit rechtstreeks uit deze
-- tabel — anders zou elke gebruiker kunnen uitlezen welke URL's de hele
-- app ooit gedeeld heeft.

create table if not exists public.link_previews (
  url_hash      text primary key,             -- sha256 van de genormaliseerde URL
  url           text not null,
  canonical_url text,
  provider      text,                         -- youtube | vimeo | spotify | bandcamp | soundcloud | applemusic | github | generic
  kind          text not null default 'link', -- link | video | music
  title         text,
  description   text,
  image_url     text,
  site_name     text,
  author        text,
  embed_url     text,                         -- iframe-bare speler-URL
  duration_s    integer,
  favicon_url   text,
  word_count    integer,                      -- ruwe schatting → leestijd
  error         text,                         -- laatste faalreden (negative caching)
  fetched_at    timestamptz not null default now()
);

create index if not exists link_previews_fetched_idx
  on public.link_previews (fetched_at desc);

alter table public.link_previews enable row level security;
-- (geen policies — enkel service role)

-- ---------------------------------------------------------------
-- 5. Backfill bestaande rijen
-- ---------------------------------------------------------------

update public.posts
   set kind = case
     when link_url  is not null then 'link'
     when image_path is not null then 'image'
     else 'note'
   end
 where kind = 'note';

notify pgrst, 'reload schema';
