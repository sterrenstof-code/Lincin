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
import { FormatBar } from "@/components/FormatBar";
import { useAuth } from "@/lib/auth/provider";
import {
  CONTROL_H,
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  flameDeep,
  space,
} from "@/lib/design/type";
import {
  createFind,
  isVideoUri,
  type FindKind,
  type PostVisibility,
} from "@/lib/api/posts";
import { humanizeError } from "@/lib/errors";
import { safeBack } from "@/lib/nav";
import { SHARE_KINDS } from "@/lib/share-kinds";
import { continueList, type EditResult, type Selection } from "@/lib/richtext";
import { useUnsavedGuard } from "@/lib/unsaved";
import { CharCount } from "@/components/CharCount";
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

type ComposeKind =
  | "link"
  | "video"
  | "music"
  | "fragment"
  | "fact"
  | "idea"
  | "image"
  | "note"
  | "quote"
  | "swatch";

/**
 * De soorten komen uit `lib/share-kinds.ts` — dezelfde lijst die het
 * snelmenu onder de zwevende plusknop vult. Twee lijsten die hetzelfde
 * moeten zeggen lopen altijd een keer uiteen; daar staat het waarom.
 *
 * `fragment` en `fact` bestaan nog wél in de database en worden nog gewoon
 * getoond; ze zijn alleen niet meer te kiezen. Wat ze konden, kan de
 * notitie nu ook: opmaak, en een bron eronder. Een lange notitie met een
 * bron ís een fragment.
 */
const KINDS = SHARE_KINDS;

/** Soorten die om een URL vragen. */
const URL_KINDS: ComposeKind[] = ["link", "video", "music"];
const BODY_KINDS: ComposeKind[] = ["note", "idea", "fragment", "fact", "quote"];

/**
 * De twaalf stalen van de kiezer.
 *
 * Een volledige kleurenkiezer is hier het verkeerde gereedschap: je zoekt
 * geen precieze waarde maar een kleur die ergens bij hoort, en dan is een
 * blad met twaalf goede kleuren sneller dan een vlak waarin je een punt
 * moet raken. Wie tóch een exacte kleur wil, typt hem — het veld eronder
 * neemt elke `#RRGGBB`.
 *
 * De reeks loopt van licht naar donker en van warm naar koel, zodat hij
 * als staalkaart leest en niet als een zak kleuren.
 */
const SWATCH_PRESETS = [
  "#F7F5F2", "#E8E2D9", "#D9CFC2", "#C4A484",
  "#E66B3F", "#D4551F", "#A81C13", "#7A2E2E",
  "#4FBDB0", "#2F6F6A", "#3F6FD0", "#0B0A0C",
];

export default function PostComposeScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const wide = useWide();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  /** null = stap 1 (soort kiezen). */
  /**
   * Heeft de aanroeper het soort al meegegeven, dan slaan we de keuzelijst
   * over: twee keer dezelfde vraag stellen is één keer te veel.
   */
  const [kind, setKind] = useState<ComposeKind | null>(null);
  const [url, setUrl] = useState("");
  const [body, setBody] = useState("");

  /**
   * Waar de cursor staat, en waar hij na een opmaakknop hóórt te staan.
   *
   * Twee stukjes staat in plaats van één, want ze bewegen de andere kant
   * op: `selection` volgt de gebruiker, `forcedSelection` stuurt hem. Die
   * tweede staat maar één render aan — laat je hem staan, dan springt de
   * cursor terug bij elke toetsaanslag.
   */
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [forcedSelection, setForcedSelection] = useState<Selection | null>(null);
  const bodyRef = useRef<TextInput>(null);

  /**
   * Enter in een opsomming zet de opsomming voort.
   *
   * Dit hangt aan `onChangeText` en niet aan `onKeyPress`, want die tweede
   * is op native voor een multiline veld niet betrouwbaar — en waar hij wél
   * afgaat kun je de invoer niet meer tegenhouden. Achteraf kijken wat er
   * veranderd is werkt overal hetzelfde: is er precies één regeleinde
   * bijgekomen, dan kijken we naar de regel ervóór.
   */
  function onBodyChange(next: string) {
    // Plakken moet genoeg zijn: een kale URL in een notitie was bedoeld als
    // link. Stond eerder op het losse notitie-veld, dat er niet meer is.
    if (kind === "note" && !body && isBareUrl(next) && !url) {
      setKind("link");
      setUrl(next.trim());
      return;
    }
    if (next.length === body.length + 1) {
      let i = 0;
      while (i < body.length && body[i] === next[i]) i += 1;
      if (next[i] === "\n" && next.slice(i + 1) === body.slice(i)) {
        const continued = continueList(body, { start: i, end: i });
        if (continued) {
          setBody(continued.text);
          setSelection(continued.selection);
          setForcedSelection(continued.selection);
          return;
        }
      }
    }
    setBody(next);
  }

  function onFormat(next: EditResult) {
    setBody(next.text);
    setSelection(next.selection);
    setForcedSelection(next.selection);
    bodyRef.current?.focus();
  }

  useEffect(() => {
    if (!forcedSelection) return;
    const id = setTimeout(() => setForcedSelection(null), 0);
    return () => clearTimeout(id);
  }, [forcedSelection]);
  const [note, setNote] = useState("");
  const [sourceAuthor, setSourceAuthor] = useState("");
  const [sourceTitle, setSourceTitle] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  /**
   * Meerdere foto's mogen: samen zijn ze één vondst met een album, en in
   * de feed blader je erdoorheen. De eerste is de omslag.
   */
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [swatchHex, setSwatchHex] = useState("#E66B3F");
  /**
   * Waar deze vondst heen gaat.
   *
   * Standaard de feed — dat is wat de app tot nu toe deed, en een
   * standaard die stilzwijgend verandert is erger dan geen keuze. Wie
   * alleen zijn bord wil vullen zet hem om; zie 0055.
   */
  const [visibility, setVisibility] = useState<PostVisibility>("feed");

  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [unfurling, setUnfurling] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      (body.trim().length > 0 ||
        note.trim().length > 0 ||
        url.trim().length > 0 ||
        imageUris.length > 0),
    { message: "Je vondst is nog niet geplaatst. Weggaan betekent dat je hem kwijt bent." }
  );

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
  const shared = useLocalSearchParams<{
    title?: string;
    text?: string;
    url?: string;
    /** Vooraf gekozen soort — de plus in de zijbalk vraagt het al. */
    kind?: string;
  }>();
  const sharedHandled = useRef(false);

  /** Het soort dat de aanroeper al koos. */
  useEffect(() => {
    const preset = typeof shared.kind === "string" ? shared.kind : null;
    if (!preset) return;
    if (KINDS.some((k) => k.id === preset)) setKind(preset as ComposeKind);
    // Eén keer: daarna mag de gebruiker gewoon terug naar de keuzelijst.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /**
   * De toelichting bij een vondst.
   *
   * Hier zat een sprong naar `fragment` zodra je meer dan 280 tekens typte.
   * Die is weg: de notitie is nu zelf het lange-tekstveld, dus er is niets
   * meer om naartoe te springen. Wat blijft is de link-herkenning — plak je
   * een kale URL, dan bedoelde je een link.
   */
  const onNoteChange = useCallback(
    (value: string) => {
      if (isBareUrl(value) && !url) {
        setKind("link");
        setUrl(value.trim());
        return;
      }
      setNote(value);
    },
    [url]
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
    // Bewegend beeld mag ook. De chat en de events konden dit al —
    // `["images", "videos"]` staat daar gewoon — en juist de composer, de
    // enige weg naar je eigen bord, hield het bij stilstaand beeld. Dan kun
    // je een clip wél naar één iemand sturen en niet op je profiel zetten.
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.85,
        })
      : await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images", "videos"],
          quality: 0.85,
          allowsMultipleSelection: true,
          // Ruim genoeg voor een middag fotograferen, niet zo ruim dat één
          // vondst een half fotoalbum wordt.
          selectionLimit: 20,
        });
    if (result.canceled || result.assets.length === 0) return;

    // Eén clip per vondst, en de foto's apart. Een album is iets om
    // doorheen te bladeren; een video is het onderwerp zelf, en twee
    // video's onder één vondst is geen vondst meer maar een map.
    const videos = result.assets.filter((a) => a.type === "video" || isVideoUri(a.uri));
    const images = result.assets.filter((a) => !videos.includes(a));
    if (videos.length > 0) setVideoUri(videos[0].uri);
    // Aanvullen en niet vervangen: "Meer toevoegen" moet ook echt toevoegen.
    if (images.length > 0) {
      setImageUris((prev) => [...prev, ...images.map((a) => a.uri)].slice(0, 20));
    }
  }

  const canSubmit = !submitting && !!kind && (() => {
    if (kind === "swatch") return /^#[0-9a-fA-F]{6}$/.test(swatchHex.trim());
    if (URL_KINDS.includes(kind)) return url.trim().length > 3;
    if (BODY_KINDS.includes(kind)) return body.trim().length > 0;
    if (kind === "image") return imageUris.length > 0 || !!videoUri;
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
        imageUris,
        videoUri,
        visibility,
        swatchHex: kind === "swatch" ? swatchHex.trim().toUpperCase() : null,
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
      setError(
        humanizeError(e, "post-compose", "Je vondst kon niet geplaatst worden. Probeer het opnieuw.")
      );
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
              accessibilityRole="button"
              accessibilityLabel={kind ? "Terug" : "Sluiten"}
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
          {kind ? (
            <VisibilityRow value={visibility} onChange={setVisibility} />
          ) : null}
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

                {/* --- Een kleur --- */}
                {kind === "swatch" && (
                  <SwatchPicker value={swatchHex} onChange={setSwatchHex} />
                )}

                {/* --- Tekstsoorten --- */}
                {BODY_KINDS.includes(kind) && (
                  <Field
                    label={
                      kind === "note" ? "De notitie"
                      : kind === "idea" ? "Het idee"
                      : kind === "fragment" ? "Het fragment"
                      : kind === "quote" ? "Het citaat"
                      : "Het weetje"
                    }
                  >
                    <FormatBar
                      value={body}
                      selection={selection}
                      onChange={onFormat}
                    />
                    <TextInput
                      ref={bodyRef}
                      value={body}
                      onChangeText={onBodyChange}
                      onSelectionChange={(e) =>
                        setSelection(e.nativeEvent.selection)
                      }
                      selection={forcedSelection ?? undefined}
                      placeholder={
                        kind === "note" ? "Schrijf iets, of tik over wat je las…"
                        : kind === "idea" ? "Wat zou je willen maken?"
                        : kind === "fragment" ? "Tik over of plak wat je las…"
                        : "Wat wist je nog niet?"
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
                    <CharCount value={body} max={2000} />
                    {/* Eén regel uitleg is genoeg: de knoppen zeggen wat ze
                        doen, maar niet dat je het ook zelf kunt typen — en
                        wie plakt uit een andere app heeft de sterretjes vaak
                        al staan. */}
                    <Meta tone="feed" dim>
                      Selecteer tekst en tik B of I. Of typ **vet**, *cursief*,
                      &gt; voor een citaat, - of 1. voor een opsomming — Enter
                      zet die vanzelf voort.
                    </Meta>
                  </Field>
                )}

                {/* --- Foto --- */}
                {kind === "image" && (
                  <View>
                    {imageUris.length > 0 ? (
                      <View>
                        <SafeImage
                          uri={imageUris[0]}
                          style={{ width: "100%", aspectRatio: 1 }}
                          contentFit="cover"
                          fallbackBg="bg-feed-fill"
                          fallbackColor={feed.inkDim}
                        />

                        {/* De rest van het album als strook eronder. */}
                        {imageUris.length > 1 && (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={{ gap: 6, padding: 6 }}
                          >
                            {imageUris.slice(1).map((uri, i) => (
                              <Pressable
                                key={`${uri}-${i}`}
                                onPress={() =>
                                  setImageUris((prev) => prev.filter((_, idx) => idx !== i + 1))
                                }
                              >
                                <SafeImage
                                  uri={uri}
                                  style={{ width: 72, height: 72 }}
                                  contentFit="cover"
                                  fallbackBg="bg-feed-fill"
                                  fallbackColor={feed.inkDim}
                                />
                              </Pressable>
                            ))}
                          </ScrollView>
                        )}

                        {/* Eén knop met twee namen: bij één foto stond er
                            "Meer foto's" en bij twee "Meer toevoegen",
                            terwijl hij allebei de keren precies hetzelfde
                            doet. Dan leer je hem niet herkennen maar lees je
                            hem elke keer opnieuw. En "Verwijder" ernaast
                            terwijl de rest van de app "Verwijderen" zegt. */}
                        <View className="flex-row px-6 py-4">
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Meer foto's toevoegen"
                            onPress={() => pickImage(false)}
                          >
                            <Meta tone="feed" strong>
                              Meer toevoegen
                            </Meta>
                          </Pressable>
                          <Meta tone="feed" dim style={{ marginHorizontal: 10 }}>/</Meta>
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel="Alle gekozen foto's verwijderen"
                            onPress={() => setImageUris([])}
                          >
                            <Meta tone="feed" dim>Verwijderen</Meta>
                          </Pressable>
                          {imageUris.length > 1 && (
                            <Meta tone="feed" dim style={{ marginLeft: 12 }}>
                              {`${imageUris.length} foto's · tik om er een weg te halen`}
                            </Meta>
                          )}
                        </View>
                        {videoUri ? <ClipRow onRemove={() => setVideoUri(null)} /> : null}
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
                {/* --- Bron: alleen waar het zin heeft --- */}
                {(kind === "note" || kind === "fragment" || kind === "link") && (
                  <View className="px-6 pt-7">
                    <Meta tone="feed" dim>
                      {kind === "link" ? "Bron" : "Bron — wie schreef het, en waarin"}
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

                {/*
                    --- Toelichting ---

                    Eén naam voor dit veld, en dat is "toelichting".

                    `post.caption` heette op vier plekken vier dingen:
                    "TITEL"/"ONDERSCHRIFT" op de detailpagina, "Toelichting"
                    in het menu van de feed, "Bijschrift" hier, en "de kop"
                    in een placeholder. Dat is één veld dat je vier keer
                    opnieuw moet herkennen — en de plek waar je het bewerkt
                    ("Toelichting bewerken") heette weer anders dan de plek
                    waar je het invult.
                */}
                {kind !== "note" && (
                  <Field label="Toelichting">
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
                        // Stond op `inkDim` — dezelfde kleur als de
                        // placeholder ernaast, dus je kon niet zien of je
                        // al iets getypt had. Elk ander veld op dit scherm
                        // staat op `ink`.
                        color: feed.ink,
                        paddingVertical: 11,
                      }}
                    />
                    <CharCount value={note} max={500} />
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
    setImageUris([]);
    setPreview(null);
    setError(null);
    lastUnfurled.current = "";
  }
}

// ---------------------------------------------------------------
// Bouwstenen
// ---------------------------------------------------------------

/** Label boven, invoer eronder, haarlijn onderaan. Geen doos. */
/**
 * De gekozen clip, als regel onder de foto's.
 *
 * Geen voorbeeldbeeld: een still uit een clip halen vraagt een extra
 * bibliotheek, en wat je hier nodig hebt is niet zien wélke video het is —
 * je hebt hem net zelf gekozen — maar dát er een aan hangt, en de weg om
 * hem er weer af te halen.
 */
/**
 * De kleurkiezer.
 *
 * Twaalf stalen en een veld. Geen kleurenwiel: je zoekt hier geen precieze
 * waarde maar een kleur die ergens bij hoort, en dan is kiezen sneller dan
 * mikken. Wie tóch een exacte kleur wil typt hem — daar is het veld voor,
 * en dat is ook de plek waar je een kleur uit een foto in plakt.
 *
 * Het grote vlak bovenaan is geen versiering maar de enige eerlijke
 * voorbeschouwing: een staal van veertig punten liegt over hoe een kleur
 * op een bord van driehonderd overkomt.
 */
function SwatchPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}) {
  const valid = /^#[0-9a-fA-F]{6}$/.test(value.trim());
  return (
    <View className="px-6 py-5">
      <View
        style={{
          width: "100%",
          aspectRatio: 2.4,
          backgroundColor: valid ? value : feed.postFill,
          borderWidth: FEED_BORDER,
          borderColor: feed.ink,
          marginBottom: space.lg,
        }}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {SWATCH_PRESETS.map((hex) => {
          const active = value.toUpperCase() === hex.toUpperCase();
          return (
            <Pressable
              key={hex}
              accessibilityRole="button"
              accessibilityLabel={`Kies ${hex}`}
              accessibilityState={{ selected: active }}
              onPress={() => onChange(hex)}
              style={{
                width: CONTROL_H,
                height: CONTROL_H,
                backgroundColor: hex,
                borderWidth: active ? 3 : FEED_BORDER,
                borderColor: feed.ink,
              }}
            />
          );
        })}
      </View>
      <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginTop: space.xl, marginBottom: space.sm }]}>
        OF TYP EEN KLEUR
      </Text>
      <TextInput
        value={value}
        onChangeText={(t) => onChange(t.startsWith("#") || t === "" ? t : `#${t}`)}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        accessibilityLabel="Hexkleur"
        placeholder="#E66B3F"
        placeholderTextColor={feed.inkDim}
        style={[
          feedType.body,
          {
            borderWidth: FEED_BORDER,
            borderColor: valid ? feed.ink : flameDeep,
            paddingHorizontal: space.md,
            height: CONTROL_H,
            color: feed.ink,
            ...(Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null),
          },
        ]}
      />
    </View>
  );
}

function ClipRow({ onRemove }: { onRemove: () => void }) {
  return (
    <View className="flex-row items-center px-6 pb-4" style={{ gap: space.sm }}>
      <Ionicons name="videocam" color={feed.ink} size={15} />
      <Meta tone="feed" strong>Clip toegevoegd</Meta>
      <View style={{ flex: 1 }} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clip verwijderen"
        onPress={onRemove}
        style={{ height: CONTROL_H, justifyContent: "center" }}
      >
        <Meta tone="feed" dim>Verwijderen</Meta>
      </Pressable>
    </View>
  );
}

/**
 * Waar deze vondst heen gaat: naar de feed van je lincs, of alleen naar je
 * eigen bord.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN KEUZE IS EN GEEN INSTELLING
 * ---------------------------------------------------------------
 * Een moodboard vullen en iets delen zijn twee verschillende bewegingen.
 * Zolang élke vondst de feed in ging, kostte veertig dingen verzamelen
 * veertig meldingen bij je vrienden — en dan verzamel je niets meer. De
 * vraag hoort dus bij het plaatsen zelf, niet weggestopt in je profiel.
 *
 * `feed` blijft de standaard. Dat is wat de app tot nu toe deed, en een
 * standaard die stilzwijgend van betekenis verandert is erger dan geen
 * keuze aanbieden.
 *
 * Dezelfde gesegmenteerde strip als de tabstrip in de kop en de
 * modus-keuze op het inlogscherm — één vorm voor "kies er één van twee".
 */
function VisibilityRow({
  value,
  onChange,
}: {
  value: PostVisibility;
  onChange: (next: PostVisibility) => void;
}) {
  const options: { id: PostVisibility; label: string; hint: string }[] = [
    { id: "feed", label: "In de feed", hint: "Je lincs zien hem" },
    { id: "profile", label: "Alleen op mijn bord", hint: "Stil, niet verborgen" },
  ];
  return (
    <View className="px-6 pb-4">
      <View
        style={{
          flexDirection: "row",
          borderWidth: FEED_BORDER,
          borderColor: feed.ink,
        }}
      >
        {options.map((opt) => {
          const active = value === opt.id;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="tab"
              accessibilityLabel={`${opt.label}. ${opt.hint}`}
              accessibilityState={{ selected: active }}
              onPress={() => onChange(opt.id)}
              style={{
                flex: 1,
                minHeight: CONTROL_H,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: space.sm,
                backgroundColor: active ? feed.ink : "transparent",
              }}
            >
              <Text
                style={[
                  feedType.label,
                  { color: active ? creamOnDark.DEFAULT : feed.ink },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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
        <View style={{ width: "100%", aspectRatio: 4 / 5, backgroundColor: feed.postFill }}>
          <SafeImage
            uri={preview.image_url}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            fallbackBg="bg-feed-fill"
            fallbackColor={feed.textDim}
          />
          {/* Een gevulde band en geen sluier — hier stonden drie gestapelde
              zwarte vlakken met oplopende dekking, precies het verloop dat
              §4 nergens kent. Zie components/PostGrid.tsx. */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: feed.ink,
              padding: 20,
            }}
          >
              <Text
                style={[
                  feedType.kicker,
                  { color: creamOnDark.DEFAULT, opacity: 0.75, letterSpacing: 0.55, marginBottom: 8 },
                ]}
                numberOfLines={1}
              >
                {extra.toUpperCase()}
              </Text>
              {preview.title ? (
                <Text style={[feedType.cover, { color: creamOnDark.DEFAULT }]} numberOfLines={4}>
                  {preview.title}
                </Text>
              ) : null}
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

