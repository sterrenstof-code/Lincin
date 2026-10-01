-- 0078 — de kleur van een poll.
--
-- Bij "Nieuwe bijdrage" kies je een kleur; een post bewaart die in
-- `meta.swatch`, een poll had er geen plek voor. Leeg = de kleur van de
-- maker, zoals voorheen.

alter table public.polls
  add column if not exists swatch text
  check (swatch is null or swatch in ('orange', 'blue', 'ochre', 'green', 'red', 'acid'));
