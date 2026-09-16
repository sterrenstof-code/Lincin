import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { SafeImage } from "@/components/SafeImage";
import type { Compose } from "@/app/post-compose";
import { color, friendColor, HUES, useScheme } from "@/lib/design/theme";
import { mono, sans, serif } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { safeBack } from "@/lib/nav";

import { DesktopShell, DesktopTitle, MonoLink } from "./Shell";

/**
 * Nieuwe bijdrage op desktop (Lincin Desktop.dc.html, COMPOSE): titel
 * "Nieuwe bijdrage" met ANNULEER rechts; links het beeld van 400 met een
 * regel erboven ("jij · foto" en "№ 24"), rechts de titel in serif 36 op
 * een inktlijn, één zin, de kleur als vierkantjes van 28, de soort als
 * mono-links, en onderaan KLAD en DEEL MET JE VRIENDEN →.
 */

const KINDS = ["foto", "krabbel", "tekst", "spraak", "poll", "link", "plek", "muziek"] as const;
const SUPPORTED = new Set(["foto", "tekst", "link", "muziek", "poll"]);

export function DesktopCompose({ c }: { c: Compose }) {
  const t = useT();
  const scheme = useScheme();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const web = Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null;

  return (
    <DesktopShell active="feed">
      <DesktopTitle right={<MonoLink label={t.cancel} active onPress={() => safeBack(c.router, "/feed")} />}>{t.newPost}</DesktopTitle>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 22, paddingHorizontal: 48, paddingBottom: 40, flexDirection: "row", gap: 28, alignItems: "flex-start" }}>
        {/* links: het beeld */}
        <View style={{ flex: 1.2, minWidth: 0, gap: 12 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View style={{ width: 8, height: 8, backgroundColor: c.fc.fill }} />
              <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase", color: dim }]}>
                {t.me} · {c.kind}
              </Text>
            </View>
            <Text style={[mono(500), { fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase", color: dim }]}>№ {c.number}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kies een beeld"
            onPress={c.kind === "foto" || c.kind === "krabbel" ? c.pickImage : undefined}
            style={{ height: 400, borderWidth: 1, borderColor: rule, backgroundColor: color("paper2"), alignItems: "center", justifyContent: "center", padding: 24, overflow: "hidden" }}
          >
            {c.slotImage ? (
              <SafeImage uri={c.slotImage} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            ) : c.kind === "tekst" && c.body.trim() ? (
              <Text style={[serif(), { fontSize: 22, lineHeight: 28, color: ink }]} numberOfLines={12}>
                {c.body}
              </Text>
            ) : (
              <Text style={[serif(true), { fontSize: 17, lineHeight: 21, color: dim, textAlign: "center" }]}>
                {c.kind === "foto" ? "foto · tik om te kiezen" : c.kind === "tekst" ? "de tekst zelf" : c.kind === "link" ? "beeld van de link" : "hoes"}
              </Text>
            )}
          </Pressable>
          {c.kind === "tekst" ? (
            <TextInput
              value={c.body}
              onChangeText={c.setBody}
              placeholder="De tekst zelf…"
              placeholderTextColor={dim}
              multiline
              style={[serif(), { fontSize: 19, lineHeight: 24, minHeight: 120, padding: 12, textAlignVertical: "top", borderWidth: 1, borderColor: rule, color: ink }, web as object]}
            />
          ) : null}
        </View>

        {/* rechts: titel, zin, kleur, soort */}
        <View style={{ flex: 0.8, minWidth: 280, gap: 22 }}>
          <TextInput
            value={c.title}
            onChangeText={c.setTitle}
            placeholder={t.titlePh}
            placeholderTextColor={dim}
            style={[serif(), { fontSize: 36, lineHeight: 40, height: 60, letterSpacing: -0.72, borderBottomWidth: 1, borderBottomColor: ink, color: ink }, web as object]}
          />
          <TextInput
            value={c.caption}
            onChangeText={c.setCaption}
            placeholder={t.captionPh}
            placeholderTextColor={dim}
            style={[sans(), { fontSize: 16, lineHeight: 20, height: 44, borderBottomWidth: 1, borderBottomColor: rule, color: ink }, web as object]}
          />
          {c.kind === "link" || c.kind === "muziek" ? (
            <TextInput
              value={c.url}
              onChangeText={c.setUrl}
              placeholder={c.kind === "muziek" ? "Link naar het nummer (Spotify, Bandcamp…)" : "https://…"}
              placeholderTextColor={dim}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[mono(500), { fontSize: 12, lineHeight: 16, height: 44, borderBottomWidth: 1, borderBottomColor: rule, color: ink }, web as object]}
            />
          ) : null}
          <View>
            <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 0.6, textTransform: "uppercase", color: dim, marginBottom: 6 }]}>{t.color}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {HUES.map((h) => {
                const fc = friendColor(h, scheme);
                const on = h === c.hue;
                return (
                  <Pressable key={h} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={h} onPress={() => c.setHue(h)} style={{ padding: 3, borderWidth: 1, borderColor: on ? ink : "transparent" }}>
                    <View style={{ width: 28, height: 28, backgroundColor: fc.fill, borderWidth: 1, borderColor: ink }} />
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 0.6, textTransform: "uppercase", color: dim, marginBottom: 6 }]}>{t.kind}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
              {KINDS.map((k) => (
                <MonoLink
                  key={k}
                  label={k}
                  on={k === c.kind}
                  active={k === c.kind}
                  onPress={SUPPORTED.has(k) ? () => (k === "poll" ? c.router.push("/poll-compose") : c.setKind(k)) : undefined}
                />
              ))}
            </View>
          </View>
          {c.error ? <Text style={[mono(500), { fontSize: 10, lineHeight: 13, color: color("red") }]}>{c.error}</Text> : null}
          <View style={{ flexDirection: "row", gap: 24, marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: ink }}>
            <MonoLink label={t.draft} on={false} active onPress={c.dirty && !c.submitting ? c.keep : undefined} />
            <Pressable accessibilityRole="button" onPress={c.publish} disabled={!c.canSubmit}>
              <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", textDecorationLine: "underline", color: c.published ? c.green : c.canSubmit ? ink : dim }]}>
                {c.published ? t.published : t.publish} →
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </DesktopShell>
  );
}
