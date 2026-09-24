import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View, type TextStyle, type ViewStyle } from "react-native";

import { useLincinTheme } from "@/components/lincin/ThemeProvider";
import { listMyChats } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { listMySharedLists } from "@/lib/api/shared-lists";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { RASTER, color, setPreference, type LincinTheme, type ThemePreference, usePreference, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { setLang, useLang, useT, type Lang } from "@/lib/i18n";
import { setPref, usePrefs, type TogglePref } from "@/lib/lincin/prefs";

import { Choice, Toggle } from "./Controls";
import { DesktopShell, PageHead } from "./Shell";

/**
 * Instellingen op desktop (desktop-*-pages.dc.html, INSTELLINGEN): drie
 * kolommen — 01 Uiterlijk, 02 Feed, 03 Wie ziet mij — met schakelaars,
 * keuzerijen en waarden. Alles wordt onthouden, per gebruiker en over
 * toestellen heen (`user_prefs`, 0070).
 *
 * Wat het prototype niet toont maar de app wel nodig heeft (profiel
 * bewerken, lijsten, QR, toestel koppelen, uitloggen) staat als vierde rij
 * onder de kolommen.
 *
 * "Onthoud mijn keuzes" uit het prototype staat er niet: de app onthoudt
 * altijd, en een schakelaar die niets doet zou liegen.
 */

const STAND_NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };
const SEAM = RASTER.seam;

type Row =
  | { kind: "toggle"; label: string; sub: string; on: boolean; flip: () => void }
  | { kind: "value"; label: string; sub: string; value: string; onPress: () => void }
  | { kind: "choice"; label: string; sub: string; node: ReactNode };

export function DesktopSettings() {
  const { session, signOut } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const pref = usePreference();
  const prefs = usePrefs(myUserId);
  const lincin = useLincinTheme();
  const spec = useThemeSpec();
  const th = spec.id;

  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId) });
  const chats = useQuery({ queryKey: ["chats", myUserId], queryFn: () => listMyChats(myUserId) });
  const lists = useQuery({ queryKey: ["shared-lists", myUserId], queryFn: () => listMySharedLists(myUserId) });
  const lincs = (friendships.data ?? []).filter((f) => f.status === "accepted").length;
  const pendingIn = (friendships.data ?? []).filter((f) => f.status === "pending" && f.addressee_id === myUserId).length;
  const groups = (chats.data ?? []).filter((c) => c.type === "group");
  const listCount = (lists.data ?? []).length;

  const toggle = (name: TogglePref) => () => setPref(myUserId, name, !prefs[name]);
  const standLabel = pref === "system" ? t.device : scheme === "dark" ? t.dark : t.light;

  async function logout() {
    const ok = await confirm("Uitloggen?", "Je berichten blijven versleuteld op dit toestel staan tot je weer inlogt.", { affirmativeLabel: "Uitloggen", destructive: true });
    if (ok) signOut();
  }

  const columns: { num: string; title: string; rows: Row[] }[] = [
    {
      num: "01",
      title: t.lookTitle,
      rows: [
        {
          kind: "choice",
          label: t.theme,
          sub: t.themeSub,
          node: (
            <Choice
              value={lincin.theme}
              onChange={(v: LincinTheme) => lincin.choose(v)}
              options={[
                { value: "kleur", label: t.themeKleur },
                { value: "magazine", label: t.themeMagazine },
                { value: "modern", label: t.themeModern },
              ]}
            />
          ),
        },
        {
          kind: "choice",
          label: t.language,
          sub: "",
          node: <Choice value={lang} onChange={(v: Lang) => setLang(v)} options={(["nl", "en", "de"] as Lang[]).map((l) => ({ value: l, label: l.toUpperCase() }))} />,
        },
        { kind: "value", label: t.lightDark, sub: t.followsDevice, value: standLabel, onPress: () => setPreference(STAND_NEXT[pref]) },
        { kind: "toggle", label: t.tint, sub: t.tintSub, on: prefs.tint, flip: toggle("tint") },
      ],
    },
    {
      num: "02",
      title: t.tabFeed,
      rows: [
        { kind: "toggle", label: t.foldedDefault, sub: t.foldedDefaultSub, on: !prefs.openDefault, flip: toggle("openDefault") },
        { kind: "toggle", label: t.newPosts, sub: t.newPostsSub, on: prefs.pushNew, flip: toggle("pushNew") },
        { kind: "toggle", label: t.quiet, sub: t.quietSub, on: prefs.quiet, flip: toggle("quiet") },
      ],
    },
    {
      num: "03",
      title: t.whoTitle,
      rows: [
        { kind: "toggle", label: t.visible, sub: t.visibleSub, on: prefs.visible, flip: toggle("visible") },
        { kind: "value", label: t.myLincs, sub: pendingIn ? `${pendingIn} ${t.waitsForYou}` : t.peopleYouLet, value: String(lincs), onPress: () => router.push("/friends") },
        { kind: "value", label: t.groupsLabel, sub: groups.map((g) => g.name).filter(Boolean).slice(0, 3).join(", "), value: String(groups.length), onPress: () => router.push("/chats") },
        { kind: "value", label: t.myLists, sub: listCount === 0 ? t.noListsYet : "", value: String(listCount), onPress: () => router.push("/lists") },
      ],
    },
  ];

  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const colStyle: ViewStyle =
    th === "kleur"
      ? { flex: 1, minWidth: 0, minHeight: 640, borderRightWidth: spec.border, borderRightColor: ink }
      : th === "magazine"
        ? { flex: 1, minWidth: 0, minHeight: 600, backgroundColor: color("paper2") }
        : { flex: 1, minWidth: 0, minHeight: 560, padding: 10, gap: 6, borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill") };
  const rowStyle: ViewStyle =
    th === "modern"
      ? { padding: 16, gap: 12, borderRadius: 14, backgroundColor: color("paper") }
      : { paddingVertical: 18, paddingHorizontal: th === "magazine" ? 28 : 24, gap: 12, borderBottomWidth: 1, borderBottomColor: rule };
  const labelStyle: TextStyle =
    th === "kleur" ? { ...head(), fontSize: 18, lineHeight: 18 } : th === "magazine" ? { ...serif(), fontSize: 22, lineHeight: 23 } : { ...sans(500), fontSize: 16, lineHeight: 19, letterSpacing: -0.16 };
  const valueStyle: TextStyle =
    th === "magazine"
      ? { ...serif(true), fontSize: 19, lineHeight: 23, color: ink }
      : { ...mono(th === "kleur" ? 600 : 500), fontSize: th === "kleur" ? 11 : 9.5, lineHeight: 14, letterSpacing: 1, textTransform: "uppercase", color: ink };

  const account = [
    { label: t.editProfile, onPress: () => router.push("/profile-edit") },
    { label: t.myQr, onPress: () => router.push("/qr-code") },
    { label: t.linkDevice, onPress: () => router.push("/device-link") },
    { label: t.logout, onPress: logout, red: true },
  ];

  return (
    <DesktopShell active="you">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={th === "modern" ? { gap: SEAM } : undefined} showsVerticalScrollIndicator={false}>
        <PageHead num="04" title={t.settings} sub={t.remembered} />
        <View style={[{ flexDirection: "row" }, th === "kleur" ? null : { gap: SEAM }, th === "magazine" ? { padding: SEAM } : null]}>
          {columns.map((g) => (
            <View key={g.num} style={colStyle}>
              <View
                style={
                  th === "kleur"
                    ? { paddingTop: 22, paddingHorizontal: 24, paddingBottom: 16, gap: 6, borderBottomWidth: spec.border, borderBottomColor: ink }
                    : th === "magazine"
                      ? { paddingTop: 26, paddingHorizontal: 28, paddingBottom: 18, gap: 8, borderBottomWidth: 1, borderBottomColor: rule }
                      : { paddingTop: 14, paddingHorizontal: 12, paddingBottom: 10, gap: 6 }
                }
              >
                <Text style={[th === "magazine" ? sans(700) : mono(500), { fontSize: th === "modern" ? 9 : 10, lineHeight: 12, letterSpacing: 1, color: th === "kleur" ? ink : dim }]}>{g.num}</Text>
                <Text style={[th === "kleur" ? head() : th === "magazine" ? serif() : sans(400), { fontSize: th === "kleur" ? 32 : th === "magazine" ? 40 : 32, lineHeight: th === "kleur" ? 29 : th === "magazine" ? 38 : 32, letterSpacing: th === "modern" ? -1.1 : 0, color: ink }]}>{g.title}</Text>
              </View>
              {g.rows.map((r) => {
                const text = (
                  <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                    <Text style={[labelStyle, { color: ink }]}>{r.label}</Text>
                    {r.sub ? <Text style={[sans(), { fontSize: 13, lineHeight: 17, color: dim }]}>{r.sub}</Text> : null}
                  </View>
                );
                if (r.kind === "choice") {
                  return (
                    <View key={r.label} style={rowStyle}>
                      {text}
                      {r.node}
                    </View>
                  );
                }
                if (r.kind === "toggle") {
                  return (
                    <View key={r.label} style={rowStyle}>
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                        {text}
                        <Toggle on={r.on} onPress={r.flip} label={r.label} />
                      </View>
                    </View>
                  );
                }
                return (
                  <Pressable key={r.label} accessibilityRole="button" onPress={r.onPress} style={rowStyle}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                      {text}
                      <Text style={valueStyle}>{r.value} →</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <View
          style={[
            { flexDirection: "row", flexWrap: "wrap", gap: 24, paddingVertical: 18, paddingHorizontal: 32 },
            th === "kleur" ? { borderTopWidth: spec.border, borderTopColor: ink, borderBottomWidth: 1, borderBottomColor: rule } : null,
            th === "modern" ? { borderRadius: RASTER.tileRadius, backgroundColor: color("tile", "tileFill"), paddingHorizontal: 24 } : null,
          ]}
        >
          {account.map((a) => (
            <Pressable key={a.label} accessibilityRole="button" onPress={a.onPress}>
              <Text style={[th === "magazine" ? serif() : mono(500), th === "magazine" ? { fontSize: 19, lineHeight: 24 } : { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase" }, { color: a.red ? color("red") : ink, textDecorationLine: "underline" }]}>
                {a.label} →
              </Text>
            </Pressable>
          ))}
        </View>
        <View style={th === "modern" ? { borderRadius: RASTER.tileRadius, backgroundColor: ink, paddingVertical: 20, paddingHorizontal: 24 } : { paddingTop: 16, paddingHorizontal: 32, paddingBottom: 28 }}>
          <Text
            style={
              th === "magazine"
                ? [serif(true), { fontSize: 19, lineHeight: 24, color: dim }]
                : [mono(500), { fontSize: th === "kleur" ? 10 : 9.5, lineHeight: 13, letterSpacing: 1.2, textTransform: "uppercase", color: th === "modern" ? color("paper") : dim }]
            }
          >
            {t.rememberNote}
          </Text>
        </View>
      </ScrollView>
    </DesktopShell>
  );
}
