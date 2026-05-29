-- Migratie 0027: Atomische JSONB-merge RPC + RLS policy voor re-keying
--
-- Wanneer een nieuw lid aan een groepschat wordt toegevoegd, moet de toevoegende
-- gebruiker de bestaande berichten opnieuw versleutelen voor dat lid. Deze migratie
-- voegt de benodigde database-infrastructuur toe.

-- ─── 1. RPC-functie: voeg één envelope toe aan recipient_payloads ─────────────
--
-- Gebruikt JSONB || operator voor atomische merge: bestaande enveloppen blijven
-- intact, alleen de nieuwe user_id-sleutel wordt toegevoegd.
-- SECURITY DEFINER zodat de functie de RLS van de messages-tabel kan omzeilen,
-- maar de ingebouwde WHERE-clause zorgt dat alleen leden van de chat kunnen updaten.

CREATE OR REPLACE FUNCTION add_recipient_payload(
  p_message_id uuid,
  p_user_id     text,
  p_payload     jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE messages
  SET recipient_payloads = recipient_payloads || jsonb_build_object(p_user_id, p_payload)
  WHERE id = p_message_id
    AND chat_id IN (
      SELECT chat_id
      FROM   chat_members
      WHERE  user_id = auth.uid()
    );
$$;

-- Alleen ingelogde gebruikers mogen de functie aanroepen.
REVOKE ALL ON FUNCTION add_recipient_payload(uuid, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION add_recipient_payload(uuid, text, jsonb) TO authenticated;

-- ─── 2. (Optioneel) directe UPDATE-policy voor chat_members ──────────────────
--
-- De SECURITY DEFINER RPC hierboven omzeilt al RLS, maar als je ook directe
-- Supabase-client updates wil toestaan kun je deze policy activeren door het
-- commentaar te verwijderen.
--
-- CREATE POLICY "chat_members kunnen recipient_payloads uitbreiden"
--   ON messages
--   FOR UPDATE
--   USING (
--     chat_id IN (
--       SELECT chat_id FROM chat_members WHERE user_id = auth.uid()
--     )
--   )
--   WITH CHECK (true);
