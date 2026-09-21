import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { LincinScreen, TopRow } from "@/components/lincin/Chrome";
import { BORDER, Box, Btn, GUTTER, Mono, Serif, VerticalLabel, line } from "@/components/lincin/ui";
import { SafeImage } from "@/components/SafeImage";
import { createActivityEvent } from "@/lib/api/activity-events";
import { MAX_PHOTOS, POLL_MAX, POLL_MIN } from "@/lib/lincin/compose";
import { createPoll } from "@/lib/api/polls";
import { createFind, listUserPosts, type FindKind } from "@/lib/api/posts";
import { findUrl, unfurl, type LinkPreview } from "@/lib/api/unfurl";
import { useAuth } from "@/lib/auth/provider";
import { color, friendColor, HUES, hueFor, useScheme, type Hue } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { humanizeError } from "@/lib/errors";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";
import { invalidatePostCaches } from "@/lib/post-cache";
import { useUnsavedGuard } from "@/lib/unsaved";
import { DesktopCompose } from "@/components/lincin/desktop/DesktopCompose";
import { PhotoSlots } from "@/components/lincin/compose/PhotoSlots";
import { PollEditor } from "@/components/lincin/compose/PollEditor";
import { useIsDesktop } from "@/lib/lincin/desktop";

/**
 * Nieuwe bijdrage (README §10).
 *
 * Bovenaan de poster zoals hij straks op de kaart staat: links een paneel
 * in de gekozen kleur met de soort gedraaid, rechts het beeld. Daaronder
 * de titel (groot, alleen een onderstreep), één zin, de kleur, de soort.
 * Onderaan `KLAD` en `DEEL MET JE VRIENDEN` → "GEDEELD ✓".
 *
 * Wat de backend nu draagt: foto (tot 6, een album), tekst, link, muziek
 * (een link naar een nummer) en poll. Krabbel, spraak en plek staan er als
 * soort bij maar zijn nog niet aan te zetten.
 *
 * Nieuw in 2.1: `poll` opent geen apart scherm meer maar ruilt het
 * beeldvak voor een keuze-editor (2–4 keuzes, één stem ↔ meerdere); de
 * vraag is de titel. En een foto-bijdrage mag meerdere foto's dragen.
 */

type Kind = "foto" | "krabbel" | "tekst" | "spraak" | "poll" | "link" | "plek" | "muziek";
const KINDS: Kind[] = ["foto", "krabbel", "tekst", "spraak", "poll", "link", "plek", "muziek"];
const SUPPORTED = new Set<Kind>(["foto", "tekst", "link", "muziek", "poll"]);

type Draft = { kind: Kind; title: string; caption: string; body: string; url: string; hue: Hue };

/**
 * Wat een nieuwe bijdrage is en kan: de velden, het klad, het delen —
 * los van hoe het scherm eruitziet. De telefoon (hieronder) en desktop
 * (`components/lincin/desktop/DesktopCompose.tsx`) tekenen er elk hun
 * eigen blad omheen.
 */
export function useCompose() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const scheme = useScheme();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const draftKey = `lincin.draft.${myUserId}`;
  // "№ 24": de bijdrage die dit wordt — één meer dan je er al hebt.
  const mine = useQuery({ queryKey: ["posts-by-user", myUserId], queryFn: () => listUserPosts(myUserId, 200), staleTime: 60_000 });
  const number = String((mine.data?.length ?? 0) + 1).padStart(2, "0");

  const [kind, setKind] = useState<Kind>("foto");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [hue, setHue] = useState<Hue>(hueFor(myUserId));
  const [imageUris, setImageUris] = useState<string[]>([]);
  const imageUri = imageUris[0] ?? null;
  const setImageUri = (uri: string | null) => setImageUris(uri ? [uri] : []);
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [pollMulti, setPollMulti] = useState(false);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kept, setKept] = useState(false);
  const fc = friendColor(hue, scheme);

  // Wat er via "delen met…" binnenkomt (share target).
  const shared = useLocalSearchParams<{ title?: string; text?: string; url?: string }>();
  const sharedHandled = useRef(false);
  useEffect(() => {
    if (sharedHandled.current) return;
    const text = typeof shared.text === "string" ? shared.text : "";
    const u = typeof shared.url === "string" ? shared.url : findUrl(text) ?? "";
    const ti = typeof shared.title === "string" ? shared.title : "";
    if (!text && !u && !ti) return;
    sharedHandled.current = true;
    if (u) {
      setKind("link");
      setUrl(u);
    }
    if (ti) setTitle(ti);
    if (text && text !== u) setCaption(text);
  }, [shared.text, shared.url, shared.title]);

  // Een bewaard klad komt terug.
  useEffect(() => {
    AsyncStorage.getItem(draftKey)
      .then((raw) => {
        if (!raw || sharedHandled.current) return;
        const d = JSON.parse(raw) as Partial<Draft>;
        if (d.kind && KINDS.includes(d.kind)) setKind(d.kind);
        if (d.title) setTitle(d.title);
        if (d.caption) setCaption(d.caption);
        if (d.body) setBody(d.body);
        if (d.url) setUrl(d.url);
        if (d.hue && HUES.includes(d.hue)) setHue(d.hue);
        setKept(true);
      })
      .catch(() => {});
  }, [draftKey]);

  // Een link ontvouwen zodra hij er staat.
  const lastUnfurled = useRef("");
  useEffect(() => {
    if (kind !== "link" && kind !== "muziek") return;
    const u = url.trim();
    if (!u || u === lastUnfurled.current || !/^https?:\/\//i.test(u)) return;
    lastUnfurled.current = u;
    unfurl(u)
      .then((p) => {
        setPreview(p);
        if (p?.kind === "music") setKind("muziek");
        if (p?.title && !title) setTitle(p.title);
      })
      .catch(() => setPreview(null));
  }, [url, kind, title]);

  const dirty = !!(
    title.trim() ||
    caption.trim() ||
    body.trim() ||
    url.trim() ||
    imageUris.length ||
    (kind === "poll" && pollOptions.some((o) => o.trim()))
  );
  useUnsavedGuard(dirty && !submitting && !published && !kept, {
    message: "Je bijdrage is nog niet gedeeld. Weggaan betekent dat je hem kwijt bent — of bewaar hem als klad.",
  });

  /**
   * Foto's kiezen, tot er zes zijn. Een lege bijdrage begint bij de eerste;
   * `+ foto erbij` vult aan.
   */
  async function addPhotos() {
    const room = MAX_PHOTOS - imageUris.length;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
      orderedSelection: true,
    });
    const picked = result.canceled ? [] : (result.assets ?? []).map((a) => a.uri).filter(Boolean);
    if (picked.length) {
      // De soort blijft wat hij was: de fotobalk staat bij elke soort.
      setImageUris((u) => [...u, ...picked].slice(0, MAX_PHOTOS));
    }
  }

  /** De eerste foto opnieuw kiezen, als het vak nog leeg is. */
  const pickImage = addPhotos;

  /** `−` haalt de laatste weg, zoals in het prototype. */
  function removePhoto(index = imageUris.length - 1) {
    setImageUris((u) => u.filter((_, i) => i !== index));
  }

  function setPollOption(i: number, text: string) {
    setPollOptions((o) => o.map((v, j) => (j === i ? text : v)));
  }
  function addPollOption() {
    setPollOptions((o) => (o.length >= POLL_MAX ? o : [...o, ""]));
  }
  function removePollOption(i: number) {
    setPollOptions((o) => (o.length <= POLL_MIN ? o : o.filter((_, j) => j !== i)));
  }

  async function keep() {
    const d: Draft = { kind, title, caption, body, url, hue };
    await AsyncStorage.setItem(draftKey, JSON.stringify(d)).catch(() => {});
    setKept(true);
    safeBack(router, "/feed");
  }

  const filledOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
  const canSubmit =
    !submitting &&
    (kind === "foto"
      ? !!imageUri || !!caption.trim()
      : kind === "tekst"
        ? !!(body.trim() || caption.trim() || title.trim())
        : kind === "poll"
          ? !!title.trim() && filledOptions.length >= POLL_MIN
          : !!url.trim());

  function findKind(): FindKind {
    switch (kind) {
      case "foto":
        return "image";
      case "tekst":
        return "note";
      case "muziek":
        return "music";
      case "link":
        return preview?.kind === "video" ? "video" : preview?.kind === "music" ? "music" : "link";
      default:
        return "note";
    }
  }

  async function publish() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (kind === "poll") {
        // De vraag is de titel; lege keuzes tellen niet mee.
        const poll = await createPoll({
          userId: myUserId,
          question: title.trim(),
          options: filledOptions,
          allowMultiple: pollMulti,
        });
        await createActivityEvent({ actorId: myUserId, kind: "post_created", postId: poll.id });
        await AsyncStorage.removeItem(draftKey).catch(() => {});
        setPublished(true);
        await invalidatePostCaches(qc);
        setTimeout(() => safeBack(router, "/feed"), 1200);
        return;
      }
      await createFind({
        userId: myUserId,
        kind: findKind(),
        // Foto's gaan mee bij elke soort die ze kreeg (de balk staat overal).
        imageUris: imageUris.length ? imageUris : undefined,
        caption: caption.trim() || null,
        bodyText: kind === "tekst" ? body.trim() || null : null,
        linkUrl: kind === "link" || kind === "muziek" ? url.trim() || null : null,
        sourceTitle: title.trim() || null,
        meta: preview ? { ...preview, swatch: hue } as Partial<LinkPreview> : ({ swatch: hue } as Partial<LinkPreview>),
        visibility: "feed",
      });
      await AsyncStorage.removeItem(draftKey).catch(() => {});
      setPublished(true);
      await invalidatePostCaches(qc);
      setTimeout(() => safeBack(router, "/feed"), 1200);
    } catch (e) {
      setError(humanizeError(e, "post-compose", "Je bijdrage kon niet gedeeld worden. Probeer het opnieuw."));
      setSubmitting(false);
    }
  }

  const slotImage = kind === "foto" ? imageUri : preview?.image_url ?? null;
  const [panelW, setPanelW] = useState(0);
  const green = friendColor("green", scheme).fill;

  return { router, qc, t, scheme, myUserId, number, kind, setKind, title, setTitle, caption, setCaption, body, setBody, url, setUrl, hue, setHue, imageUri, setImageUri, imageUris, addPhotos, removePhoto, pollOptions, setPollOption, addPollOption, removePollOption, pollMulti, setPollMulti, preview, submitting, published, error, kept, fc, pickImage, keep, canSubmit, publish, slotImage, panelW, setPanelW, green, dirty };
}

export type Compose = ReturnType<typeof useCompose>;

export default function ComposeScreen() {
  usePageTitle("Nieuwe bijdrage");
  const desktop = useIsDesktop();
  const c = useCompose();
  const [panelH, setPanelH] = useState(297);
  const { t, scheme, number, kind, setKind, title, setTitle, caption, setCaption, body, setBody, url, setUrl, hue, setHue, submitting, published, error, fc, keep, canSubmit, publish, slotImage, panelW, setPanelW, green, dirty } = c;
  if (desktop) return <DesktopCompose c={c} />;
  return (
    <LincinScreen
      tab="feed"
      tint={fc.fill}
      tabTint={null}
      counter={t.newPost}
      back="/feed"
      header={
        <TopRow
          right={
            <Mono variant="micro" tone="dim">
              {t.newPost} · № {number}
            </Mono>
          }
        />
      }
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: GUTTER, paddingTop: 14, gap: 16 }} keyboardShouldPersistTaps="handled">
          {/* de poster — bij een poll met de keuze-editor rechts (2.1) */}
          <Box style={kind === "poll" ? { flexDirection: "row", minHeight: 300 } : { flexDirection: "row", height: 300 }}>
            <View
              onLayout={(e) => {
                setPanelW(e.nativeEvent.layout.width);
                setPanelH(e.nativeEvent.layout.height - 3);
              }}
              style={{ width: "36%", backgroundColor: fc.fill, borderRightWidth: BORDER, borderRightColor: line(), overflow: "hidden" }}
            >
              <VerticalLabel
                text={kind}
                width={panelW}
                height={kind === "poll" ? Math.max(297, panelH) : 297}
                color={fc.ink}
                style={{ fontFamily: lincinType.cardTitle.fontFamily, fontSize: 26, lineHeight: 14, textTransform: "uppercase", textAlign: "center" }}
              />
              <Mono variant="micro" color={fc.ink} style={{ position: "absolute", top: 10, left: 10, textTransform: "none", letterSpacing: 0 }}>
                {number}
              </Mono>
            </View>
            {kind === "poll" ? (
              <PollEditor c={c} />
            ) : (
              // De fotobalk (+ foto erbij / −) staat bij élke soort behalve
              // poll, zoals in het prototype. Zonder foto's toont het vak wat
              // bij de soort hoort: de tekst, het beeld van de link, de hoes.
              <PhotoSlots
                c={c}
                placeholder={
                  kind === "foto" || kind === "krabbel"
                    ? "foto · tik om te kiezen"
                    : kind === "tekst"
                      ? "de tekst zelf"
                      : kind === "link"
                        ? "beeld van de link"
                        : "hoes"
                }
                preview={
                  slotImage && kind !== "foto" ? (
                    <SafeImage uri={slotImage} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                  ) : kind === "tekst" && body.trim() ? (
                    <Serif variant="quote" numberOfLines={9} style={{ padding: 16 }}>
                      {body}
                    </Serif>
                  ) : null
                }
                emptyPicks={kind === "foto" || kind === "krabbel"}
              />
            )}
          </Box>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t.titlePh}
            placeholderTextColor={color("ink", "inkDim")}
            autoCapitalize="characters"
            style={[
              lincinType.cardTitle,
              { fontSize: 26, lineHeight: 30, height: 48, borderBottomWidth: BORDER, borderBottomColor: line(), color: color("ink"), ...(Platform.OS === "web" ? { outlineWidth: 0 } : null) } as object,
            ]}
          />
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={t.captionPh}
            placeholderTextColor={color("ink", "inkDim")}
            style={[
              lincinType.quote,
              { height: 44, borderBottomWidth: BORDER, borderBottomColor: line(), color: color("ink"), ...(Platform.OS === "web" ? { outlineWidth: 0 } : null) } as object,
            ]}
          />
          {kind === "tekst" ? (
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="De tekst zelf…"
              placeholderTextColor={color("ink", "inkDim")}
              multiline
              style={[
                lincinType.quote,
                { minHeight: 120, padding: 12, textAlignVertical: "top", borderWidth: BORDER, borderColor: line(), color: color("ink"), ...(Platform.OS === "web" ? { outlineWidth: 0 } : null) } as object,
              ]}
            />
          ) : null}
          {kind === "link" || kind === "muziek" ? (
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder={kind === "muziek" ? "Link naar het nummer (Spotify, Bandcamp…)" : "https://…"}
              placeholderTextColor={color("ink", "inkDim")}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[
                lincinType.monoBody,
                { height: 44, paddingHorizontal: 12, borderWidth: BORDER, borderColor: line(), color: color("ink"), ...(Platform.OS === "web" ? { outlineWidth: 0 } : null) } as object,
              ]}
            />
          ) : null}

          <View>
            <Mono variant="micro" tone="dim" style={{ marginBottom: 6 }}>
              {t.color}
            </Mono>
            <View style={{ flexDirection: "row", borderWidth: BORDER, borderColor: line() }}>
              {HUES.map((h, i) => {
                const c = friendColor(h, scheme);
                const on = h === hue;
                return (
                  <Pressable
                    key={h}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={h}
                    onPress={() => setHue(h)}
                    style={{ flex: 1, height: 40, backgroundColor: c.fill, alignItems: "center", justifyContent: "center", borderRightWidth: i < HUES.length - 1 ? BORDER : 0, borderRightColor: line() }}
                  >
                    {on ? <View style={{ width: 10, height: 10, backgroundColor: c.ink }} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Mono variant="micro" tone="dim" style={{ marginBottom: 6 }}>
              {t.kind}
            </Mono>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {KINDS.map((k) => {
                const on = k === kind;
                const ok = SUPPORTED.has(k);
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on, disabled: !ok }}
                    disabled={!ok}
                    onPress={() => setKind(k)}
                    style={{ height: 32, paddingHorizontal: 10, borderWidth: BORDER, borderColor: line(), backgroundColor: on ? color("ink") : "transparent", justifyContent: "center", opacity: ok ? 1 : 0.4 }}
                  >
                    <Text style={[lincinType.monoBody, { color: on ? color("paper") : color("ink") }]}>{k}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {error ? (
            <Mono variant="micro" tone="red" style={{ textTransform: "none" }}>
              {error}
            </Mono>
          ) : null}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 8, paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 12 }}>
          <Btn label={t.draft} flex={1} onPress={keep} disabled={!dirty || submitting} />
          <Btn
            label={published ? t.published : t.publish}
            fill
            flex={1.6}
            onPress={publish}
            disabled={!canSubmit}
            bg={published ? green : undefined}
          />
        </View>
      </KeyboardAvoidingView>
    </LincinScreen>
  );
}
