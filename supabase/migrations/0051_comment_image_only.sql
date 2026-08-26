-- 0051_comment_image_only.sql
--
-- Een reactie mag uit alleen een beeld bestaan.
--
-- ---------------------------------------------------------------
-- WAT ER MISGING
-- ---------------------------------------------------------------
-- 0038 maakte `entity_comments` met:
--
--     body text not null check (char_length(body) between 1 and 500)
--
-- Volkomen redelijk: een reactie zonder tekst was toen een lege reactie.
--
-- 0046 gaf reacties een `image_path`, zodat je een gif of een meme kon
-- meesturen. Maar die eis van minstens één teken bleef staan. Een reactie
-- die alleen uit een gif bestaat heeft geen tekst, en botste dus tegen een
-- regel uit een tijd waarin beelden nog niet bestonden:
--
--     new row for relation "entity_comments" violates check constraint
--     "entity_comments_body_check"
--
-- Dat is het soort fout dat blijft liggen omdat de constraint zélf nog
-- klopt met wat hij ooit moest bewaken — alleen niet meer met wat een
-- reactie inmiddels is.
--
-- ---------------------------------------------------------------
-- DE NIEUWE REGEL
-- ---------------------------------------------------------------
-- Twee eisen die los van elkaar staan, in plaats van één die ze door
-- elkaar haalde:
--
--   1. tekst is nooit langer dan 500 tekens — ook niet naast een beeld
--   2. er staat iets in: tekst óf een beeld
--
-- `body` blijft `not null`. De app stuurt bij een reactie zonder tekst een
-- lege string en geen null, en een kolom die zowel "" als null kan zijn
-- levert twee manieren op om hetzelfde te zeggen.

alter table public.entity_comments
  drop constraint if exists entity_comments_body_check;

alter table public.entity_comments
  drop constraint if exists entity_comments_has_content;

alter table public.entity_comments
  add constraint entity_comments_has_content
  check (
    char_length(body) <= 500
    and (char_length(body) >= 1 or image_path is not null)
  );

comment on constraint entity_comments_has_content on public.entity_comments is
  'Tekst hoogstens 500 tekens, en er staat iets in: tekst of een beeld.';
