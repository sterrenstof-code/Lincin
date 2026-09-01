-- Het profiel wordt een moodboard.
--
-- Tot nu toe was je profiel een omgekeerde lijst van wat je in de feed
-- zette: alles wat je deelde, nieuwste eerst, allemaal even groot. Dat is
-- een archief. Een moodboard is iets anders — het is *samengesteld*. Wat
-- er staat is een keuze, waar het staat is een keuze, en hoe groot het is
-- ook.
--
-- Vier kolommen en één bucket, en ze gaan alle vijf over dat verschil.

-- ---------------------------------------------------------------
-- 1. Bewegend beeld
-- ---------------------------------------------------------------
-- Een eigen kolom en geen hergebruik van `image_path`.
--
-- Dat scheelt een discussie die anders elke keer terugkomt: `kind = 'video'`
-- bestaat al en betekent een *link* naar YouTube of Vimeo. Zou een geüploade
-- clip in `image_path` landen, dan is "heeft deze vondst een video" een
-- vraag die je alleen kunt beantwoorden door naar de bestandsextensie te
-- kijken. Nu is het een kolom die gevuld is of niet.
--
-- `image_path` blijft daarnaast bruikbaar als stilstaand voorblad. Een
-- vondst mag allebei hebben: het plaatje dat je in het raster ziet, en de
-- clip die afspeelt als je hem opent.
alter table public.posts add column if not exists video_path text;

comment on column public.posts.video_path is
  'Pad in de posts-bucket. Naast image_path, dat het voorblad blijft.';

-- ---------------------------------------------------------------
-- 2. Niet alles hoeft de feed in
-- ---------------------------------------------------------------
-- "Wat ik goed vind" en "wat ik aan het rondsturen ben" zijn niet dezelfde
-- verzameling, en tot nu toe waren ze dat wél: élke vondst ging naar de
-- feed van al je lincs. Dat maakt een moodboard onmogelijk — je gaat geen
-- veertig dingen verzamelen als er veertig meldingen uit komen.
--
-- `profile` betekent: hij staat op je bord, en wie je bord bezoekt ziet
-- hem. Het is dus geen privé-vlag maar een *stilte*-vlag: niet verstopt,
-- alleen niet rondgestuurd. Verstoppen zou een derde waarde zijn, en die
-- is er bewust niet — voor iets dat niemand mag zien is een app voor je
-- vriendengroep de verkeerde plek.
--
-- De RLS op `posts` blijft ongemoeid: wie de vondst mocht zien, mag hem nog
-- steeds zien. Dit stuurt alleen wat de féédquery ophaalt, en dat is een
-- keuze van de app en niet van de beveiliging.
alter table public.posts
  add column if not exists visibility text not null default 'feed';

alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check
  check (visibility in ('feed', 'profile'));

create index if not exists posts_visibility_idx
  on public.posts (visibility, created_at desc);

-- ---------------------------------------------------------------
-- 3. Een paar dingen bovenaan
-- ---------------------------------------------------------------
-- Volgorde met de hand slepen is het andere uiterste: dat vraagt een
-- `position` op élke rij, een herberekening bij elke verplaatsing, en op
-- een aanraakscherm vecht slepen met scrollen. Voor een bord van enkele
-- tientallen is dat veel machinerie voor weinig.
--
-- Vastprikken doet het werk dat telt. Je wil niet je hele bord ordenen —
-- je wil dat de drie dingen waar het nu om gaat bovenaan staan, en dat de
-- rest eronder op tijd blijft staan. Eén tijdstempel doet dat: gevuld is
-- vastgeprikt, en de laatst vastgeprikte staat vooraan.
alter table public.posts add column if not exists pinned_at timestamptz;

create index if not exists posts_pinned_idx
  on public.posts (user_id, pinned_at desc nulls last, created_at desc);

-- ---------------------------------------------------------------
-- 4. Hoe groot een tegel is
-- ---------------------------------------------------------------
-- Vier vormen, en niet meer. Een moodboard leest als samengesteld doordat
-- de dingen verschillen in maat; het valt uit elkaar zodra elk ding zijn
-- eigen maat heeft. Vier is genoeg voor ritme en weinig genoeg om een
-- raster te blijven — dezelfde afweging als de twee beeldverhoudingen van
-- de tegel in de feed (zie `GridTile` in components/FindBody.tsx).
--
-- Opgeslagen als tekst en niet als twee getallen, omdat het een keuze uit
-- een lijst is en geen maatvoering: '3x3' hoort niet te kunnen bestaan
-- doordat iemand twee kolommen apart zet.
alter table public.posts
  add column if not exists tile_span text not null default '1x1';

alter table public.posts drop constraint if exists posts_tile_span_check;
alter table public.posts add constraint posts_tile_span_check
  check (tile_span in ('1x1', '2x1', '1x2', '2x2'));

comment on column public.posts.tile_span is
  'Maat op het moodboard: breedte x hoogte in rastercellen.';

-- ---------------------------------------------------------------
-- 5. De bucket moet bewegend beeld aankunnen
-- ---------------------------------------------------------------
-- `posts` stond op 10 MB en alleen stilstaand beeld (0003, hersteld in
-- 0024). Een clip van tien seconden van een telefoon haalt dat niet, dus
-- zonder deze regel mislukt élke video-upload op de bucket in plaats van
-- in de app — en dat is een fout die je pas ziet nadat je hem gekozen hebt.
--
-- Vijftig megabyte is geen rond getal maar een grens: genoeg voor een
-- korte clip in telefoonkwaliteit, te weinig om een film te bewaren. Dit
-- is een moodboard, geen archief.
update storage.buckets
set
  file_size_limit = 50 * 1024 * 1024,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
where id = 'posts';
