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

import { Arrow, BoxButton, Meta, Rule, Sheet, useWide } from "@/components/Editorial";
import { SafeImage } from "@/components/SafeImage";
import { SmartTextInput } from "@/components/SmartTextInput";
import { useAuth } from "@/lib/auth/provider";
import { feed, FEED_BORDER, feedType, flameDeep } from "@/lib/design/type";
import { createFind, type FindKind } from "@/lib/api/posts";
import { safeBack } from "@/lib/nav";
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
 * De composer, in twee stappen.
 *
 * Eerst kies je wat voor soort ding je deelt; daarna verschijnen alleen
 * de velden die daarbij horen. Dat scheelt een scherm vol invoervelden
 * waarvan er telkens maar drie van toepassing zijn — en het maakt de
 * vraag "wat deel ik hier eigenlijk?" expliciet in plaats van impliciet.
 *
 * Binnen stap twee geldt: **plakken moet genoeg zijn.** Wie een link
 * plakt krijgt binnen een seconde titel, beeld en bron te zien zonder
 * iets in te vullen. Al het overige is optioneel.
 */

type ComposeKind = "link" | "video" | "music" | "fragment" | "fact" | "idea" | "image" | "note";

const KINDS: { id: ComposeKind; label: string; hint: string }[] = [
  { id: "link",     label: "Link",     hint: "Artikel, site, repo" },
  { id: "video",    label: "Video",    hint: "YouTube, Vimeo" },
  { id: "music",    label: "Muziek",   hint: "Spotify, Bandcamp, SoundCloud" },
  { id: "fragment", label: "Fragment", hint: "Een passage uit een boek of artikel" },
  { id: "fact",     label: "Weetje",   hint: "Iets dat je nog niet wist" },
  { id: "idea",     label: "Idee",     hint: "Iets om te maken of te bouwen" },
  { id: "image",    label: "Foto",     hint: "Uit je bibliotheek of camera" },
  { id: "note",     label: "Notitie",  hint: "Een losse gedachte" },
];

/** Soorten die om een URL vragen. */
const URL_KINDS: ComposeKind[] = ["link", "video", "music"];
/** Soorten die om een tekstblok vragen. */
const BODY_KINDS: ComposeKind[] = ["fragment", "fact", "idea"];

export default function PostComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const wide = useWide();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  /** null = stap 1 (soort kiezen). */
  const [kind, setKind] = useState<ComposeKind | null>(null);
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
  // Web: de PWA staat als Web Share Target in `public/manifest.json` en
  // krijgt title/text/url als querystring binnen op /post-compose.
  // Native: `expo-share-intent` levert dezelfde drie velden (SHARE_TARGET.md).
  //
  // De praktijk is rommelig: Android zet de URL vaak in `text`, iOS stuurt
  // soms tekst mét een URL erin. We vissen de URL eruit en houden de rest
  // over als toelichting. Het zetten van `kind` slaat stap 1 over.
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
        setSourceTitle((prev) => prev || result.title || "");
        setSourceAuthor((prev) => prev || result.author || "");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [url]);

  /** Lange geplakte tekst in een notitie → waarschijnlijk een fragment. */
  const onNoteChange = useCallback(
    (value: string) => {
      if (kind === "note" && value.length > 280 && !body) {
        setKind("fragment");
        setBody(value);
        setNote("");
        return;
      }
      if (isBareUrl(value) && !url) {
        setKind("link");
        setUrl(value.trim());
        return;
      }
      setNote(value);
    },
    [kind, body, url]
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

  const canSubmit = !submitting && !!kind && (() => {
    if (URL_KINDS.includes(kind)) return url.trim().length > 3;
    if (BODY_KINDS.includes(kind)) return body.trim().length > 0;
    if (kind === "image") return !!imageUri;
    return note.trim().length > 0;
  })();

  /** De unfurl weet beter dan de gebruiker of iets video of muziek is. */
  function resolveKind(): FindKind {
    if (!kind) return "note";
    if (URL_KINDS.includes(kind)) {
      if (preview?.kind === "video") return "video";
      if (preview?.kind === "music") return "music";
      return kind === "link" ? "link" : (kind as FindKind);
    }
    return kind as FindKind;
  }

  async function onSubmit() {
    if (!canSubmit || !kind) return;
    setSubmitting(true);
    setError(null);
    try {
      await createFind({
        userId: myUserId,
        kind: resolveKind(),
        imageUri: imageUri ?? undefined,
        linkUrl: url.trim() || null,
        caption: note.trim() || null,
        bodyText: BODY_KINDS.includes(kind) ? body.trim() || null : null,
        sourceTitle: sourceTitle.trim() || null,
        sourceAuthor: sourceAuthor.trim() || null,
        tags: tagsRaw.split(/[,\s]+/).map((t) => t.trim()).filter(Boolean),
        meta: preview ?? null,
      });
      await qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
      safeBack(router, "/(app)/feed");
    } catch (e: any) {
      setError(humanizeError(e));
    } finally {
      setSubmitting(false);
    }
  }

  const activeKind = KINDS.find((k) => k.id === kind);

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top", "left", "right"]}>
      <Sheet flex>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Kop */}
          <View className="flex-row items-center px-6 py-4">
            <Pressable
              onPress={() => (kind ? resetToTypePicker() : safeBack(router, "/(app)/feed"))}
              hitSlop={10}
            >
              <Ionicons
                name={kind ? "arrow-back" : "close"}
                color={feed.ink}
                size={22}
              />
            </Pressable>
            <View className="flex-1 ml-4">
              <Meta tone="feed" strong>{activeKind ? activeKind.label : "Iets delen"}</Meta>
            </View>
            {kind ? (
              submitting ? (
                <ActivityIndicator size="small" color={feed.inkDim} />
              ) : (
                <BoxButton tone="feed" label="Plaatsen" filled disabled={!canSubmit} onPress={onSubmit} />
              )
            ) : null}
          </View>
          <Rule tone="feed" strong />

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 96 }}>
            {/* =============== STAP 1 — soort kiezen =============== */}
            {!kind && (
              <View>
                <View className="px-6 pt-8 pb-6">
                  <Text style={[feedType.tagline, { color: feed.ink, maxWidth: 460 }]}>
                    Wat breng je mee?
                  </Text>
                </View>
                <Rule tone="feed" />
                {KINDS.map((k) => (
                  <Pressable
                    key={k.id}
                    onPress={() => { setKind(k.id); setError(null); }}
                    className="active:bg-feed-panel"
                  >
                    <View className="flex-row items-center px-6 py-5">
                      <View className="flex-1 pr-5">
                        <Text style={[feedType.tile, { color: feed.ink }]}>
                          {k.label}
                        </Text>
                        <View className="mt-0.5">
                          <Meta tone="feed" dim>{k.hint}</Meta>
                        </View>
                      </View>
                      <Arrow tone="feed" dim />
                    </View>
                    <Rule tone="feed" />
                  </Pressable>
                ))}
              </View>
            )}

            {/* =============== STAP 2 — de passende velden =============== */}
            {kind && (
              <View style={wide ? { maxWidth: 720 } : undefined}>
                {/* --- URL-soorten --- */}
                {URL_KINDS.includes(kind) && (
                  <View>
                    <Field label="Adres">
                      <TextInput
                        value={url}
                        onChangeText={(v) => { setUrl(v); setError(null); }}
                        placeholder="Plak een link…"
                        placeholderTextColor={feed.inkDim}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        autoFocus
                        style={[
                          feedType.tile,
                          { color: feed.ink, paddingVertical: 11 },
                          Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
                        ]}
                      />
                    </Field>

                    {unfurling && (
                      <View className="flex-row items-center px-6 py-6">
                        <ActivityIndicator size="small" color={feed.inkDim} />
                        <View className="ml-3">
                          <Meta tone="feed" dim>Bron ophalen…</Meta>
                        </View>
                      </View>
                    )}

                    {preview && !unfurling && <PreviewBand preview={preview} />}
                  </View>
                )}

                {/* --- Tekstsoorten --- */}
                {BODY_KINDS.includes(kind) && (
                  <Field
                    label={
                      kind === "fragment" ? "Het fragment"
                      : kind === "fact" ? "Het weetje"
                      : "Het idee"
                    }
                  >
                    <TextInput
                      value={body}
                      onChangeText={setBody}
                      placeholder={
                        kind === "fragment" ? "Tik over of plak wat je las…"
                        : kind === "fact" ? "Wat wist je nog niet?"
                        : "Wat zou je willen maken?"
                      }
                      placeholderTextColor={feed.inkDim}
                      multiline
                      autoFocus
                      maxLength={2000}
                      style={[
                        feedType.pullSmall,
                        { color: feed.ink, paddingVertical: 12, minHeight: 150, textAlignVertical: "top" },
                        Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
                      ]}
                    />
                  </Field>
                )}

                {/* --- Foto --- */}
                {kind === "image" && (
                  <View>
                    {imageUri ? (
                      <View>
                        <SafeImage
                          uri={imageUri}
                          style={{ width: "100%", aspectRatio: 1 }}
                          contentFit="cover"
                          fallbackBg="bg-feed-post"
                          fallbackColor={feed.inkDim}
                        />
                        <View className="flex-row px-6 py-4">
                          <Pressable onPress={() => pickImage(false)}>
                            <Meta tone="feed" strong>Wijzig</Meta>
                          </Pressable>
                          <Meta tone="feed" dim style={{ marginHorizontal: 10 }}>/</Meta>
                          <Pressable onPress={() => setImageUri(null)}>
                            <Meta tone="feed" dim>Verwijder</Meta>
                          </Pressable>
                        </View>
                        <Rule tone="feed" />
                      </View>
                    ) : (
                      <View>
                        <PickRow label="Kies uit je bibliotheek" onPress={() => pickImage(false)} />
                        {Platform.OS !== "web" && (
                          <PickRow label="Maak een foto" onPress={() => pickImage(true)} />
                        )}
                      </View>
                    )}
                  </View>
                )}

                {/* --- Notitie --- */}
                {kind === "note" && (
                  <Field label="Gedachte">
                    <SmartTextInput
                      value={note}
                      onChangeText={onNoteChange}
                      placeholder="Schrijf iets…"
                      placeholderTextColor={feed.inkDim}
                      multiline
                      autoFocus
                      maxLength={1000}
                      style={{
                        minHeight: 150,
                        textAlignVertical: "top",
                        ...feedType.pullSmall,
                        color: feed.ink,
                        paddingVertical: 12,
                      }}
                    />
                  </Field>
                )}

                {/* --- Bron: alleen waar het zin heeft --- */}
                {(kind === "fragment" || kind === "link") && (
                  <View className="px-6 pt-7">
                    <Meta tone="feed" dim>
                      {kind === "fragment" ? "Bron — wie schreef het, en waarin" : "Bron"}
                    </Meta>
                    <View className="flex-row mt-1">
                      <View className="flex-1 pr-4">
                        <TextInput
                          value={sourceAuthor}
                          onChangeText={setSourceAuthor}
                          placeholder="Auteur"
                          placeholderTextColor={feed.inkDim}
                          style={[
                            feedType.body,
                            { color: feed.ink, paddingVertical: 10 },
                            Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
                          ]}
                        />
                        <Rule tone="feed" />
                      </View>
                      <View className="flex-1">
                        <TextInput
                          value={sourceTitle}
                          onChangeText={setSourceTitle}
                          placeholder="Titel"
                          placeholderTextColor={feed.inkDim}
                          style={[
                            feedType.body,
                            { color: feed.ink, paddingVertical: 10 },
                            Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
                          ]}
                        />
                        <Rule tone="feed" />
                      </View>
                    </View>
                  </View>
                )}

                {/* --- Toelichting --- */}
                {kind !== "note" && (
                  <Field label={kind === "image" ? "Bijschrift" : "Waarom deel je dit?"}>
                    <SmartTextInput
                      value={note}
                      onChangeText={onNoteChange}
                      placeholder="Optioneel — één zin is genoeg."
                      placeholderTextColor={feed.inkDim}
                      multiline
                      maxLength={500}
                      style={{
                        minHeight: 70,
                        textAlignVertical: "top",
                        ...feedType.body,
                        color: feed.inkDim,
                        paddingVertical: 11,
                      }}
                    />
                  </Field>
                )}

                {/* --- Tags --- */}
                <Field label="Tags — gescheiden door spaties">
                  <TextInput
                    value={tagsRaw}
                    onChangeText={setTagsRaw}
                    placeholder="muziek bouwen design lezen"
                    placeholderTextColor={feed.inkDim}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[
                      feedType.body,
                      { color: feed.ink, paddingVertical: 11 },
                      Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {},
                    ]}
                  />
                </Field>

                {error && (
                  <View
                    className="mx-6 mt-7 px-4 py-3"
                    style={{ borderLeftWidth: 2, borderLeftColor: feed.ink }}
                  >
                    <Text style={[feedType.body, { color: feed.ink }]}>{error}</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Sheet>
    </SafeAreaView>
  );

  /** Terug naar stap 1 en alles leegmaken — anders lekt een half ingevuld
   *  formulier door naar het volgende soort. */
  function resetToTypePicker() {
    setKind(null);
    setUrl("");
    setBody("");
    setNote("");
    setSourceAuthor("");
    setSourceTitle("");
    setImageUri(null);
    setPreview(null);
    setError(null);
    lastUnfurled.current = "";
  }
}

// ---------------------------------------------------------------
// Bouwstenen
// ---------------------------------------------------------------

/** Label boven, invoer eronder, haarlijn onderaan. Geen doos. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="px-6 pt-7">
      {/* Het veldlabel is een redactionele kicker, niet een formulierlabel:
          klein, kapitaal, in het rood. Vandaar flameDeep en niet de volle
          flame — op lavendel haalt die geen 4.5:1 op deze maat. */}
      <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>
        {label.toUpperCase()}
      </Text>
      {children}
      <Rule tone="feed" />
    </View>
  );
}

function PickRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        className="flex-row items-center px-6 py-5 active:bg-feed-panel"
      >
        <Text style={[feedType.tile, { color: feed.ink, flex: 1 }]}>{label}</Text>
        <Arrow tone="feed" dim />
      </Pressable>
      <Rule tone="feed" />
    </View>
  );
}

/** Wat de unfurl vond — zoals het in de feed zal staan. */
function PreviewBand({ preview }: { preview: LinkPreview }) {
  const extra = [
    preview.site_name ?? hostnameOf(preview.url),
    preview.author,
    formatDuration(preview.duration_s) ?? formatReadingTime(preview.word_count),
  ]
    .filter(Boolean)
    .join("   ·   ");

  /**
   * Zodra er beeld is, wordt dat het vlak: volle breedte, hoog formaat, met
   * de titel eroverheen — zoals de referenties. Zonder beeld valt hij terug
   * op een tekstband op `feed-post`, zodat de preview altijd hetzelfde
   * gewicht houdt in de kolom.
   */
  const hasImage = !!preview.image_url;

  return (
    <View className="mt-7">
      <Rule tone="feed" strong />
      {hasImage ? (
        <View style={{ width: "100%", aspectRatio: 4 / 5, backgroundColor: feed.post }}>
          <SafeImage
            uri={preview.image_url}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            fallbackBg="bg-feed-post"
            fallbackColor={feed.textDim}
          />
          {/* Scrim zodat de tekst leesbaar blijft op elke foto. Drie
              gestapelde vlakken i.p.v. een gradient-dependency. */}
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
          >
            <View style={{ height: 40, backgroundColor: "rgba(0,0,0,0.18)" }} />
            <View style={{ height: 40, backgroundColor: "rgba(0,0,0,0.40)" }} />
            <View style={{ backgroundColor: "rgba(0,0,0,0.66)", padding: 20 }}>
              <Text
                style={[
                  feedType.kicker,
                  { color: "#FFFFFF", opacity: 0.75, letterSpacing: 0.55, marginBottom: 8 },
                ]}
                numberOfLines={1}
              >
                {extra.toUpperCase()}
              </Text>
              {preview.title ? (
                <Text style={[feedType.cover, { color: "#FFFFFF" }]} numberOfLines={4}>
                  {preview.title}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
      <View className="px-6 py-5">
        {hasImage ? null : <Meta tone="feed" dim>{extra}</Meta>}
        {preview.title && !hasImage ? (
          <Text style={[feedType.tagline, { color: feed.ink, marginTop: 7 }]}>
            {preview.title}
          </Text>
        ) : null}
        {preview.description ? (
          <Text style={[feedType.body, { color: feed.inkDim, marginTop: 7 }]} numberOfLines={3}>
            {preview.description}
          </Text>
        ) : null}
        {preview.kind !== "link" ? (
          <View className="mt-4">
            <Meta tone="feed" dim>
              {preview.kind === "video" ? "Speelt af in de feed" : "Luistert in de feed"}
            </Meta>
          </View>
        ) : null}
      </View>
      <Rule tone="feed" strong />
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
  if (/posts_kind_check|column .* does not exist/i.test(msg)) {
    return "Migratie 0042 is nog niet toegepast in Supabase.";
  }
  if (/mime type/i.test(msg)) {
    return "Dit bestandstype is niet toegelaten. Gebruik JPG, PNG, WebP of HEIC.";
  }
  return msg;
}
