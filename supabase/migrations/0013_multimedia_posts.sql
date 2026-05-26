-- Multimedia posts
--
-- Posts kunnen nu drie soorten content hebben (combineerbaar):
--   * image_path  — foto (was verplicht, wordt nu optioneel)
--   * caption     — tekst (al optioneel, nu primair voor text-only posts)
--   * link_url    — externe URL (video, artikel, etc.) — nieuw
--
-- Een post moet minstens één van die drie hebben. We gebruiken NOT VALID
-- om de check enkel toe te passen op nieuwe rijen, oude blijven onaangeroerd.

alter table public.posts
  alter column image_path drop not null;

alter table public.posts
  add column if not exists link_url text;

alter table public.posts
  drop constraint if exists posts_has_content;
alter table public.posts
  add constraint posts_has_content
  check (
    image_path is not null
    or link_url is not null
    or coalesce(char_length(trim(caption)), 0) > 0
  )
  not valid;

notify pgrst, 'reload schema';
