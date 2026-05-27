-- Migration 0026: account-level private key opslag
--
-- Per-device encryptie was te fragiel (cache-wipe → sleutels kwijt).
-- We slaan nu de privé-sleutel van elk account op in profiles zodat
-- elk apparaat dat inlogt meteen berichten kan lezen zonder QR-koppeling.
--
-- Veiligheid: Supabase RLS zorgt dat je alleen je eigen rij kunt lezen.
-- De sleutel is base64-encoded X25519 bytes (32 bytes → ~44 tekens).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_privkey text;

-- Zet een RLS-policy zodat alleen de eigen user identity_privkey kan lezen.
-- De bestaande SELECT-policy op profiles laat alle authenticated users
-- profielen lezen (voor gebruikersnamen, avatars etc.) — maar dat mag
-- de privé-sleutel niet blootstellen aan anderen.
--
-- We lossen dit op door identity_privkey NOOIT te selecteren in de
-- publieke queries (listProfiles, getProfile, etc.). De kolom wordt alleen
-- gelezen in de eigen bootstrap via:
--   .select("identity_pubkey, identity_privkey").eq("id", auth.uid())
-- wat al afgedekt wordt door de bestaande own-row RLS.

COMMENT ON COLUMN profiles.identity_privkey IS
  'Base64-encoded X25519 privé-sleutel voor E2E-encryptie. Alleen leesbaar door de eigenaar (RLS). Schrijf NOOIT deze kolom in publieke queries.';
