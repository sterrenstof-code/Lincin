import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { createElement, useState } from "react";
import { Platform, Pressable, Text, View, type ViewStyle } from "react-native";

import { bodyStyle, Button, Field, labelStyle, Note, Section, SubPage } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import {
  createEvent,
  type EventJoinPolicy,
  type EventRevealMode,
} from "@/lib/api/events";
import { color, friendColor, hueFor, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { head, sans, serif } from "@/lib/design/type";
import { useUnsavedGuard } from "@/lib/unsaved";
import { usePageTitle } from "@/lib/page-title";

function plusHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

function toLocalISO(date: Date): string {
  // yyyy-mm-ddThh:mm formaat voor <input type="datetime-local">
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Hoeveel tekens je nog hebt — pas vanaf het laatste vijfde, zoals
 * `CharCount` het elders doet: een teller die vanaf het eerste teken
 * meeloopt maakt van schrijven een wedstrijd.
 */
function charsLeft(value: string, max: number): string | undefined {
  if (value.length < max * 0.8) return undefined;
  const left = max - value.length;
  return left <= 0 ? "Maximum bereikt" : `Nog ${left} tekens`;
}

/**
 * Nieuw event, in de vorm van het thema (components/lincin/SubPage).
 *
 * Het formulier staat in rubrieken: wat, cover, wanneer, wie, foto's,
 * gasten. De hoofdknop staat onderaan. De kleur van de pagina is die van
 * jou: jij wordt de gastheer, dus het event krijgt straks dezelfde kleur.
 */
export default function EventCreateScreen() {
  usePageTitle("Nieuw event");
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const defaultStart = plusHours(new Date(), 1);
  const defaultEnd = plusHours(new Date(), 5);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [place, setPlace] = useState("");
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
    !submitting && (name.trim().length > 0 || description.trim().length > 0),
    { message: "Dit event is nog niet aangemaakt. Weggaan betekent dat je het kwijt bent." }
  );
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
        place: place || null,
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
      // Mislukt: pas hier mag de knop weer aan, en de bewaking dus ook.
      setSubmitting(false);
    }
  }

  const th = useThemeSpec().id;
  const hue = hueFor(myUserId);

  return (
    <SubPage title="Nieuw event" kicker="Event" back="/(app)/events" tab="events" hue={hue} keyboard>
      <Section label="Wat" pad>
        <Field
          label="Naam"
          value={name}
          onChangeText={setName}
          placeholder="bv. Paris 2025, Tom's verjaardag…"
          maxLength={80}
        />
        <Field
          label="Beschrijving (optioneel)"
          value={description}
          onChangeText={setDescription}
          placeholder="Een paar lijnen over je event"
          multiline
          maxLength={500}
          hint={charsLeft(description, 500)}
          style={{ minHeight: 84 }}
        />
        <Field
          label="Plek (optioneel)"
          value={place}
          onChangeText={setPlace}
          placeholder="bv. Marken, Paradiso, bij Noor thuis"
          maxLength={80}
        />
      </Section>

      <Section label="Cover (optioneel)" pad>
        {coverUri ? (
          <View style={{ gap: 10 }}>
            <Image
              source={{ uri: coverUri }}
              style={{ width: "100%", height: 190, borderRadius: th === "modern" ? 14 : 0 }}
              contentFit="cover"
            />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Button label="Vervang" icon="image-outline" small grow onPress={pickCover} />
              <Button
                label="Verwijder"
                icon="trash-outline"
                small
                grow
                onPress={() => {
                  setCoverUri(null);
                  setCoverMime(null);
                }}
              />
            </View>
          </View>
        ) : (
          <CoverPicker hue={hue} onPress={pickCover} />
        )}
      </Section>

      <Section label="Wanneer" pad>
        <DateInput label="Start" value={startsAt} onChange={setStartsAt} />
        <DateInput label="Einde" value={endsAt} onChange={setEndsAt} />
      </Section>

      {/* Toegang — open of gesloten groep */}
      <Section label="Wie mag meedoen" pad>
        <Text style={bodyStyle(th, 13, color("ink", "inkDim"))}>
          De link en QR blijven in beide gevallen deelbaar. Het verschil is
          wat er gebeurt wanneer iemand erop tikt.
        </Text>
        <View style={{ gap: th === "kleur" ? 0 : 6 }}>
          <ChoiceOption
            hue={hue}
            first
            active={joinPolicy === "closed"}
            onPress={() => setJoinPolicy("closed")}
            title="Gesloten groep"
            subtitle="Jij keurt elk verzoek goed — geen ongenode gasten"
          />
          <ChoiceOption
            hue={hue}
            active={joinPolicy === "open"}
            onPress={() => setJoinPolicy("open")}
            title="Open groep"
            subtitle="Iedereen met de link komt meteen binnen"
          />
        </View>
      </Section>

      {/* Onthulling */}
      <Section label="Foto's zichtbaar" pad>
        <Text style={bodyStyle(th, 13, color("ink", "inkDim"))}>
          Wanneer mogen gasten elkaars bijdragen zien?
        </Text>
        <View style={{ gap: th === "kleur" ? 0 : 6 }}>
          <ChoiceOption
            hue={hue}
            first
            active={reveal === "during"}
            onPress={() => setReveal("during")}
            title="Tijdens het event"
            subtitle="Iedereen ziet alles realtime"
          />
          <ChoiceOption
            hue={hue}
            active={reveal === "after"}
            onPress={() => setReveal("after")}
            title="Na het event"
            subtitle="Surprise-onthulling op het eind"
          />
          <ChoiceOption
            hue={hue}
            active={reveal === "delayed"}
            onPress={() => setReveal("delayed")}
            title="Na vertraging"
            subtitle="X uur na het einde"
          />
        </View>

        {reveal === "delayed" && (
          <Field label="Vertraging (uren)" value={delayHours} onChangeText={setDelayHours} keyboardType="number-pad" />
        )}
      </Section>

      <Section label="Gasten" pad>
        <Field
          label="Aantal gasten (max)"
          value={maxGuests}
          onChangeText={setMaxGuests}
          keyboardType="number-pad"
          hint={
            joinPolicy === "closed"
              ? "1–1000. Ook goedgekeurde verzoeken tellen mee tot deze limiet."
              : "1–1000. Iedereen kan via een gedeelde link of QR meedoen tot deze limiet."
          }
        />
      </Section>

      {error ? <Note tone="red">{error}</Note> : null}

      <Button
        label={submitting ? "Bezig…" : "Maak event"}
        icon="add"
        tone="primary"
        busy={submitting}
        disabled={!canSubmit}
        onPress={onSubmit}
      />
    </SubPage>
  );
}

/**
 * Het vak waar je een cover kiest. Magazine zet het in de kleur van de
 * pagina, als een spread zonder beeld; kleur en modern houden het bij een
 * kader.
 */
function CoverPicker({ hue, onPress }: { hue: Hue; onPress: () => void }) {
  const spec = useThemeSpec();
  const th = spec.id;
  const scheme = useScheme();
  const fc = friendColor(hue, scheme);
  const fg = th === "magazine" ? fc.ink : color("ink", "inkDim");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Kies een cover-foto"
      onPress={onPress}
      style={({ pressed }) => ({
        height: 150,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: pressed ? 0.8 : 1,
        ...(th === "magazine"
          ? { backgroundColor: fc.fill }
          : th === "kleur"
            ? { borderWidth: spec.border, borderColor: color("ink"), borderStyle: "dashed" }
            : { borderRadius: 14, borderWidth: 1, borderColor: color("ink", "postRule"), borderStyle: "dashed", backgroundColor: color("paper") }),
      })}
    >
      <Ionicons name="image-outline" color={fg} size={26} />
      <Text style={th === "magazine" ? { ...serif(true), fontSize: 19, lineHeight: 24, color: fg } : labelStyle(th, 10, fg)}>
        Kies een cover-foto
      </Text>
    </Pressable>
  );
}

/** Het vak rond een invoerveld, zoals `Field` het tekent. */
function fieldBox(th: ReturnType<typeof useThemeSpec>["id"], border: number): ViewStyle {
  return {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: th === "magazine" ? 0 : 14,
    borderRadius: th === "modern" ? 14 : 0,
    borderWidth: th === "kleur" ? border : th === "magazine" ? 0 : 1,
    borderBottomWidth: th === "magazine" ? 1 : th === "kleur" ? border : 1,
    borderColor: th === "kleur" ? color("ink") : color("ink", "postRule"),
    backgroundColor: th === "magazine" ? "transparent" : color("paper"),
  };
}

/** Cross-platform datetime input. Op web: native HTML datetime-local. Op native: text. */
function DateInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  if (Platform.OS === "web") {
    // Render een HTML5 datetime-local input via createElement zodat we niet
    // tegen react-native-web's TextInput sanitizers oplopen. Het vak eromheen
    // heeft de vorm van `Field`; het veld zelf is kaal. De browser tekent
    // zijn eigen focusring, dus `outline` blijft uit.
    const font = th === "magazine" ? serif() : sans(400);
    return (
      <View style={{ gap: 6 }}>
        <Text style={labelStyle(th, 9, color("ink", "inkDim"))}>{label}</Text>
        <View style={fieldBox(th, spec.border)}>
          {createElement("input", {
            type: "datetime-local",
            value,
            "aria-label": label,
            onChange: (e: any) => onChange(e.target.value),
            style: {
              backgroundColor: "transparent",
              color: color("ink"),
              border: "none",
              borderRadius: 0,
              padding: "12px 0",
              fontSize: th === "magazine" ? 20 : 15,
              fontFamily: font.fontFamily,
              outline: "none",
              width: "100%",
              boxSizing: "border-box",
            },
          })}
        </View>
      </View>
    );
  }
  return (
    <Field
      label={label}
      value={value}
      onChangeText={onChange}
      placeholder="yyyy-mm-ddThh:mm"
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
}

/**
 * Eén keuze met een regel uitleg eronder.
 *
 * `Choice` uit de kit is een segmentrij met alleen een label; hier moet
 * de uitleg erbij, dus staan de opties onder elkaar. De gekozen optie is
 * inkt in kleur en modern, en in magazine de kleur van de pagina.
 */
function ChoiceOption({
  hue,
  active,
  first = false,
  onPress,
  title,
  subtitle,
}: {
  hue: Hue;
  active: boolean;
  first?: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const scheme = useScheme();
  const fc = friendColor(hue, scheme);
  const ink = color("ink");
  const bg = active ? (th === "magazine" ? fc.fill : ink) : "transparent";
  const fg = active ? (th === "magazine" ? fc.ink : color("paper")) : ink;
  const dim = active ? fg : color("ink", "inkDim");
  const frame: ViewStyle =
    th === "kleur"
      ? { borderWidth: spec.border, borderColor: ink, marginTop: first ? 0 : -spec.border }
      : th === "magazine"
        ? active
          ? {}
          : { borderTopWidth: 1, borderBottomWidth: 1, borderColor: color("ink", "postRule") }
        : { borderRadius: 14, borderWidth: 1, borderColor: active ? ink : color("ink", "postRule") };
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 60,
          paddingHorizontal: 14,
          paddingVertical: 10,
          backgroundColor: bg,
          opacity: pressed ? 0.8 : 1,
        },
        frame,
      ]}
    >
      <Ionicons name={active ? "radio-button-on" : "radio-button-off"} color={dim} size={20} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Text
          style={[
            th === "magazine"
              ? { ...serif(), fontSize: 20, lineHeight: 24 }
              : th === "modern"
                ? { ...sans(400), fontSize: 15.5, lineHeight: 20, letterSpacing: -0.3 }
                : { ...head(), fontSize: 18, lineHeight: 19 },
            { color: fg },
          ]}
        >
          {title}
        </Text>
        <Text style={labelStyle(th, 9, dim)}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}
