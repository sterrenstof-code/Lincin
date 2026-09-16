import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { LincinScreen, TopRow } from "@/components/lincin/Chrome";
import { useLincinTheme } from "@/components/lincin/ThemeProvider";
import { BackChip, BORDER, Body, Box, GUTTER, Mono, Segment, Serif, line } from "@/components/lincin/ui";
import { listMyFriendships } from "@/lib/api/friends";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { color, setPreference, usePreference, type LincinTheme, type ThemePreference } from "@/lib/design/theme";
import { setLang, useLang, useT, type Lang } from "@/lib/i18n";
import { setPref, usePrefs, type Prefs } from "@/lib/lincin/prefs";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";

/**
 * Instellingen (README §08).
 *
 * Drie groepen, elk een mono-etiket en een kader met rijen: hoe het
 * eruitziet (thema, taal, licht of donker, blad kleurt mee), meldingen,
 * en wie wat ziet. Onderaan uitloggen en "Lincin 2.0 · versleuteld op je
 * toestel". Het thema (HANDOFF §Themes) staat op het profiel en wisselt
 * zonder herlaad.
 */

const THEME_NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };

export default function SettingsScreen() {
  usePageTitle("Instellingen");
  const { session, signOut } = useAuth();
  const myUserId = session?.user.id ?? "anon";
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const theme = usePreference();
  const prefs = usePrefs(myUserId);
  const lincin = useLincinTheme();

  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
    enabled: !!session,
  });
  const lincs = (friendships.data ?? []).filter((f) => f.status === "accepted").length;

  const themeLabel = theme === "system" ? t.followsDevice : theme === "light" ? t.light : t.dark;

  async function logout() {
    const ok = await confirm("Uitloggen?", "Je berichten blijven versleuteld op dit toestel staan tot je weer inlogt.", {
      affirmativeLabel: "Uitloggen",
      destructive: true,
    });
    if (ok) signOut();
  }

  const toggle = (name: keyof Prefs) => () => setPref(myUserId, name, !prefs[name]);

  return (
    <LincinScreen
      tab="you"
      header={
        <TopRow
          left={<BackChip label={`← ${t.you}`} onPress={() => safeBack(router, "/profile")} />}
          center={<Serif variant="pageTitleLarge">{t.settings}</Serif>}
        />
      }
    >
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: GUTTER, paddingTop: 16, paddingBottom: 20, gap: 16 }}>
        <Group title={t.lookTitle}>
          <Row label={t.theme} sub={t.themeSub}>
            <Segment<LincinTheme>
              options={[
                { value: "kleur", label: t.themeKleur },
                { value: "magazine", label: t.themeMagazine },
                { value: "modern", label: t.themeModern },
              ]}
              value={lincin.theme}
              onChange={lincin.choose}
            />
          </Row>
          <Row label={t.language} sub={t.languageSub}>
            <Segment<Lang>
              options={[
                { value: "nl", label: "NL" },
                { value: "en", label: "EN" },
                { value: "de", label: "DE" },
              ]}
              value={lang}
              onChange={setLang}
            />
          </Row>
          <Row label={t.lightDark} sub={t.followsDevice} onPress={() => setPreference(THEME_NEXT[theme])}>
            <Mono variant="meta" style={{ textTransform: "none" }}>
              {themeLabel} →
            </Mono>
          </Row>
          <Row label={t.tint} sub={t.tintSub} onPress={toggle("tint")} last>
            <Toggle on={prefs.tint} />
          </Row>
        </Group>

        <Group title={t.notifTitle}>
          <Row label={t.newPosts} sub={t.newPostsSub} onPress={toggle("pushNew")}>
            <Toggle on={prefs.pushNew} />
          </Row>
          <Row label={t.quiet} sub={t.quietSub} onPress={toggle("quiet")} last>
            <Toggle on={prefs.quiet} />
          </Row>
        </Group>

        <Group title={t.whoTitle}>
          <Row label={t.visible} sub={t.visibleSub} onPress={toggle("visible")}>
            <Toggle on={prefs.visible} />
          </Row>
          <Row label={t.myLincs} sub={`${lincs} ${t.friends}`} onPress={() => router.push("/friends")} last>
            <Mono variant="meta" style={{ textTransform: "none" }}>
              {lincs} →
            </Mono>
          </Row>
        </Group>

        <Group title="Account">
          <Row label="Profiel bewerken" sub={session?.user.email ?? ""} onPress={() => router.push("/profile-edit")}>
            <Mono variant="meta" style={{ textTransform: "none" }}>
              →
            </Mono>
          </Row>
          <Row label="Toestel koppelen" sub="Je sleutels naar een tweede toestel" onPress={() => router.push("/device-link")}>
            <Mono variant="meta" style={{ textTransform: "none" }}>
              →
            </Mono>
          </Row>
          <Row label="Uitloggen" sub="Op dit toestel" onPress={logout} last>
            <Mono variant="meta" tone="red" style={{ textTransform: "none" }}>
              →
            </Mono>
          </Row>
        </Group>

        <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingTop: 6, textTransform: "none" }}>
          {t.footerNote}
        </Mono>
      </ScrollView>
    </LincinScreen>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Mono variant="micro" tone="dim" style={{ marginBottom: 6 }}>
        {title}
      </Mono>
      <Box>{children}</Box>
    </View>
  );
}

function Row({
  label,
  sub,
  children,
  onPress,
  last = false,
}: {
  label: string;
  sub?: string;
  children: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 10,
        padding: 12,
        borderBottomWidth: last ? 0 : BORDER,
        borderBottomColor: color("ink", "postRule"),
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Body>{label}</Body>
        {sub ? (
          <Body small tone="dim" style={{ fontSize: 12, lineHeight: 16 }}>
            {sub}
          </Body>
        ) : null}
      </View>
      {children}
    </Pressable>
  );
}

/** 44×24, knop van 16: aan is inkt met een papieren knop. */
function Toggle({ on }: { on: boolean }) {
  return (
    <View
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      style={{ width: 44, height: 24, borderWidth: BORDER, borderColor: line(), backgroundColor: on ? color("ink") : "transparent" }}
    >
      <View
        style={{
          position: "absolute",
          top: 2.5,
          left: on ? 22.5 : 2.5,
          width: 16,
          height: 16,
          backgroundColor: on ? color("paper") : color("ink"),
        }}
      />
    </View>
  );
}
