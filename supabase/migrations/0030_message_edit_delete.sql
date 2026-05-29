-- Migratie 0030: bewerken en verwijderen van berichten

-- Kolom voor bewerktijdstip
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Verwijderen: alleen eigen berichten
CREATE POLICY "Gebruiker mag eigen berichten verwijderen"
  ON messages FOR DELETE
  USING (sender_id = auth.uid());

-- Bewerken: alleen eigen berichten
CREATE POLICY "Gebruiker mag eigen berichten bewerken"
  ON messages FOR UPDATE
  USING (sender_id = auth.uid());
