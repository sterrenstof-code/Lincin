-- Backfill: verplaats bestaande post-reacties van de oude `comments` tabel
-- naar de universele `entity_comments` tabel.
--
-- Achtergrond: posts gebruikten oorspronkelijk de `comments` tabel (0007).
-- Sinds 0038 tonen de feed-kaarten reacties uit `entity_comments`, maar de
-- post-detailpagina + het reactie-aantal lazen nog uit `comments`. Daardoor
-- klopte het aantal niet en verschenen niet alle reacties. De app schrijft nu
-- overal naar `entity_comments`; deze migratie zorgt dat historische reacties
-- niet verdwijnen.
--
-- Idempotent: dubbele rijen worden vermeden via NOT EXISTS op
-- (entity_id, user_id, body, created_at).

insert into public.entity_comments (entity_type, entity_id, user_id, body, created_at)
select 'post', c.post_id, c.user_id, c.body, c.created_at
from public.comments c
where not exists (
  select 1 from public.entity_comments ec
  where ec.entity_type = 'post'
    and ec.entity_id = c.post_id
    and ec.user_id = c.user_id
    and ec.body = c.body
    and ec.created_at = c.created_at
);

notify pgrst, 'reload schema';
