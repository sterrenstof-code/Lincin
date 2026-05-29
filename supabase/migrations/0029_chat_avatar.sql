-- Migratie 0029: avatar_url op chats + storage-policies voor groepsavatar
ALTER TABLE chats ADD COLUMN IF NOT EXISTS avatar_url text;

-- Hergebruik de avatars-bucket (aangemaakt in 0028).
-- Groepsavatar-pad: avatars/group/{chat_id}/avatar.*

-- Schrijven: alleen chat-eigenaar mag de groepsavatar uploaden.
CREATE POLICY "Eigenaar mag groepsavatar uploaden"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = 'group' AND
    EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_id = (storage.foldername(name))[2]::uuid
        AND user_id = auth.uid()::text
        AND role = 'owner'
    )
  );

CREATE POLICY "Eigenaar mag groepsavatar overschrijven"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND
    (storage.foldername(name))[1] = 'group' AND
    EXISTS (
      SELECT 1 FROM chat_members
      WHERE chat_id = (storage.foldername(name))[2]::uuid
        AND user_id = auth.uid()::text
        AND role = 'owner'
    )
  );
