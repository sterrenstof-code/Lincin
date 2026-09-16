import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { LincinScreen, TopRow } from "@/components/lincin/Chrome";
import { BackChip, BORDER, Box, Btn, GUTTER, Mono, Serif, VerticalLabel } from "@/components/lincin/ui";
import { SafeImage } from "@/components/SafeImage";
import { createFind, type FindKind } from "@/lib/api/posts";
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

/**
 * Nieuwe bijdrage (README §10).
 *
 * Bovenaan de poster zoals hij straks op de kaart staat: links een paneel
 * in de gekozen kleur met de soort gedraaid, rechts het beeld. Daaronder
 * de titel (groot, alleen een onderstreep), één zin, de kleur, de soort.
 * Onderaan `KLAD` en `DEEL MET JE VRIENDEN` → "GEDEELD ✓".
 *
 * Wat de backend nu draagt: foto, tekst, link, muziek (een link naar een
 * nummer) en poll (via het bestaande pollscherm). Krabbel, spraak en plek
 * staan er als soort bij maar zijn nog niet aan te zetten.
 */

type Kind = "foto" | "krabbel" | "tekst" | "spraak" | "poll" | "link" | "plek" | "muziek";
const KINDS: Kind[] = ["foto", "krabbel", "tekst", "spraak", "poll", "link", "plek", "muziek"];
const SUPPORTED = new Set<Kind>(["foto", "tekst", "link", "muziek", "poll"]);

type Draft = { kind: Kind; title: string; caption: string; body: string; url: string; hue: Hue };

export default function ComposeScreen() {
  usePageTitle("Nieuwe bijdrage");
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const scheme = useScheme();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const draftKey = `lincin.draft.${myUserId}`;

  const [kind, setKind] = useState<Kind>("foto");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("");
  const [hue, setHue] = useState<Hue>(hueFor(myUserId));
  const [imageUri, setImageUri] = useState<string | null>(null);
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

  const dirty = !!(title.trim() || caption.trim() || body.trim() || url.trim() || imageUri);
  useUnsavedGuard(dirty && !submitting && !published && !kept, {
    message: "Je bijdrage is nog niet gedeeld. Weggaan betekent dat je hem kwijt bent — of bewaar hem als klad.",
  });

  async function pickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsMultipleSelection: false });
    const uri = result.canceled ? null : result.assets?.[0]?.uri ?? null;
    if (uri) {
      setImageUri(uri);
      if (kind !== "foto") setKind("foto");
    }
  }

  async function keep() {
    const d: Draft = { kind, title, caption, body, url, hue };
    await AsyncStorage.setItem(draftKey, JSON.stringify(d)).catch(() => {});
    setKept(true);
    safeBack(router, "/feed");
  }

  const canSubmit =
    !submitting &&
    (kind === "foto" ? !!imageUri || !!caption.trim() : kind === "tekst" ? !!(body.trim() || caption.trim() || title.trim()) : !!url.trim());

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
      await createFind({
        userId: myUserId,
        kind: findKind(),
        imageUri: kind === "foto" ? imageUri ?? undefined : undefined,
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

  return (
    <LincinScreen
      tab="feed"
      tint={fc.fill}
      header={
        <TopRow
          left={<BackChip label={`× ${t.cancel}`} onPress={() => safeBack(router, "/feed")} />}
          right={
            <Mono variant="micro" tone="dim">
              {t.newPost} · {kind}
            </Mono>
          }
        />
      }
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: GUTTER, paddingTop: 14, gap: 16 }} keyboardShouldPersistTaps="handled">
          {/* de poster */}
          <Box style={{ flexDirection: "row", height: 300 }}>
            <View
              onLayout={(e) => setPanelW(e.nativeEvent.layout.width)}
              style={{ width: "36%", backgroundColor: fc.fill, borderRightWidth: BORDER, borderRightColor: color("ink"), overflow: "hidden" }}
            >
              <VerticalLabel
                text={kind}
                width={panelW}
                height={297}
                color={fc.ink}
                style={{ fontFamily: lincinType.cardTitle.fontFamily, fontSize: 26, lineHeight: 14, textTransform: "uppercase", textAlign: "center" }}
              />
              <Mono variant="micro" color={fc.ink} style={{ position: "absolute", top: 10, left: 10 }}>
                {t.post}
              </Mono>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Kies een beeld"
              onPress={kind === "foto" || kind === "krabbel" ? pickImage : undefined}
              style={{ flex: 1, backgroundColor: color("paper2"), alignItems: "center", justifyContent: "center", padding: 16 }}
            >
              {slotImage ? (
                <SafeImage uri={slotImage} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : kind === "tekst" && body.trim() ? (
                <Serif variant="quote" numberOfLines={9}>
                  {body}
                </Serif>
              ) : (
                <Serif variant="aside" tone="dim" style={{ textAlign: "center" }}>
                  {kind === "foto" ? "foto · tik om te kiezen" : kind === "tekst" ? "de tekst zelf" : kind === "link" ? "beeld van de link" : "hoes"}
                </Serif>
              )}
            </Pressable>
          </Box>

          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={t.titlePh}
            placeholderTextColor={color("ink", "inkDim")}
            autoCapitalize="characters"
            style={[
              lincinType.cardTitle,
              { fontSize: 26, lineHeight: 30, height: 48, borderBottomWidth: BORDER, borderBottomColor: color("ink"), color: color("ink"), ...(Platform.OS === "web" ? { outlineWidth: 0 } : null) } as object,
            ]}
          />
          <TextInput
            value={caption}
            onChangeText={setCaption}
            placeholder={t.captionPh}
            placeholderTextColor={color("ink", "inkDim")}
            style={[
              lincinType.quote,
              { height: 44, borderBottomWidth: BORDER, borderBottomColor: color("ink"), color: color("ink"), ...(Platform.OS === "web" ? { outlineWidth: 0 } : null) } as object,
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
                { minHeight: 120, padding: 12, textAlignVertical: "top", borderWidth: BORDER, borderColor: color("ink"), color: color("ink"), ...(Platform.OS === "web" ? { outlineWidth: 0 } : null) } as object,
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
                { height: 44, paddingHorizontal: 12, borderWidth: BORDER, borderColor: color("ink"), color: color("ink"), ...(Platform.OS === "web" ? { outlineWidth: 0 } : null) } as object,
              ]}
            />
          ) : null}

          <View>
            <Mono variant="micro" tone="dim" style={{ marginBottom: 6 }}>
              {t.color}
            </Mono>
            <View style={{ flexDirection: "row", borderWidth: BORDER, borderColor: color("ink") }}>
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
                    style={{ flex: 1, height: 40, backgroundColor: c.fill, alignItems: "center", justifyContent: "center", borderRightWidth: i < HUES.length - 1 ? BORDER : 0, borderRightColor: color("ink") }}
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
                    onPress={() => {
                      if (k === "poll") {
                        router.push("/poll-compose");
                        return;
                      }
                      setKind(k);
                    }}
                    style={{ height: 32, paddingHorizontal: 10, borderWidth: BORDER, borderColor: color("ink"), backgroundColor: on ? color("ink") : "transparent", justifyContent: "center", opacity: ok ? 1 : 0.4 }}
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
