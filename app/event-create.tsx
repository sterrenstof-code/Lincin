import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { createEvent, type EventRevealMode } from "@/lib/api/events";

function plusHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

function toLocalISO(date: Date): string {
  // yyyy-mm-ddThh:mm formaat voor <input type="datetime-local">
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EventCreateScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const defaultStart = plusHours(new Date(), 1);
  const defaultEnd = plusHours(new Date(), 5);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState(toLocalISO(defaultStart));
  const [endsAt, setEndsAt] = useState(toLocalISO(defaultEnd));
  const [reveal, setReveal] = useState<EventRevealMode>("after");
  const [delayHours, setDelayHours] = useState("24");
  const [maxGuests, setMaxGuests] = useState("100");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const canSubmit = !submitting && trimmedName.length > 0 && startsAt && endsAt;

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const start = new Date(startsAt);
      const end = new Date(endsAt);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new Error("Ongeldige datum. Formaat: 2025-12-31T18:00");
      }
      if (end <= start) {
        throw new Error("Eindtijd moet na starttijd liggen.");
      }
      const ev = await createEvent({
        hostUserId: myUserId,
        name: trimmedName,
        description: description || null,
        startsAt: start,
        endsAt: end,
        reveal,
        revealDelayHours: reveal === "delayed" ? parseInt(delayHours, 10) || 24 : 0,
        maxGuests: Math.max(1, Math.min(1000, parseInt(maxGuests, 10) || 100)),
      });
      await qc.invalidateQueries({ queryKey: ["events", myUserId] });
      router.replace(`/event/${ev.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Kon event niet aanmaken.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top", "left", "right"]}>
      <ScreenContainer>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
          >
            <Ionicons name="close" color="#1A1714" size={20} />
          </Pressable>
          <Text className="flex-1 text-cream text-lg font-semibold ml-3">
            Nieuw event
          </Text>
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            className={`rounded-full px-4 py-2 ${
              canSubmit ? "bg-cream active:bg-cream-soft" : "bg-shell-soft"
            }`}
          >
            <Text className={`font-semibold ${canSubmit ? "text-ink" : "text-cream-muted"}`}>
              {submitting ? "Bezig…" : "Maak"}
            </Text>
          </Pressable>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <View className="bg-paper rounded-3xl p-6">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Naam
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="bv. Paris 2025, Tom's verjaardag…"
                placeholderTextColor="#8A7E6C"
                maxLength={80}
                className="bg-paper-light text-ink text-base px-5 py-3 rounded-full border border-line-paper"
              />

              <View className="h-5" />

              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Beschrijving (optioneel)
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Een paar lijnen over je event"
                placeholderTextColor="#8A7E6C"
                multiline
                maxLength={500}
                className="bg-paper-light text-ink text-base px-4 py-3 rounded-2xl border border-line-paper"
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </View>

            {/* Datum en tijd */}
            <View className="bg-paper rounded-3xl p-6 mt-4">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Start
              </Text>
              <DateInput value={startsAt} onChange={setStartsAt} />

              <View className="h-5" />

              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Einde
              </Text>
              <DateInput value={endsAt} onChange={setEndsAt} />
            </View>

            {/* Onthulling */}
            <View className="bg-paper rounded-3xl p-6 mt-4">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
                Foto's zichtbaar
              </Text>
              <Text className="text-ink-soft text-sm mb-3">
                Wanneer mogen gasten elkaars bijdragen zien?
              </Text>
              <View className="gap-2">
                <RevealOption
                  active={reveal === "during"}
                  onPress={() => setReveal("during")}
                  title="Tijdens het event"
                  subtitle="Iedereen ziet alles realtime"
                />
                <RevealOption
                  active={reveal === "after"}
                  onPress={() => setReveal("after")}
                  title="Na het event"
                  subtitle="Surprise-onthulling op het eind"
                />
                <RevealOption
                  active={reveal === "delayed"}
                  onPress={() => setReveal("delayed")}
                  title="Na vertraging"
                  subtitle="X uur na het einde"
                />
              </View>

              {reveal === "delayed" && (
                <View className="mt-4">
                  <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                    Vertraging (uren)
                  </Text>
                  <TextInput
                    value={delayHours}
                    onChangeText={setDelayHours}
                    keyboardType="number-pad"
                    className="bg-paper-light text-ink text-base px-5 py-3 rounded-full border border-line-paper"
                  />
                </View>
              )}
            </View>

            {/* Aantal gasten */}
            <View className="bg-paper rounded-3xl p-6 mt-4">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Aantal gasten (max)
              </Text>
              <TextInput
                value={maxGuests}
                onChangeText={setMaxGuests}
                keyboardType="number-pad"
                className="bg-paper-light text-ink text-base px-5 py-3 rounded-full border border-line-paper"
              />
              <Text className="text-ink-muted text-xs mt-2">
                1–1000. Iedereen kan via een gedeelde link of QR meedoen tot deze limiet.
              </Text>
            </View>

            {error && (
              <View className="bg-red-100 border border-red-300 rounded-2xl px-4 py-3 mt-4">
                <Text className="text-red-800 text-sm">{error}</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}

/** Cross-platform datetime input. Op web: native HTML datetime-local. Op native: text. */
function DateInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  if (Platform.OS === "web") {
    // Render een HTML5 datetime-local input via createElement zodat we niet
    // tegen react-native-web's TextInput sanitizers oplopen.
    return (
      <View
        // @ts-ignore — web-only style
        style={{ display: "flex" }}
      >
        {require("react").createElement("input", {
          type: "datetime-local",
          value,
          onChange: (e: any) => onChange(e.target.value),
          style: {
            backgroundColor: "#F5EFE2",
            color: "#1A1714",
            border: "1px solid #D8C29B",
            borderRadius: 999,
            padding: "12px 20px",
            fontSize: 16,
            fontFamily: "inherit",
            outline: "none",
            width: "100%",
            boxSizing: "border-box",
          },
        })}
      </View>
    );
  }
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="yyyy-mm-ddThh:mm"
      placeholderTextColor="#8A7E6C"
      autoCapitalize="none"
      autoCorrect={false}
      className="bg-paper-light text-ink text-base px-5 py-3 rounded-full border border-line-paper"
    />
  );
}

function RevealOption({
  active,
  onPress,
  title,
  subtitle,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center rounded-2xl px-4 py-3 ${
        active ? "bg-ink" : "bg-paper-soft active:bg-paper-warm"
      }`}
    >
      <Ionicons
        name={active ? "radio-button-on" : "radio-button-off"}
        color={active ? "#F5E8D3" : "#5A4F40"}
        size={20}
      />
      <View className="flex-1 ml-3">
        <Text className={`font-semibold ${active ? "text-cream" : "text-ink"}`}>
          {title}
        </Text>
        <Text className={`text-xs mt-0.5 ${active ? "text-cream-soft" : "text-ink-muted"}`}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}
