import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";

import { Button, Field, Note, Section, SubPage } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import { safeBack } from "@/lib/nav";
import { contributeToEvent, type EventWithMeta } from "@/lib/api/events";
import { hueFor } from "@/lib/design/theme";
import { usePageTitle } from "@/lib/page-title";

/**
 * Een link toevoegen aan een event, in de vorm van het thema
 * (components/lincin/SubPage).
 *
 * De kleur van de pagina is die van de gastheer, net als op de
 * eventpagina. Het event staat meestal al in de cache (je komt hier
 * vandaan); via een deep-link valt hij terug op de kleur van het event.
 */
export default function EventLinkComposeScreen() {
  usePageTitle("Event delen");
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id!;

  const [link, setLink] = useState("");
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = !submitting && link.trim().length > 0;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await contributeToEvent({
        eventId,
        userId: myUserId,
        linkUrl: link.trim(),
        caption: caption.trim() || null,
      });
      await qc.invalidateQueries({ queryKey: ["event-contributions", eventId] });
      await qc.invalidateQueries({ queryKey: ["event", eventId] });
      safeBack(router, `/event/${eventId}`);
    } catch (e: any) {
      setError(e?.message ?? "Kon link niet toevoegen.");
    } finally {
      setSubmitting(false);
    }
  }

  const host = qc.getQueryData<EventWithMeta | null>(["event", eventId])?.host_user_id;

  return (
    <SubPage
      title="Voeg link toe"
      kicker="Event"
      back={`/event/${eventId}`}
      tab="events"
      hue={hueFor(host ?? eventId)}
      keyboard
    >
      <Section pad>
        <Field
          label="Link"
          value={link}
          onChangeText={setLink}
          placeholder="https://…"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Field
          label="Bijschrift (optioneel)"
          value={caption}
          onChangeText={setCaption}
          placeholder="Wat is dit?"
          multiline
          maxLength={300}
          style={{ minHeight: 60 }}
        />
      </Section>

      {error ? <Note tone="red">{error}</Note> : null}

      <Button
        label={submitting ? "Bezig…" : "Plaats"}
        icon="link"
        tone="primary"
        busy={submitting}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </SubPage>
  );
}
