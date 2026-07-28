import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

import { Arrow, Meta, Rule } from "@/components/Editorial";
import { SafeImage } from "@/components/SafeImage";
import { ScreenContainer } from "@/components/ScreenContainer";
import { SmartTextInput } from "@/components/SmartTextInput";
import { useAuth } from "@/lib/auth/provider";
import { ink, type } from "@/lib/design/type";
import { createFind, type FindKind } from "@/lib/api/posts";
import {
  findUrl,
  formatDuration,
  formatReadingTime,
  hostnameOf,
  isBareUrl,
  unfurl,
  type LinkPreview,
} from "@/lib/api/unfurl";

/**
 * De vondst-composer.
 *
 * Eén principe: **plakken moet genoeg zijn.** Wie een link plakt krijgt
 * binnen een seconde titel, beeld en bron te zien zonder iets in te vullen.
 * Wie een lap tekst plakt, krijgt de vraag of het een fragment is. Alles wat
 * daarna nog ingevuld kan worden is optioneel — want een curatie-app die om
 * formulieren vraagt, wordt niet gebruikt.
 */

type ComposeKind = "link" | "fragment" | "fact" | "idea" | "image" | "note";

const KINDS: { id: ComposeKind; label: string }[] = [
  { id: "link", label: "Link" },
  { id: "fragment", label: "Fragment" },
  { id: "fact", label: "Weetje" },
  { id: "idea", label: "Idee" },
  { id: "image", label: "Beeld" },
  { id: "note", label: "Notitie" },
];

export default function PostComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const [kind, setKind] = useState<ComposeKind>("link");
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");
  const [note, setNote] = useState("");
  const [sourceAuthor, setSourceAuthor] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [unfurling, setUnfurling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastUnfurled = useRef<string>("");

  // -------------------------------------------------------------
  // Binnenkomend vanuit het deelmenu
  // -------------------------------------------------------------
  //
  // Web: de PWA staat als Web Share Target in `public/manifest.json` en
  // krijgt title/text/url als querystring binnen op /post-compose.
  // Native: `expo-share-intent` levert dezelfde drie velden aan (zie
  // SHARE_TARGET.md) — daarom lezen we ze hier op één plek uit.
  //
  // De praktijk is rommelig: Android zet de URL vaak in `text`, iOS stuurt
  // soms tekst mét een URL erin. Daarom vissen we de URL eruit en houden we
  // de rest over als toelichting.
  const shared = useLocalSearchParams<{ title?: string; text?: string; url?: string }>();
  const sharedHandled = useRef(false);

  useEffect(() => {
    if (sharedHandled.current) return;
    const rawText = typeof shared.text === "string" ? shared.text : "";
    const rawUrl = typeof shared.url === "string" ? shared.url : "";
    const rawTitle = typeof shared.title === "string" ? shared.title : "";
    if (!rawText && !rawUrl && !rawTitle) return;
    sharedHandled.current = true;

    const detected = rawUrl || findUrl(rawText) || "";

    if (detected) {
      setKind("link");
      setUrl(detected);
      // Wat er naast de link stond is de toelichting, niet de link zelf.
      const rest = rawText.replace(detected, "").trim();
      if (rest) setNote(rest);
      else if (rawTitle && rawTitle !== detected) setSourceTitle(rawTitle);
      return;
    }

    if (rawText.length > 280) {
      setKind("fragment");
      setBody(rawText);
      if (rawTitle) setSourceTitle(rawTitle);
      return;
    }

    if (rawText) {
      setKind("note");
      setNote(rawText);
    }
  }, [shared.text, shared.url, shared.title]);

  // -------------------------------------------------------------
  // Automatisch unfurlen zodra de URL er compleet uitziet
  // -------------------------------------------------------------
  useEffect(() => {
    const candidate = url.trim();
    if (!candidate || !isBareUrl(candidate)) {
      if (!candidate) setPreview(null);
      return;
    }
    if (candidate === lastUnfurled.current) return;

    const timer = setTimeout(async () => {
      lastUnfurled.current = candidate;
      setUnfurling(true);
      const result = await unfurl(candidate);
      setUnfurling(false);
      if (result) {
        setPreview(result);
        // De bron zelf invullen als de gebruiker dat nog niet deed
        setSourceTitle((prev) => prev || result.title || "");
        setSourceAuthor((prev) => prev || result.author || "");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [url]);

  /**
   * Plakt iemand een kale URL in een tekstveld, dan is het een link —
   * niet een notitie die toevallig een URL bevat.
   */
  const handleTextPaste = useCallback(
    (value: string, setter: (v: string) => void) => {
      if (isBareUrl(value) && !url) {
        setKind("link");
        setUrl(value.trim());
        return;
      }
      setter(value);
    },
    [url]
  );

  /** Lange geplakte tekst → waarschijnlijk een fragment. */
  const onNoteChange = useCallback(
    (value: string) => {
      if (kind === "note" && value.length > 280 && !body) {
        setKind("fragment");
        setBody(value);
        setNote("");
        return;
      }
      handleTextPaste(value, setNote);
    },
    [kind, body, handleTextPaste]
  );

  async function pickImage(fromCamera: boolean) {
    setError(null);
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(fromCamera ? "Geen camera-toegang." : "Geen toegang tot je mediabibliotheek.");
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.85,
          selectionLimit: 1,
        });
    if (result.canceled || !result.assets[0]) return;
    setImageUri(result.assets[0].uri);
  }

  const canSubmit = !submitting && (() => {
    switch (kind) {
      case "link": return url.trim().length > 3;
      case "fragment":
      case "fact":
      case "idea": return body.trim().length > 0;
      case "image": return !!imageUri;
      case "note": return note.trim().length > 0;
    }
  })();

  /** Een link wordt video of muziek zodra de unfurl dat zegt. */
  function resolveKind(): FindKind {
    if (kind !== "link") return kind as FindKind;
    if (preview?.kind === "video") return "video";
    if (preview?.kind === "music") return "music";
    return "link";
  }

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await createFind({
        userId: myUserId,
        kind: resolveKind(),
        imageUri: imageUri ?? undefined,
        linkUrl: url.trim() || null,
        caption: note.trim() || null,
        bodyText: ["fragment", "fact", "idea"].includes(kind) ? body.trim() || null : null,
        sourceTitle: sourceTitle.trim() || null,
        sourceAuthor: sourceAuthor.trim() || null,
        tags: tagsRaw
          .split(/[,\s]+/)
          .map((t) => t.trim())
          .filter(Boolean),
        meta: preview ?? null,
      });
      await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
      router.back();
    } catch (e: any) {
      setError(humanizeError(e));
    } finally {
      setSubmitting(false);
    }
  }

  const showSource = ["fragment", "fact", "idea"].includes(kind);

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top", "left", "right"]}>
      {/* Papieren kolom op de donkere schil — op breed scherm blijft de
          goot donker, wat de pagina echt als *pagina* laat lezen. */}
      <ScreenContainer className="bg-paper-light">
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 90 }}>
            {/* Kop */}
            <View className="flex-row items-center px-5 pt-3 pb-3">
              <Pressable onPress={() => router.back()} hitSlop={10}>
                <Ionicons name="close" color={ink.DEFAULT} size={22} />
              </Pressable>
              <View className="flex-1 ml-4">
                <Meta tone="paper">Nieuwe vondst</Meta>
              </View>
              <Pressable
                onPress={onSubmit}
                disabled={!canSubmit}
                style={{
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: canSubmit ? ink.DEFAULT : ink.muted,
                  backgroundColor: canSubmit ? ink.DEFAULT : "transparent",
                }}
                className="px-4 py-2.5"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={ink.muted} />
                ) : (
                  <Meta tone={canSubmit ? "shell" : "paper"} dim={!canSubmit}>
                    Plaatsen
                  </Meta>
                )}
              </Pressable>
            </View>

            <Rule tone="paper" strong />

            {/* Soort — kapitalen, geen pillen */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 13 }}
            >
              {KINDS.map((k, i) => {
                const active = kind === k.id;
                return (
                  <Pressable
                    key={k.id}
                    onPress={() => { setKind(k.id); setError(null); }}
                    className="flex-row items-center"
                  >
                    {i > 0 && (
                      <Meta tone="paper" dim style={{ marginHorizontal: 9 }}>
                        /
                      </Meta>
                    )}
                    <View
                      style={
                        active
                          ? { borderBottomWidth: 1.5, borderBottomColor: ink.DEFAULT, paddingBottom: 2 }
                          : { paddingBottom: 2 }
                      }
                    >
                      <Meta tone="paper" dim={!active}>
                        {k.label}
                      </Meta>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Rule tone="paper" />

            {/* ---------------- LINK ---------------- */}
            {kind === "link" && (
              <View>
                <View className="px-5 pt-5">
                  <Meta tone="paper" dim>Adres</Meta>
                  <TextInput
                    value={url}
                    onChangeText={(v) => { setUrl(v); setError(null); }}
                    placeholder="Plak een link…"
                    placeholderTextColor={ink.muted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    autoFocus
                    style={[
                      type.headlineSmall,
                      { color: ink.DEFAULT, paddingVertical: 10 },
                      Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
                    ]}
                  />
                  <Rule tone="paper" />
                </View>

                {unfurling && (
                  <View className="flex-row items-center px-5 py-5">
                    <ActivityIndicator size="small" color={ink.muted} />
                    <View className="ml-3">
                      <Meta tone="paper" dim>Bron ophalen…</Meta>
                    </View>
                  </View>
                )}

                {preview && !unfurling && <PreviewBand preview={preview} />}
              </View>
            )}

            {/* ---------------- FRAGMENT / WEETJE / IDEE ---------------- */}
            {showSource && (
              <View className="px-5 pt-5">
                <Meta tone="paper" dim>
                  {kind === "fragment" ? "Het fragment" : kind === "fact" ? "Het weetje" : "Het idee"}
                </Meta>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder={
                    kind === "fragment"
                      ? "Tik over of plak wat je las…"
                      : kind === "fact"
                      ? "Wat wist je nog niet?"
                      : "Wat zou je willen maken?"
                  }
                  placeholderTextColor={ink.muted}
                  multiline
                  autoFocus
                  maxLength={2000}
                  style={[
                    type.quote,
                    { color: ink.DEFAULT, paddingVertical: 12, minHeight: 130, textAlignVertical: "top" },
                    Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
                  ]}
                />
                <Rule tone="paper" />
              </View>
            )}

            {/* ---------------- BEELD ---------------- */}
            {kind === "image" && (
              <View className="pt-4">
                {imageUri ? (
                  <View>
                    <SafeImage
                      uri={imageUri}
                      style={{ width: "100%", aspectRatio: 1 }}
                      contentFit="cover"
                      fallbackBg="bg-paper-warm"
                      fallbackColor="#5A4F40"
                    />
                    <View className="flex-row px-5 py-3">
                      <Pressable onPress={() => pickImage(false)}>
                        <Meta tone="paper">Wijzig</Meta>
                      </Pressable>
                      <Meta tone="paper" dim style={{ marginHorizontal: 9 }}>/</Meta>
                      <Pressable onPress={() => setImageUri(null)}>
                        <Meta tone="paper" dim>Verwijder</Meta>
                      </Pressable>
                    </View>
                    <Rule tone="paper" />
                  </View>
                ) : (
                  <View>
                    <Pressable
                      onPress={() => pickImage(false)}
                      className="flex-row items-center px-5 py-4 active:bg-paper-warm"
                    >
                      <Text style={[type.headlineSmall, { color: ink.DEFAULT, flex: 1 }]}>
                        Kies uit je bibliotheek
                      </Text>
                      <Arrow tone="paper" />
                    </Pressable>
                    <Rule tone="paper" />
                    {Platform.OS !== "web" && (
                      <View>
                        <Pressable
                          onPress={() => pickImage(true)}
                          className="flex-row items-center px-5 py-4 active:bg-paper-warm"
                        >
                          <Text style={[type.headlineSmall, { color: ink.DEFAULT, flex: 1 }]}>
                            Maak een foto
                          </Text>
                          <Arrow tone="paper" />
                        </Pressable>
                        <Rule tone="paper" />
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* ---------------- NOTITIE ---------------- */}
            {kind === "note" && (
              <View className="px-5 pt-5">
                <Meta tone="paper" dim>Gedachte</Meta>
                <SmartTextInput
                  value={note}
                  onChangeText={onNoteChange}
                  placeholder="Schrijf iets…"
                  placeholderTextColor={ink.muted}
                  multiline
                  autoFocus
                  maxLength={1000}
                  style={{ minHeight: 130, textAlignVertical: "top", ...type.quote, color: ink.DEFAULT, paddingVertical: 12 }}
                />
                <Rule tone="paper" />
              </View>
            )}

            {/* ---------------- Bron ---------------- */}
            {(showSource || kind === "link") && (
              <View className="px-5 pt-6">
                <Meta tone="paper" dim>
                  {kind === "fragment" ? "Bron — boek, artikel, wie het schreef" : "Bron"}
                </Meta>
                <View className="flex-row mt-1">
                  <View className="flex-1 pr-3">
                    <TextInput
                      value={sourceAuthor}
                      onChangeText={setSourceAuthor}
                      placeholder="Auteur"
                      placeholderTextColor={ink.muted}
                      style={[
                        type.body,
                        { color: ink.DEFAULT, paddingVertical: 9 },
                        Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
                      ]}
                    />
                    <Rule tone="paper" />
                  </View>
                  <View className="flex-1">
                    <TextInput
                      value={sourceTitle}
                      onChangeText={setSourceTitle}
                      placeholder="Titel"
                      placeholderTextColor={ink.muted}
                      style={[
                        type.body,
                        { color: ink.DEFAULT, paddingVertical: 9 },
                        Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
                      ]}
                    />
                    <Rule tone="paper" />
                  </View>
                </View>
              </View>
            )}

            {/* ---------------- Toelichting ---------------- */}
            {kind !== "note" && (
              <View className="px-5 pt-6">
                <Meta tone="paper" dim>Waarom deel je dit?</Meta>
                <SmartTextInput
                  value={note}
                  onChangeText={onNoteChange}
                  placeholder="Optioneel — één zin is genoeg."
                  placeholderTextColor={ink.muted}
                  multiline
                  maxLength={500}
                  style={{ minHeight: 64, textAlignVertical: "top", ...type.body, color: ink.soft, paddingVertical: 10 }}
                />
                <Rule tone="paper" />
              </View>
            )}

            {/* ---------------- Tags ---------------- */}
            <View className="px-5 pt-6">
              <Meta tone="paper" dim>Tags — gescheiden door spaties</Meta>
              <TextInput
                value={tagsRaw}
                onChangeText={setTagsRaw}
                placeholder="muziek bouwen design lezen"
                placeholderTextColor={ink.muted}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  type.body,
                  { color: ink.DEFAULT, paddingVertical: 10 },
                  Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
                ]}
              />
              <Rule tone="paper" />
            </View>

            {error && (
              <View className="mx-5 mt-6 px-4 py-3" style={{ borderLeftWidth: 2, borderLeftColor: "#B23A1C" }}>
                <Text style={[type.bodySmall, { color: "#B23A1C" }]}>{error}</Text>
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------
// Wat de unfurl vond — zoals het in de feed zal staan
// ---------------------------------------------------------------

function PreviewBand({ preview }: { preview: LinkPreview }) {
  const extra = [
    preview.site_name ?? hostnameOf(preview.url),
    preview.author,
    formatDuration(preview.duration_s) ?? formatReadingTime(preview.word_count),
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <View className="mt-5">
      <Rule tone="paper" strong />
      {preview.image_url ? (
        <SafeImage
          uri={preview.image_url}
          style={{ width: "100%", aspectRatio: 2 }}
          contentFit="cover"
          fallbackBg="bg-paper-warm"
          fallbackColor="#5A4F40"
        />
      ) : null}
      <View className="px-5 py-4">
        <Meta tone="paper" dim>{extra}</Meta>
        {preview.title ? (
          <Text style={[type.headline, { color: ink.DEFAULT, marginTop: 6 }]}>
            {preview.title}
          </Text>
        ) : null}
        {preview.description ? (
          <Text style={[type.bodySmall, { color: ink.muted, marginTop: 6 }]} numberOfLines={3}>
            {preview.description}
          </Text>
        ) : null}
        {preview.kind !== "link" ? (
          <View className="mt-3">
            <Meta tone="paper" dim>
              {preview.kind === "video" ? "Speelt af in de feed" : "Luistert in de feed"}
            </Meta>
          </View>
        ) : null}
      </View>
      <Rule tone="paper" strong />
    </View>
  );
}

function humanizeError(err: any): string {
  const msg = err?.message ?? String(err ?? "Onbekende fout");
  if (/schema is invalid|schema is incompatible/i.test(msg)) {
    return "Supabase Storage gaf een schema-fout. Run `0003_storage_repair.sql` en probeer opnieuw.";
  }
  if (/row-level security|permission denied/i.test(msg)) {
    return "Toegang geweigerd — controleer of de migratie is toegepast.";
  }
  if (/violates check constraint "posts_kind_check"/i.test(msg)) {
    return "Migratie 0042 is nog niet toegepast in Supabase.";
  }
  if (/column .* does not exist/i.test(msg)) {
    return "Migratie 0042 is nog niet toegepast in Supabase.";
  }
  if (/mime type/i.test(msg)) {
    return "Dit bestandstype is niet toegelaten. Gebruik JPG, PNG, WebP of HEIC.";
  }
  return msg;
}
