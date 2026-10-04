-- Wie komt er, live: een "Ik kom" van een vriend verschijnt meteen op de
-- eventpagina en in de lijst, zonder opnieuw te laden. Realtime volgt de
-- select-policy van 0072 — je ziet alleen antwoorden die je al mocht zien.
-- Een delete draagt de primaire sleutel (event_id, user_id) mee, genoeg om
-- te weten welk event opnieuw moet.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'event_rsvps') then
    alter publication supabase_realtime add table public.event_rsvps;
  end if;
end $$;
