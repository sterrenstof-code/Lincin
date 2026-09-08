-- ===============================================================
-- 0057 — een clip of een kleur telt ook als inhoud
-- ===============================================================
--
-- `posts_has_content` (0013, verruimd in 0042) eist dat er een foto, een
-- link, een onderschrift of een stuk tekst in de rij staat. Sindsdien zijn
-- er twee soorten inhoud bijgekomen die de check niet kent:
--
--   video_path   0055 — een geüploade clip
--   swatch_hex   0056 — een kleur, en verder niets
--
-- De app laat beide toe: `createFind` in lib/api/posts.ts rekent ze mee
-- als inhoud. De database niet, en dus kreeg wie een clip zonder foto en
-- zonder tekst plaatste een fout uit Postgres:
--
--   23514 new row for relation "posts" violates check constraint
--   "posts_has_content"
--
-- De vondst was dan al geüpload naar storage — het bestand stond er, de
-- rij niet. Dat is precies het soort verschil tussen wat de app toestaat
-- en wat de database toestaat dat vanzelf blijft bestaan tot iemand het
-- tegenkomt.
--
-- `not valid` zoals zijn voorgangers: de check geldt voor nieuwe rijen en
-- laat wat er staat met rust.

alter table public.posts drop constraint if exists posts_has_content;
alter table public.posts
  add constraint posts_has_content
  check (
    image_path is not null
    or video_path is not null
    or link_url is not null
    or swatch_hex is not null
    or coalesce(char_length(trim(caption)), 0) > 0
    or coalesce(char_length(trim(body_text)), 0) > 0
  )
  not valid;

comment on constraint posts_has_content on public.posts is
  'Een vondst moet iets zijn: beeld, een clip, een link, een kleur, een onderschrift of tekst.';

notify pgrst, 'reload schema';
