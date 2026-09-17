import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import type { Compose } from "@/app/post-compose";
import { PhotoSlots } from "@/components/lincin/compose/PhotoSlots";
import { PollEditor } from "@/components/lincin/compose/PollEditor";
import { SafeImage } from "@/components/SafeImage";
import { color, friendColor, HUES, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, serif } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { safeBack } from "@/lib/nav";

import { DesktopShell, MonoLink, TopBar } from "./Shell";

/**
 * Nieuwe bijdrage op desktop (Lincin Desktop.dc.html, NIEUWE BIJDRAGE).
 *
 * Een balk van 56 met "Nieuwe bijdrage · № 24" en ANNULEER. Links (1.3)
 * het beeldvak van 420: een carrousel van foto's (tot zes, `+ foto erbij`
 * en `−`), of bij een poll de keuze-editor; rechts (0.7, minstens 300) de
 * titel in Archivo 900 van 30 op een inktlijn, één zin in serif, de kleur
 * als een strook van zes vakken, de soort als chips, en onderaan KLAD en
 * DEEL MET JE VRIENDEN.
 */

const KINDS = ["foto", "krabbel", "tekst", "spraak", "poll", "link", "plek", "muziek"] as const;
const SUPPORTED = new Set<string>(["foto", "tekst", "link", "muziek", "poll"]);
const STAGE_H = 420;

export function DesktopCompose({ c }: { c: Compose }) {
  const t = useT();
  const scheme = useScheme();
  const spec = useThemeSpec();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const web = Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null;
  const label = [mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 0.6, textTransform: "uppercase" as const, color: dim, marginBottom: 8 }];

  return (
    <DesktopShell active="feed" tint={c.fc.fill}>
      <TopBar
        left={<MonoLink label={`${t.newPost} · № ${c.number}`} />}
        right={<MonoLink label={t.cancel} active onPress={() => safeBack(c.router, "/feed")} />}
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 22, flexDirection: "row", gap: 26, alignItems: "stretch" }} keyboardShouldPersistTaps="handled">
        {/* links: het beeld, of de keuzes */}
        <View style={{ flex: 1.3, minWidth: 0, gap: 10 }}>
          {c.kind === "poll" ? (
            <View style={{ minHeight: STAGE_H, borderWidth: spec.border, borderColor: ink, padding: 4 }}>
              <PollEditor c={c} />
            </View>
          ) : (
            <>
              {/* De fotobalk (+ foto erbij / −) staat bij élke soort behalve
                  poll; zonder foto's toont het vak wat bij de soort hoort. */}
              <View style={{ height: STAGE_H, borderWidth: spec.border, borderColor: ink }}>
                <PhotoSlots
                  c={c}
                  placeholder={
                    c.kind === "foto" || c.kind === "krabbel" ? "foto · tik om te kiezen" : c.kind === "tekst" ? "de tekst zelf" : c.kind === "link" ? "beeld van de link" : "hoes"
                  }
                  preview={
                    c.slotImage && c.kind !== "foto" ? (
                      <SafeImage uri={c.slotImage} style={{ width: "100%", height: "100%" }} contentFit="cover" />
                    ) : c.kind === "tekst" && c.body.trim() ? (
                      <Text numberOfLines={12} style={[serif(), { fontSize: 22, lineHeight: 28, padding: 18, color: ink }]}>
                        {c.body}
                      </Text>
                    ) : null
                  }
                  emptyPicks={c.kind === "foto" || c.kind === "krabbel"}
                />
              </View>
              {c.kind === "tekst" ? (
                <TextInput
                  value={c.body}
                  onChangeText={c.setBody}
                  placeholder="De tekst zelf…"
                  placeholderTextColor={dim}
                  multiline
                  style={[serif(), { minHeight: 120, fontSize: 19, lineHeight: 24, padding: 12, textAlignVertical: "top", borderWidth: 1, borderColor: rule, color: ink }, web as object]}
                />
              ) : null}
            </>
          )}
        </View>

        {/* rechts: titel, zin, kleur, soort */}
        <View style={{ flex: 0.7, minWidth: 300, gap: 20 }}>
          <TextInput
            value={c.title}
            onChangeText={c.setTitle}
            placeholder={t.titlePh}
            placeholderTextColor={dim}
            style={[head(), { height: 56, fontSize: 30, lineHeight: 34, borderBottomWidth: spec.border, borderBottomColor: ink, color: ink }, web as object]}
          />
          <TextInput
            value={c.caption}
            onChangeText={c.setCaption}
            placeholder={t.captionPh}
            placeholderTextColor={dim}
            style={[serif(), { height: 44, fontSize: 18, lineHeight: 22, borderBottomWidth: 1, borderBottomColor: rule, color: ink }, web as object]}
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
              style={[mono(500), { height: 44, fontSize: 12, lineHeight: 16, borderBottomWidth: 1, borderBottomColor: rule, color: ink }, web as object]}
            />
          ) : null}
          <View>
            <Text style={label}>{t.color}</Text>
            <View style={{ flexDirection: "row", borderWidth: spec.border, borderColor: ink }}>
              {HUES.map((h, i) => {
                const fc = friendColor(h, scheme);
                const on = h === c.hue;
                return (
                  <Pressable
                    key={h}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={h}
                    onPress={() => c.setHue(h)}
                    style={{ flex: 1, height: 38, backgroundColor: fc.fill, alignItems: "center", justifyContent: "center", borderRightWidth: i < HUES.length - 1 ? 1 : 0, borderRightColor: ink }}
                  >
                    {on ? <View style={{ width: 10, height: 10, backgroundColor: fc.ink }} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View>
            <Text style={label}>{t.kind}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {KINDS.map((k) => {
                const on = k === c.kind;
                const ok = SUPPORTED.has(k);
                return (
                  <Pressable
                    key={k}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on, disabled: !ok }}
                    disabled={!ok}
                    onPress={() => c.setKind(k)}
                    style={{ height: 32, paddingHorizontal: 10, borderWidth: spec.border, borderColor: ink, backgroundColor: on ? ink : "transparent", justifyContent: "center", opacity: ok ? 1 : 0.4 }}
                  >
                    <Text style={[mono(600), { fontSize: 12, lineHeight: 15, color: on ? color("paper") : ink }]}>{k}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          {c.error ? <Text style={[mono(500), { fontSize: 10, lineHeight: 13, color: color("red") }]}>{c.error}</Text> : null}
          <View style={{ flexDirection: "row", gap: 10, marginTop: "auto", paddingTop: 14, borderTopWidth: spec.border, borderTopColor: ink }}>
            <Pressable
              accessibilityRole="button"
              onPress={c.dirty && !c.submitting ? c.keep : undefined}
              style={{ flex: 1, height: 44, borderWidth: spec.border, borderColor: ink, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={[mono(600), buttonText, { color: ink }]}>{t.draft}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={c.publish}
              disabled={!c.canSubmit}
              style={{ flex: 1.6, height: 44, backgroundColor: c.published ? c.green : ink, alignItems: "center", justifyContent: "center", opacity: c.canSubmit || c.published ? 1 : 0.5 }}
            >
              <Text style={[mono(600), buttonText, { color: color("paper") }]}>{c.published ? t.published : t.publish}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </DesktopShell>
  );
}

const buttonText = { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase" as const };
