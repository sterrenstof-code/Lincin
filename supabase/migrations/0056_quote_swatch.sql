-- Twee soorten die geen beeld en geen link zijn.
--
-- Een moodboard bestaat niet alleen uit foto's en dingen van elders. Er
-- hangen zinnen aan, en er hangen kleuren aan — en dat waren tot nu toe de
-- twee dingen die je hier níet kwijt kon. Een citaat werd een notitie met
-- een grijs colofon, en een kleur kon helemaal niet.
--
-- Ze zijn allebei bewust een `kind` en geen apart tabel: het blijft een
-- vondst, met dezelfde auteur, dezelfde reacties, dezelfde plek. Alleen
-- wat je ervan ziet verschilt. Dezelfde afweging als bij het album in 0045.

-- ---------------------------------------------------------------
-- 1. De twee nieuwe soorten
-- ---------------------------------------------------------------
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts
  add constraint posts_kind_check
  check (kind in (
    'note', 'image', 'link', 'video', 'music', 'fragment', 'fact', 'idea',
    -- 0056
    'quote', 'swatch'
  ));

-- ---------------------------------------------------------------
-- 2. De kleur van een staal
-- ---------------------------------------------------------------
-- Een eigen kolom en niet in `meta`.
--
-- `meta` is de momentopname van een unfurl — titel, beschrijving, beeld van
-- de bron. Daar hoort geen kleur in die de gebruiker zelf koos: dan is
-- `meta` niet langer "wat de bron over zichzelf zei" maar een zak met van
-- alles, en dat is het soort kolom waar over een jaar niemand meer iets van
-- durft weg te halen.
--
-- De check bewaakt de vorm en niet de smaak: zes hexcijfers met een hekje.
-- Zonder dat komt er ooit `rood` of `rgb(1,2,3)` in te staan en moet élke
-- lezer raden wat hij krijgt.
alter table public.posts add column if not exists swatch_hex text;

alter table public.posts drop constraint if exists posts_swatch_hex_check;
alter table public.posts add constraint posts_swatch_hex_check
  check (swatch_hex is null or swatch_hex ~* '^#[0-9a-f]{6}$');

comment on column public.posts.swatch_hex is
  'Alleen voor kind = swatch. #RRGGBB, kleine of hoofdletters.';

-- ---------------------------------------------------------------
-- 3. Een citaat heeft geen eigen kolom nodig
-- ---------------------------------------------------------------
-- De zin staat in `body_text` en van wie hij is in `source_author` /
-- `source_title` — precies de kolommen die een fragment daar al voor
-- gebruikt. Een `quote_text` ernaast zou hetzelfde ding op twee plekken
-- laten bestaan, en dan is "waar staat de tekst" een vraag met twee
-- antwoorden.
comment on column public.posts.kind is
  'note | image | link | video | music | fragment | fact | idea | quote | swatch';
