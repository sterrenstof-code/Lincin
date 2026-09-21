import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { useLincinTheme } from "@/components/lincin/ThemeProvider";
import { listMyFriendships } from "@/lib/api/friends";
import { listUserPosts } from "@/lib/api/posts";
import { getProfile } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { ON_DARK, THEMES, color, setPreference, type LincinTheme, type ThemePreference, usePreference, useScheme, useThemeSpec } from "@/lib/design/theme";
import { mono, sans, serif } from "@/lib/design/type";
import { setLang, useLang, useT, type Lang } from "@/lib/i18n";
import { displayName } from "@/lib/lincin/model";
import { setPref, usePrefs, type Prefs } from "@/lib/lincin/prefs";

import { useUnread } from "@/lib/lincin/unread";

import { DesktopShell, MonoLink } from "./Shell";

/**
 * Jij op desktop (Lincin Desktop.dc.html, JIJ): je naam in serif 46
 * (achternaam cursief, gedempt) met rechts de drie cijfers in mono, en
 * daaronder de instellingen als kolommen van minstens 280 (hoogstens 900
 * samen): elke groep een cursieve serif-kop van 20 op een inktlijn, rijen
 * van 13 hoog-en-laag op haarlijnen, rechts de waarde in mono — "AAN",
 * "TOESTEL", "NL". Instellingen is op desktop geen apart scherm.
 */

/** toestel → licht → donker, zoals de rail. */
const THEME_NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };

export function DesktopYou() {
  const { session, signOut } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const spec = useThemeSpec();
  const pref = usePreference();
  const prefs = usePrefs(myUserId);
  const lincin = useLincinTheme();
  const unread = useUnread();

  const profile = useQuery({ queryKey: ["profile", myUserId], queryFn: () => getProfile(myUserId) });
  const posts = useQuery({ queryKey: ["posts-by-user", myUserId], queryFn: () => listUserPosts(myUserId, 60) });
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId) });
  const name = displayName(profile.data ?? { username: session!.user.email ?? "" });
  const [first, ...rest] = name.split(" ");
  const last = rest.join(" ");
  const lincs = (friendships.data ?? []).filter((f) => f.status === "accepted").length;
  const pendingIn = (friendships.data ?? []).filter((f) => f.status === "pending" && f.addressee_id === myUserId).length;
  const since = new Date(session!.user.created_at);
  const yy = `'${String(since.getFullYear()).slice(2)}`;

  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const toggle = (name: keyof Prefs) => () => setPref(myUserId, name, !prefs[name]);
  const standLabel = pref === "system" ? t.device : scheme === "dark" ? t.dark : t.light;

  async function logout() {
    const ok = await confirm("Uitloggen?", "Je berichten blijven versleuteld op dit toestel staan tot je weer inlogt.", { affirmativeLabel: "Uitloggen", destructive: true });
    if (ok) signOut();
  }

  const stat = (label: string) => <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: dim }]}>{label}</Text>;

  return (
    <DesktopShell active="you">
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 20, maxWidth: 900, borderBottomWidth: spec.border, borderBottomColor: ink, paddingBottom: 16 }}>
          {/* Je naam opent je profiel; bewerken staat onder Account. */}
          <Pressable
            accessibilityRole="link"
            onPress={() => router.push((profile.data?.username ? `/user/${profile.data.username}` : "/profile-edit") as never)}
            style={{ flexShrink: 1 }}
          >
            <Text style={[serif(), { fontSize: 46, lineHeight: 44, color: ink }]}>
              {first} {last ? <Text style={[serif(true), { color: dim }]}>{last}</Text> : null}
            </Text>
          </Pressable>
          <View style={{ flexDirection: "row", gap: 24, paddingBottom: 6 }}>
            {stat(`${posts.data?.length ?? 0} ${t.posts}`)}
            {stat(`${lincs} lincs`)}
            {stat(yy)}
          </View>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24, marginTop: 26, maxWidth: 900 }}>
          <Group title={t.lookTitle}>
            <Row label={t.theme} sub={t.themeSub}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                {THEMES.map((th) => (
                  <MonoLink key={th} label={th === "kleur" ? t.themeKleur : th === "magazine" ? t.themeMagazine : t.themeModern} on={lincin.theme === th} active={lincin.theme === th} onPress={() => lincin.choose(th as LincinTheme)} />
                ))}
              </View>
            </Row>
            <Row label={t.language} sub="NL · EN · DE">
              <View style={{ flexDirection: "row", gap: 12 }}>
                {(["nl", "en", "de"] as Lang[]).map((l) => (
                  <MonoLink key={l} label={l} on={lang === l} active={lang === l} onPress={() => setLang(l)} />
                ))}
              </View>
            </Row>
            <Row label={t.lightDark} sub={t.followsDevice} onPress={() => setPreference(THEME_NEXT[pref])}>
              <MonoLink label={standLabel} />
            </Row>
            <Row label={t.tint} sub={t.tintSub} onPress={toggle("tint")} last>
              <Switch on={prefs.tint} />
            </Row>
          </Group>
          <Group title={t.notifTitle}>
            <Row label={t.newPosts} sub={t.newPostsSub} onPress={toggle("pushNew")}>
              <Switch on={prefs.pushNew} />
            </Row>
            <Row label={t.quiet} sub={t.quietSub} onPress={toggle("quiet")}>
              <Switch on={prefs.quiet} />
            </Row>
            <Row label={t.notifications} sub={unread.notifications ? `${unread.notifications} ${t.new}` : ""} onPress={() => router.push("/notifications")} last>
              {unread.notifications > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View style={{ backgroundColor: color("red"), paddingVertical: 1, paddingHorizontal: 5 }}>
                    <Text style={[mono(600), { fontSize: 9, lineHeight: 12, color: ON_DARK }]}>{unread.notifications}</Text>
                  </View>
                  <MonoLink label="→" active on />
                </View>
              ) : (
                <MonoLink label="→" active />
              )}
            </Row>
          </Group>
          <Group title={t.whoTitle}>
            <Row label={t.visible} sub={t.visibleSub} onPress={toggle("visible")}>
              <Switch on={prefs.visible} />
            </Row>
            <Row label={t.myLincs} sub={`${lincs} ${t.friends}${pendingIn ? ` · ${pendingIn} ${t.waitsForYou}` : ""}`} onPress={() => router.push("/friends")}>
              <MonoLink label={`${lincs} →`} active />
            </Row>
            <Row label={t.myQr} sub="" onPress={() => router.push("/qr-code")} last>
              <MonoLink label="→" active />
            </Row>
          </Group>
          <Group title="Account">
            <Row label="Profiel bewerken" sub={session?.user.email ?? ""} onPress={() => router.push("/profile-edit")}>
              <MonoLink label="→" active />
            </Row>
            <Row label="Toestel koppelen" sub="Je sleutels naar een tweede toestel" onPress={() => router.push("/device-link")}>
              <MonoLink label="→" active />
            </Row>
            <Row label="Uitloggen" sub="Op dit toestel" onPress={logout} last>
              <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: color("red"), textDecorationLine: "underline" }]}>→</Text>
            </Row>
          </Group>
        </View>
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, color: dim, marginTop: 26 }]}>{t.footerNote}</Text>
      </ScrollView>
    </DesktopShell>
  );

  function Group({ title, children }: { title: string; children: ReactNode }) {
    return (
      <View style={{ flexGrow: 1, flexBasis: 280, minWidth: 280 }}>
        <Text style={[serif(true), { fontSize: 20, lineHeight: 22, color: ink, borderBottomWidth: spec.border, borderBottomColor: ink, paddingBottom: 8 }]}>{title}</Text>
        <View>{children}</View>
      </View>
    );
  }

  function Row({ label, sub, children, onPress, last = false }: { label: string; sub: string; children: ReactNode; onPress?: () => void; last?: boolean }) {
    return (
      <Pressable
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={label}
        onPress={onPress}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: rule }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[sans(), { fontSize: 15, lineHeight: 19, color: ink }]}>{label}</Text>
          {sub ? <Text style={[sans(), { fontSize: 12, lineHeight: 16, color: dim }]}>{sub}</Text> : null}
        </View>
        {children}
      </Pressable>
    );
  }

  function Switch({ on }: { on: boolean }) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ width: 8, height: 8, borderWidth: 1, borderColor: ink, backgroundColor: on ? ink : "transparent" }} />
        <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: on ? ink : dim }]}>{on ? t.on : t.off}</Text>
      </View>
    );
  }
}
