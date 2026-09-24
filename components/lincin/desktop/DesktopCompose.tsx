import { useQuery } from "@tanstack/react-query";
import { Platform, Pressable, ScrollView, Text, TextInput, View, type TextStyle, type ViewStyle } from "react-native";

import type { Compose } from "@/app/post-compose";
import { PhotoSlots } from "@/components/lincin/compose/PhotoSlots";
import { PollEditor } from "@/components/lincin/compose/PollEditor";
import { SafeImage } from "@/components/SafeImage";
import { listMyFriendships } from "@/lib/api/friends";
import { HUES, OMSLAG, RASTER, color, friendColor, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { safeBack } from "@/lib/nav";

import { DesktopShell, PageHead } from "./Shell";

/**
 * Nieuwe bijdrage op desktop (desktop-*-pages.dc.html, NIEUWE BIJDRAGE).
 *
 * Drie kolommen: links de soort (240), in het midden het beeldvak van 420
 * met titel en onderschrift, rechts (380) jouw kleur, wie het ziet, hoe je
 * linc het ziet, en Delen. Elke theme tekent dezelfde kolommen:
 *
 *   kleur     inktkaders, soorten als rijen van 52 in Archivo 900 smal,
 *             kleuren als vierkanten, Delen als zuurgeel vlak.
 *   magazine  vlakken op het tweede papier, serif, ronde kleuren, Delen als
 *             inktbalk in serif.
 *   modern    tegels, soorten als pillen, Delen als inkttegel met ↑.
 *
 * "Wie ziet het" toont wat de backend kent: al je lincs. Delen met één
 * groep bestaat nog niet (docs/BACKEND-TODO.md).
 */

const KINDS = ["foto", "krabbel", "tekst", "spraak", "poll", "link", "plek", "muziek"] as const;
const SUPPORTED = new Set<string>(["foto", "tekst", "link", "muziek", "poll"]);
const STAGE_H = 420;
const SEAM = RASTER.seam;
const webField = Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null;

export function DesktopCompose({ c }: { c: Compose }) {
  const t = useT();
  const scheme = useScheme();
  const spec = useThemeSpec();
  const th = spec.id;
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const friendships = useQuery({ queryKey: ["friendships", c.myUserId], queryFn: () => listMyFriendships(c.myUserId), staleTime: 60_000 });
  const lincs = (friendships.data ?? []).filter((f) => f.status === "accepted").length;

  const label = (s: string) => (
    <Text style={th === "magazine" ? magLabel(10, dim) : [mono(th === "kleur" ? 600 : 500), { fontSize: th === "kleur" ? 10 : 9, lineHeight: 13, letterSpacing: th === "kleur" ? 1 : 1.44, textTransform: "uppercase", color: dim }]}>{s}</Text>
  );
  const panel = (extra?: ViewStyle): ViewStyle =>
    th === "kleur"
      ? { paddingVertical: 20, paddingHorizontal: 24, borderBottomWidth: spec.border, borderBottomColor: ink, gap: 12, ...extra }
      : th === "magazine"
        ? { paddingVertical: 22, paddingHorizontal: 24, backgroundColor: color("paper2"), gap: 12, ...extra }
        : { padding: 20, borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill"), gap: 12, ...extra };

  // ---- links: de soort ----
  const kinds = (
    <View
      style={[
        { width: 240 },
        th === "kleur" ? { borderRightWidth: spec.border, borderRightColor: ink } : null,
        th === "magazine" ? { paddingVertical: 10 } : null,
        th === "modern" ? { padding: 14, gap: 6, borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill") } : null,
      ]}
    >
      <View style={{ paddingTop: th === "kleur" ? 18 : 8, paddingHorizontal: th === "modern" ? 8 : 20, paddingBottom: 12 }}>{label(t.kind)}</View>
      {KINDS.map((k, i) => {
        const on = k === c.kind;
        const ok = SUPPORTED.has(k);
        return (
          <Pressable
            key={k}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, disabled: !ok }}
            disabled={!ok}
            onPress={() => c.setKind(k)}
            style={[
              { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: th === "modern" ? 16 : 20, backgroundColor: on ? ink : "transparent", opacity: ok ? 1 : 0.35 },
              th === "modern" ? { height: 46, borderRadius: 999, gap: 12 } : { height: th === "kleur" ? 52 : 50, borderTopWidth: 1, borderTopColor: rule },
            ]}
          >
            <Text style={[th === "magazine" ? sans(700) : mono(500), { fontSize: th === "modern" ? 9 : 10, lineHeight: 12, letterSpacing: th === "magazine" ? 1 : 0, color: on ? color("paper") : ink }]}>
              {String(i + 1).padStart(2, "0")}
            </Text>
            <Text style={[th === "kleur" ? head() : th === "magazine" ? serif() : sans(500), { fontSize: th === "kleur" ? 20 : th === "magazine" ? 24 : 16, lineHeight: th === "magazine" ? 26 : 20, color: on ? color("paper") : ink }]}>
              {k}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  // ---- midden: het beeld, titel en onderschrift ----
  const titleStyle: TextStyle =
    th === "kleur"
      ? { ...head(), fontSize: 48, lineHeight: 46 }
      : th === "magazine"
        ? { ...serif(), fontSize: 56, lineHeight: 56 }
        : { ...sans(400), fontSize: 48, lineHeight: 50, letterSpacing: -1.9 };
  const captionStyle: TextStyle =
    th === "modern" ? { ...sans(400), fontSize: 20, lineHeight: 26 } : { ...serif(th === "magazine"), fontSize: 24, lineHeight: 30 };
  const stage = (
    <View
      style={[
        { flex: 1, minWidth: 0, gap: th === "magazine" ? 24 : 22 },
        th === "kleur" ? { paddingVertical: 28, paddingHorizontal: 32 } : null,
        th === "magazine" ? { paddingVertical: 26, paddingHorizontal: 32, backgroundColor: color("paper2") } : null,
        th === "modern" ? { padding: 14, gap: 18, borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill") } : null,
      ]}
    >
      {c.kind === "poll" ? (
        <View style={[{ minHeight: STAGE_H, padding: 4 }, th === "kleur" ? { borderWidth: spec.border, borderColor: ink } : { borderRadius: th === "modern" ? 14 : 0, backgroundColor: color("paper") }]}>
          <PollEditor c={c} />
        </View>
      ) : (
        <View
          style={[
            { height: STAGE_H, overflow: "hidden" },
            th === "kleur" ? { borderWidth: spec.border, borderStyle: "dashed", borderColor: ink } : null,
            th === "modern" ? { borderRadius: 14 } : null,
            th !== "kleur" ? { backgroundColor: color("paper") } : null,
          ]}
        >
          <PhotoSlots
            c={c}
            placeholder={`${t.dropHere} · ${c.kind}`}
            preview={
              c.slotImage && c.kind !== "foto" ? (
                <SafeImage uri={c.slotImage} style={{ width: "100%", height: "100%" }} contentFit="cover" />
              ) : c.kind === "tekst" && c.body.trim() ? (
                <Text numberOfLines={12} style={[captionStyle, { padding: 18, color: ink }]}>
                  {c.body}
                </Text>
              ) : null
            }
            emptyPicks={c.kind === "foto" || c.kind === "krabbel"}
          />
        </View>
      )}
      <View style={th === "modern" ? { paddingHorizontal: 12, gap: 18 } : { gap: th === "magazine" ? 24 : 22 }}>
        <View style={{ gap: 6, paddingBottom: th === "modern" ? 0 : 12, borderBottomWidth: th === "modern" ? 0 : th === "kleur" ? spec.border : 1, borderBottomColor: ink }}>
          {label(t.titleLabel)}
          <TextInput value={c.title} onChangeText={c.setTitle} placeholder={t.titlePh} placeholderTextColor={rule} style={[titleStyle, { color: ink }, webField]} />
        </View>
        <View style={{ gap: 6, paddingBottom: th === "modern" ? 0 : 12, borderBottomWidth: th === "modern" ? 0 : 1, borderBottomColor: rule }}>
          {label(t.captionLabel)}
          <TextInput value={c.caption} onChangeText={c.setCaption} placeholder={t.captionPh} placeholderTextColor={dim} style={[captionStyle, { color: ink }, webField]} />
        </View>
        {c.kind === "tekst" ? (
          <TextInput
            value={c.body}
            onChangeText={c.setBody}
            placeholder={t.textPh}
            placeholderTextColor={dim}
            multiline
            style={[captionStyle, { minHeight: 120, padding: 12, textAlignVertical: "top", borderWidth: 1, borderColor: rule, borderRadius: th === "modern" ? 14 : 0, color: ink }, webField]}
          />
        ) : null}
        {c.kind === "link" || c.kind === "muziek" ? (
          <TextInput
            value={c.url}
            onChangeText={c.setUrl}
            placeholder={c.kind === "muziek" ? "Link naar het nummer (Spotify, Bandcamp…)" : "https://…"}
            placeholderTextColor={dim}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            style={[mono(500), { height: 44, fontSize: 12, lineHeight: 16, borderBottomWidth: 1, borderBottomColor: rule, color: ink }, webField]}
          />
        ) : null}
      </View>
    </View>
  );

  // ---- rechts: kleur, wie, voorbeeld, delen ----
  const shareLabel = th === "kleur" ? t.share : t.shareWithLincs;
  const side = (
    <View style={[{ width: 380 }, th === "kleur" ? { borderLeftWidth: spec.border, borderLeftColor: ink } : { gap: SEAM }]}>
      <View style={panel()}>
        {label(t.yourColor)}
        <View style={{ flexDirection: "row", gap: th === "kleur" ? 8 : 10, flexWrap: "wrap" }}>
          {HUES.map((h) => {
            const f = friendColor(h, scheme);
            const on = h === c.hue;
            const size = th === "kleur" ? 48 : 44;
            return (
              <Pressable
                key={h}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={h}
                onPress={() => c.setHue(h)}
                style={{ width: size, height: size, borderRadius: th === "kleur" ? 0 : size / 2, backgroundColor: f.fill, borderWidth: on ? 3 : th === "kleur" ? spec.border : 0, borderColor: ink }}
              />
            );
          })}
        </View>
      </View>
      <View style={panel()}>
        {label(t.whoSees)}
        <View
          style={[
            { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: th === "kleur" ? 14 : 18, backgroundColor: ink },
            th === "kleur" ? { borderWidth: spec.border, borderColor: ink } : th === "magazine" ? { borderWidth: 1, borderColor: ink } : { borderRadius: 22 },
          ]}
        >
          <Text style={[th === "kleur" ? head() : th === "magazine" ? serif() : sans(500), { fontSize: th === "kleur" ? 17 : th === "magazine" ? 20 : 15, lineHeight: 22, color: color("paper") }]}>{t.allLincs}</Text>
          <Text style={[th === "magazine" ? sans(700) : mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: th === "magazine" ? 1 : 0, color: color("paper") }]}>{lincs}</Text>
        </View>
      </View>
      <View style={panel({ flex: 1 })}>
        {label(t.howLincSees)}
        <View style={[{ overflow: "hidden", backgroundColor: color("paper") }, th === "kleur" ? { borderWidth: spec.border, borderColor: ink } : null, th === "modern" ? { borderRadius: 14 } : null]}>
          {th === "magazine" ? null : (
            <View style={{ height: th === "kleur" ? 120 : 110, backgroundColor: c.slotImage || c.imageUris[0] ? color("paper2") : th === "modern" ? c.fc.fill : color("paper2"), borderBottomWidth: th === "kleur" ? spec.border : 0, borderBottomColor: ink }}>
              {c.imageUris[0] || c.slotImage ? <SafeImage uri={(c.imageUris[0] ?? c.slotImage)!} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : null}
            </View>
          )}
          <View style={{ paddingVertical: th === "magazine" ? 16 : 12, paddingHorizontal: th === "magazine" ? 18 : 14, gap: 6, borderLeftWidth: th === "modern" ? 0 : th === "magazine" ? 5 : 6, borderLeftColor: c.fc.fill }}>
            <Text style={th === "magazine" ? magLabel(10, dim) : [mono(th === "kleur" ? 600 : 500), { fontSize: th === "kleur" ? 9.5 : 8.5, lineHeight: 12, letterSpacing: 1, textTransform: "uppercase", color: dim }]}>
              {t.me} · {c.kind} · {t.now}
            </Text>
            <Text numberOfLines={2} style={[th === "kleur" ? head() : th === "magazine" ? serif() : sans(500), { fontSize: th === "kleur" ? 20 : th === "magazine" ? 28 : 17, lineHeight: th === "magazine" ? 29 : 21, color: c.title ? ink : rule }]}>
              {c.title || t.titlePh}
            </Text>
          </View>
        </View>
      </View>
      {c.error ? <Text style={[mono(500), { paddingHorizontal: 24, fontSize: 10, lineHeight: 13, color: color("red") }]}>{c.error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        onPress={c.publish}
        disabled={!c.canSubmit}
        style={[
          { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 24, opacity: c.canSubmit || c.published ? 1 : 0.5 },
          th === "kleur"
            ? { height: 72, backgroundColor: c.published ? c.green : color("acid"), borderTopWidth: spec.border, borderTopColor: ink }
            : th === "magazine"
              ? // De omslag: de primaire actie is een rood vlak.
                { height: 64, backgroundColor: c.published ? c.green : color("red") }
              : { height: 64, paddingHorizontal: 22, borderRadius: RASTER.tileRadius, backgroundColor: c.published ? c.green : ink },
        ]}
      >
        <Text
          style={[
            th === "kleur" ? head() : th === "magazine" ? sans(800) : mono(500),
            th === "kleur"
              ? { fontSize: 26, lineHeight: 26, color: "#141414" }
              : th === "magazine"
                ? { fontSize: 18, lineHeight: 22, letterSpacing: 1.08, textTransform: "uppercase", color: OMSLAG.onImage }
                : { fontSize: 10, lineHeight: 13, letterSpacing: 1.4, textTransform: "uppercase", color: color("paper") },
          ]}
        >
          {c.published ? t.published : shareLabel}
        </Text>
        {th === "modern" ? (
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color("paper"), alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 16, lineHeight: 19, color: ink }}>↑</Text>
          </View>
        ) : (
          <Text style={{ fontSize: 22, lineHeight: 26, color: th === "kleur" ? "#141414" : th === "magazine" ? OMSLAG.onImage : color("paper") }}>→</Text>
        )}
      </Pressable>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 24, paddingVertical: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => safeBack(c.router, "/feed")}>
          <Text style={[th === "magazine" ? sans(700) : mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: dim, textDecorationLine: "underline" }]}>{t.cancel}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={!c.dirty || c.submitting} onPress={c.keep}>
          <Text style={[th === "magazine" ? sans(700) : mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: c.dirty ? ink : dim, textDecorationLine: "underline" }]}>{t.draft}</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <DesktopShell active="feed" tint={th === "modern" ? c.fc.fill : null}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={th === "modern" ? { gap: SEAM } : undefined} keyboardShouldPersistTaps="handled">
        <PageHead num="+" title={t.newPost} sub={`${t.forYourLincs} · № ${c.number}`} />
        <View style={[{ flexDirection: "row", alignItems: "stretch", minHeight: 700 }, th === "magazine" ? { gap: SEAM, padding: SEAM } : null, th === "modern" ? { gap: SEAM } : null]}>
          {kinds}
          {stage}
          {side}
        </View>
      </ScrollView>
    </DesktopShell>
  );
}

/** Het label van de omslag: Archivo 700, kapitaal, .1em. */
function magLabel(size: number, c: string): TextStyle {
  return { ...sans(700), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: size * 0.1, textTransform: "uppercase", color: c };
}
