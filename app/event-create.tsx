import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
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
import {
  createEvent,
  type EventJoinPolicy,
  type EventRevealMode,
} from "@/lib/api/events";
import { feed } from "@/lib/design/type";
import { safeBack } from "@/lib/nav";

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
  // Gesloten is de standaard: een event dat per ongeluk open staat kost je
  // gasten die je niet uitgenodigd hebt, en dat kan je achteraf niet meer
  // ongedaan maken.
  const [joinPolicy, setJoinPolicy] = useState<EventJoinPolicy>("closed");
  const [delayHours, setDelayHours] = useState("24");
  const [maxGuests, setMaxGuests] = useState("100");
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [coverMime, setCoverMime] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickCover() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Geen toegang tot je foto's. Geef Lincin permissie in je systeeminstellingen.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      allowsEditing: true,
      aspect: [16, 9],
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    setCoverUri(result.assets[0].uri);
    setCoverMime(result.assets[0].mimeType ?? "image/jpeg");
  }

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
        joinPolicy,
        revealDelayHours: reveal === "delayed" ? parseInt(delayHours, 10) || 24 : 0,
        maxGuests: Math.max(1, Math.min(1000, parseInt(maxGuests, 10) || 100)),
        coverUri,
        coverMimeType: coverMime,
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
            onPress={() => safeBack(router, "/(app)/events")}
            className="w-9 h-9 bg-paper-soft items-center justify-center"
          >
            <Ionicons name="close" color={feed.ink} size={20} />
          </Pressable>
          <Text className="flex-1 text-cream text-lg font-semibold ml-3">
            Nieuw event
          </Text>
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            className={` px-4 py-2 ${
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
            <View className="bg-paper p-6">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Naam
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="bv. Paris 2025, Tom's verjaardag…"
                placeholderTextColor={feed.inkDim}
                maxLength={80}
                className="bg-paper-light text-ink text-base px-5 py-3 border border-line-paper"
              />

              <View className="h-5" />

              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Beschrijving (optioneel)
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Een paar lijnen over je event"
                placeholderTextColor={feed.inkDim}
                multiline
                maxLength={500}
                className="bg-paper-light text-ink text-base px-4 py-3 border border-line-paper"
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </View>

            {/* Cover (optioneel) */}
            <View className="bg-paper p-6 mt-4">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Cover (optioneel)
              </Text>
              {coverUri ? (
                <View>
                  <Image
                    source={{ uri: coverUri }}
                    style={{ width: "100%", height: 150, borderRadius: 18 }}
                    contentFit="cover"
                  />
                  <View className="flex-row gap-2 mt-3">
                    <Pressable
                      onPress={pickCover}
                      className="flex-1 border border-line-paper py-2.5 items-center"
                    >
                      <Text className="text-ink font-semibold text-sm">Vervang</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setCoverUri(null); setCoverMime(null); }}
                      className="flex-1 border border-line-paper py-2.5 items-center"
                    >
                      <Text className="text-ink font-semibold text-sm">Verwijder</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <Pressable
                  onPress={pickCover}
                  className="bg-paper-soft active:bg-paper-warm py-8 items-center justify-center border border-line-paper"
                >
                  <Ionicons name="image-outline" color={feed.inkDim} size={26} />
                  <Text className="text-ink-soft text-sm mt-2">Kies een cover-foto</Text>
                </Pressable>
              )}
            </View>

            {/* Datum en tijd */}
            <View className="bg-paper p-6 mt-4">
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

            {/* Toegang — open of gesloten groep */}
            <View className="bg-paper p-6 mt-4">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
                Wie mag meedoen
              </Text>
              <Text className="text-ink-soft text-sm mb-3">
                De link en QR blijven in beide gevallen deelbaar. Het verschil is
                wat er gebeurt wanneer iemand erop tikt.
              </Text>
              <View className="gap-2">
                <ChoiceOption
                  active={joinPolicy === "closed"}
                  onPress={() => setJoinPolicy("closed")}
                  title="Gesloten groep"
                  subtitle="Jij keurt elk verzoek goed — geen ongenode gasten"
                />
                <ChoiceOption
                  active={joinPolicy === "open"}
                  onPress={() => setJoinPolicy("open")}
                  title="Open groep"
                  subtitle="Iedereen met de link komt meteen binnen"
                />
              </View>
            </View>

            {/* Onthulling */}
            <View className="bg-paper p-6 mt-4">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
                Foto's zichtbaar
              </Text>
              <Text className="text-ink-soft text-sm mb-3">
                Wanneer mogen gasten elkaars bijdragen zien?
              </Text>
              <View className="gap-2">
                <ChoiceOption
                  active={reveal === "during"}
                  onPress={() => setReveal("during")}
                  title="Tijdens het event"
                  subtitle="Iedereen ziet alles realtime"
                />
                <ChoiceOption
                  active={reveal === "after"}
                  onPress={() => setReveal("after")}
                  title="Na het event"
                  subtitle="Surprise-onthulling op het eind"
                />
                <ChoiceOption
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
                    className="bg-paper-light text-ink text-base px-5 py-3 border border-line-paper"
                  />
                </View>
              )}
            </View>

            {/* Aantal gasten */}
            <View className="bg-paper p-6 mt-4">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Aantal gasten (max)
              </Text>
              <TextInput
                value={maxGuests}
                onChangeText={setMaxGuests}
                keyboardType="number-pad"
                className="bg-paper-light text-ink text-base px-5 py-3 border border-line-paper"
              />
              <Text className="text-ink-muted text-xs mt-2">
                {joinPolicy === "closed"
                  ? "1–1000. Ook goedgekeurde verzoeken tellen mee tot deze limiet."
                  : "1–1000. Iedereen kan via een gedeelde link of QR meedoen tot deze limiet."}
              </Text>
            </View>

            {error && (
              <View className="bg-red-100 border border-red-300 px-4 py-3 mt-4">
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
            backgroundColor: feed.panel,
            color: feed.ink,
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
      placeholderTextColor={feed.inkDim}
      autoCapitalize="none"
      autoCorrect={false}
      className="bg-paper-light text-ink text-base px-5 py-3 border border-line-paper"
    />
  );
}

function ChoiceOption({
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
      className={`flex-row items-center px-4 py-3 ${
        active ? "bg-ink" : "bg-paper-soft active:bg-paper-warm"
      }`}
    >
      <Ionicons
        name={active ? "radio-button-on" : "radio-button-off"}
        color={active ? feed.text : feed.inkDim}
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
