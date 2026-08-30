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
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useWide } from "@/components/Editorial";
import { useAuth } from "@/lib/auth/provider";
import {
  createEvent,
  type EventJoinPolicy,
  type EventRevealMode,
} from "@/lib/api/events";
import {
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  flameDeep,
  gutter,
  rule,
  sheetWidth,
  space,
} from "@/lib/design/type";
import { safeBack } from "@/lib/nav";

function plusHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

function toLocalISO(date: Date): string {
  // yyyy-mm-ddThh:mm formaat voor <input type="datetime-local">
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}


/**
 * Het formulier op het systeem.
 *
 * Elke groep stond op een gevuld `bg-paper`-vlak met 24 punten rondom —
 * zes zwevende kaartjes onder elkaar op een lavendel pagina. DESIGN.md §4
 * zegt precies het tegenovergestelde: een kaart heeft geen vulling, de
 * opbouw draagt hem. Vandaar hier geen vlakken maar een lijn boven elke
 * groep; dat scheelt ook de vraag hoeveel ruimte er tússen zes vlakken moet.
 *
 * De velden hadden elk een eigen kadertje met een lichte vulling. Eén
 * haarlijn eronder is genoeg om te zeggen "hier typ je": dat is wat de
 * composer al doet, en twee schermen die hetzelfde vragen horen er hetzelfde
 * uit te zien.
 */
const GROUP = {
  borderTopWidth: FEED_BORDER,
  borderTopColor: feed.ink,
  paddingTop: space.lg,
  marginTop: space.xl,
} as const;

/** De eerste groep heeft de kopbalk boven zich en dus geen eigen lijn nodig. */
const GROUP_FIRST = { paddingTop: space.sm } as const;

const FIELD = {
  paddingVertical: 10,
  borderBottomWidth: StyleSheet.hairlineWidth,
  borderBottomColor: rule.soft,
  ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as any) : {}),
};

export default function EventCreateScreen() {
  const router = useRouter();
  const wide = useWide();
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
    <SafeAreaView className="flex-1 bg-desk" edges={["top", "left", "right"]}>
      {/**
        * De kopbalk staat búiten de formulierkolom.
        *
        * Hij zat in `ScreenContainer`, en die kapt op 600 — de kolom waarvan
        * `Sheet` in zijn eigen commentaar zegt dat dit ontwerp ervan af is.
        * Daardoor was de kop op dit scherm 600 breed en overal elders 1250,
        * precies het verspringen dat de kop nergens hoort te doen. Het
        * fórmulier blijft wél smal: invoervelden van 1250 punten lees je niet
        * meer terug.
        */}
      <View
        style={{
          width: "100%",
          maxWidth: sheetWidth(wide),
          alignSelf: "center",
          paddingHorizontal: gutter(wide),
          borderBottomWidth: FEED_BORDER,
          borderBottomColor: feed.ink,
        }}
      >
        <View className="flex-row items-center py-3">
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
            onPress={() => safeBack(router, "/(app)/events")}
            className="w-9 h-9 bg-paper-soft items-center justify-center"
          >
            <Ionicons name="close" color={feed.ink} size={20} />
          </Pressable>
          <Text className="flex-1 text-desk-ink text-lg font-semibold ml-3">
            Nieuw event
          </Text>
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            className={` px-4 py-2 ${
              canSubmit ? "bg-desk-ink active:bg-desk-soft" : "bg-desk-panel"
            }`}
          >
            <Text className={`font-semibold ${canSubmit ? "text-desk" : "text-desk-muted"}`}>
              {submitting ? "Bezig…" : "Maak"}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScreenContainer>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
            <View style={GROUP_FIRST}>
              <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 8 }]}>
                Naam
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="bv. Paris 2025, Tom's verjaardag…"
                placeholderTextColor={feed.inkDim}
                maxLength={80}
                className="text-ink text-base"
                style={FIELD}
              />

              <View className="h-5" />

              <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 8 }]}>
                Beschrijving (optioneel)
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Een paar lijnen over je event"
                placeholderTextColor={feed.inkDim}
                multiline
                maxLength={500}
                className="text-ink text-base"
                style={[FIELD, { minHeight: 84, textAlignVertical: "top" }]}
              />
            </View>

            {/* Cover (optioneel) */}
            <View style={GROUP}>
              <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 8 }]}>
                Cover (optioneel)
              </Text>
              {coverUri ? (
                <View>
                  <Image
                    source={{ uri: coverUri }}
                    style={{ width: "100%", height: 190 }}
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
                  className="active:bg-feed-panel py-10 items-center justify-center"
                  style={{ borderWidth: FEED_BORDER, borderColor: feed.ink }}
                >
                  <Ionicons name="image-outline" color={feed.inkDim} size={26} />
                  <Text className="text-ink-soft text-sm mt-2">Kies een cover-foto</Text>
                </Pressable>
              )}
            </View>

            {/* Datum en tijd */}
            <View style={GROUP}>
              <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 8 }]}>
                Start
              </Text>
              <DateInput value={startsAt} onChange={setStartsAt} />

              <View className="h-5" />

              <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 8 }]}>
                Einde
              </Text>
              <DateInput value={endsAt} onChange={setEndsAt} />
            </View>

            {/* Toegang — open of gesloten groep */}
            <View style={GROUP}>
              <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 6 }]}>
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
            <View style={GROUP}>
              <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 6 }]}>
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
                  <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 8 }]}>
                    Vertraging (uren)
                  </Text>
                  <TextInput
                    value={delayHours}
                    onChangeText={setDelayHours}
                    keyboardType="number-pad"
                    className="text-ink text-base"
                style={FIELD}
                  />
                </View>
              )}
            </View>

            {/* Aantal gasten */}
            <View style={GROUP}>
              <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 8 }]}>
                Aantal gasten (max)
              </Text>
              <TextInput
                value={maxGuests}
                onChangeText={setMaxGuests}
                keyboardType="number-pad"
                className="text-ink text-base"
                style={FIELD}
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
        style={{
          display: "flex",
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: rule.soft,
        }}
      >
        {require("react").createElement("input", {
          type: "datetime-local",
          value,
          onChange: (e: any) => onChange(e.target.value),
          /**
           * Stond op `borderRadius: 999` met een rand in #D8C29B — een pil
           * in een kleur die nergens in het palet voorkomt. Nu dezelfde vorm
           * als elk ander veld in de app: geen vulling, geen rand, één
           * haarlijn eronder. De browser tekent zijn eigen focusring, dus
           * `outline` blijft uit.
           */
          style: {
            backgroundColor: "transparent",
            color: feed.ink,
            border: "none",
            borderRadius: 0,
            padding: "10px 0",
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
      className="text-ink text-base"
                style={FIELD}
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
        color={active ? creamOnDark.DEFAULT : feed.inkDim}
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
