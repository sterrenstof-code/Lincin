import { useState } from "react";
import { Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Field, IconBtn, labelStyle, Note, Section, SubPage } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import { createPoll } from "@/lib/api/polls";
import { createActivityEvent } from "@/lib/api/activity-events";
import { sendMessage } from "@/lib/api/messages";
import { color, friendColor, hueFor, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { safeBack } from "@/lib/nav";
import { useUnsavedGuard } from "@/lib/unsaved";
import { usePageTitle } from "@/lib/page-title";

/**
 * Een nieuwe poll, in de vorm van het thema (components/lincin/SubPage).
 * Vanuit een chat in de kleur van die chat, anders in de feed.
 *
 * Een vraag, twee tot zes opties — elke optie met zijn nummer in de kleur
 * van de pagina — en onderaan Versturen of Plaatsen.
 */

export default function PollComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const { chatId } = useLocalSearchParams<{ chatId?: string }>();
  usePageTitle(chatId ? "Poll in chat" : "Nieuwe stemming");

  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [submitting, setSubmitting] = useState(false);

  /**
   * Weglopen met tekst die nog nergens staat.
   *
   * Er was geen enkele bewaking op verlaten in de hele app, en juist hier
   * doet dat pijn: de tekst bestaat nergens anders dan in dit veld — er is
   * geen concept op de server, want de server ziet alleen ciphertext.
   * Tijdens het versturen staat de bewaking uit, anders houdt hij de
   * navigatie tegen die het versturen zelf veroorzaakt.
   */
  useUnsavedGuard(
    !submitting &&
      (question.trim().length > 0 || options.some((o) => o.trim().length > 0)),
    { message: "Deze poll is nog niet geplaatst. Weggaan betekent dat je hem kwijt bent." }
  );
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !submitting &&
    question.trim().length > 0 &&
    options.filter((o) => o.trim().length > 0).length >= 2;

  function addOption() {
    if (options.length >= 6) return;
    setOptions([...options, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    setOptions(options.map((o, i) => (i === index ? value : o)));
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const poll = await createPoll({
        userId: myUserId,
        question: question.trim(),
        options: options.filter((o) => o.trim().length > 0),
        chatId: chatId ?? null,
      });

      if (chatId) {
        // Gestuurd vanuit een chat — stuur als bericht
        await sendMessage({
          chatId,
          senderId: myUserId,
          poll_id: poll.id,
          text: `📊 ${poll.question}`,
        });
        await qc.invalidateQueries({ queryKey: ["messages", chatId] });
      } else {
        await createActivityEvent({ actorId: myUserId, kind: "post_created", postId: poll.id });
        await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
      }

      safeBack(router, chatId ? `/chat/${chatId}` : "/(app)/feed");
    } catch (e: any) {
      setError(e.message ?? "Er ging iets mis.");
      // Mislukt: pas hier mag de knop weer aan, en de bewaking dus ook.
      setSubmitting(false);
    }
  }

  const hue = hueFor(chatId);

  return (
    <SubPage
      title={chatId ? "Poll in chat" : "Nieuwe stemming"}
      kicker="Poll"
      sub="Een vraag en minstens twee opties."
      back={chatId ? `/chat/${chatId}` : "/(app)/feed"}
      tab={chatId ? "chats" : "feed"}
      hue={hue}
      keyboard
    >
      <Section label="Vraag" pad>
        <Field
          value={question}
          onChangeText={setQuestion}
          placeholder="Stel je vraag…"
          multiline
        />
      </Section>

      <Section
        label={`Opties · ${options.length}`}
        action={options.length < 6 ? { label: "Optie toevoegen", icon: "add", onPress: addOption } : undefined}
        pad
      >
        {options.map((opt, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <OptionNumber n={i + 1} hue={hue} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Field
                value={opt}
                onChangeText={(v) => updateOption(i, v)}
                placeholder={`Optie ${i + 1}`}
              />
            </View>
            {options.length > 2 && (
              <IconBtn icon="close" label="Deze optie verwijderen" onPress={() => removeOption(i)} />
            )}
          </View>
        ))}
      </Section>

      {error ? <Note tone="red">{error}</Note> : null}

      <Button
        label={chatId ? "Versturen" : "Plaatsen"}
        tone="primary"
        icon="stats-chart-outline"
        busy={submitting}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </SubPage>
  );
}

/** Het nummer van een optie, als vlakje in de kleur van de pagina. */
function OptionNumber({ n, hue }: { n: number; hue: Hue }) {
  const spec = useThemeSpec();
  const th = spec.id;
  const fc = friendColor(hue, useScheme());
  return (
    <View
      style={{
        width: 30,
        height: 30,
        borderRadius: th === "kleur" ? 0 : 15,
        borderWidth: th === "kleur" ? spec.border : 0,
        borderColor: color("ink"),
        backgroundColor: fc.fill,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={[labelStyle(th, 10, fc.ink), { letterSpacing: 0 }]}>{n}</Text>
    </View>
  );
}
