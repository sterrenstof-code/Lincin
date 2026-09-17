-- 0060 — meerkeuze-polls (HANDOFF 2.1 §Poll composer).
--
-- De keuze-editor in Nieuwe bijdrage heeft een schakelaar
-- `één stem per linc` ↔ `meerdere keuzes`. Standaard blijft één stem:
-- elke poll van vóór deze migratie gedraagt zich zoals hij deed.
--
-- De unieke sleutel op poll_votes (poll_option_id, user_id) laat al
-- meerdere stemmen per poll toe — één per keuze. Wat één stem afdwingt
-- is de app (votePoll haalt eerst de vorige weg); die leest nu deze kolom.

alter table public.polls
  add column if not exists allow_multiple boolean not null default false;

comment on column public.polls.allow_multiple is
  'true = een linc mag meerdere keuzes aanvinken; false = één stem per linc.';
