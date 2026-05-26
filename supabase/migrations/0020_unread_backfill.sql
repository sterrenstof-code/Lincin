-- Backfill chat_members.last_read_at = now() voor rijen die nog NULL stonden.
--
-- Tot dusver werd `last_read_at` pas gevuld bij de eerste keer dat je een
-- chat opent ná migratie 0006_unread.sql. Voor chats die al bestonden vóór
-- die migratie bleef de waarde NULL en telde COALESCE(last_read_at, epoch)
-- ALLE historische berichten van anderen mee als "ongelezen" — waardoor de
-- bottom-bar badge eigenlijk het totale berichtenarchief telde.
--
-- Deze backfill resette de teller naar "alles tot nu toe is gelezen". Vanaf
-- nu tellen enkel nieuwe inkomende berichten als ongelezen.

update public.chat_members
   set last_read_at = now()
 where last_read_at is null;

-- Zorg dat we hier nooit opnieuw in trappen: nieuwe chat_members krijgen
-- standaard al `now()` zodat de teller meteen op 0 begint.
alter table public.chat_members
  alter column last_read_at set default now();

notify pgrst, 'reload schema';
