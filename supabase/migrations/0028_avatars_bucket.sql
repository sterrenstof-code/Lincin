-- Migratie 0028: publieke avatars-bucket + RLS
-- Avatars zijn publiek leesbaar (geen signed URLs nodig).
-- Schrijven mag alleen naar de eigen user_id-map.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,                          -- publiek leesbaar
  2097152,                       -- max 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Lezen: iedereen mag avatars bekijken
CREATE POLICY "Avatars publiek leesbaar"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Schrijven: alleen naar eigen map ({user_id}/avatar.*)
CREATE POLICY "Gebruiker mag eigen avatar uploaden"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Gebruiker mag eigen avatar overschrijven"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
