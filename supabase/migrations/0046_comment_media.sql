-- Een gif of een meme als reactie.
--
-- Reageren met beeld is geen ander soort reactie: zelfde tabel, zelfde
-- draad, zelfde meldingen. Alleen kan er nu een afbeelding aan hangen, en
-- mag de tekst leeg blijven — een gif zegt vaak genoeg.
alter table public.entity_comments add column if not exists image_path text;

-- Gifs mochten de bucket niet in. Zonder deze regel is de rest van deze
-- functie zinloos: elke upload van een gif werd geweigerd op mime-type.
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif'
]
where id = 'posts';
