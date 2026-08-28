-- ---------------------------------------------------------------
-- 0053 — je eigen vondst mag je bijwerken
-- ---------------------------------------------------------------
--
-- `posts` had een policy voor lezen, plaatsen en verwijderen, maar niet
-- voor bijwerken. Row level security weigert dan élke update, en PostgREST
-- geeft daar geen fout voor terug: een update die niets raakt is geen fout,
-- het zijn nul rijen. De app deed dus alsof het gelukt was.
--
-- Dat was al zo sinds `updatePostCaption` bestaat — het snelle
-- "toelichting bewerken" in de feed deed in de praktijk niets. Nu de
-- detailpagina een volwaardig bewerkscherm krijgt, hoort het slot eraf.
--
-- `using` bepaalt welke rijen je mag aanraken, `with check` wat er ná de
-- wijziging nog moet gelden. Allebei nodig: zonder de tweede kun je je
-- eigen vondst op naam van iemand anders zetten en hem daarmee uit je
-- eigen handen schrijven.

drop policy if exists "update your own posts" on public.posts;

create policy "update your own posts"
  on public.posts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
