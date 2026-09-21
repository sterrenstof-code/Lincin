import { useQuery } from "@tanstack/react-query";
import { Redirect, useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";

import { LincinScreen, TopRow, vfade } from "@/components/lincin/Chrome";
import { SettingsModern, type SettingsGroupData } from "@/components/lincin/modern/SettingsModern";
import { useLincinTheme } from "@/components/lincin/ThemeProvider";
import { BORDER, Body, Box, GUTTER, Mono, Segment, Serif, line } from "@/components/lincin/ui";
import { listMyFriendships } from "@/lib/api/friends";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { color, setPreference, usePreference, type LincinTheme, type ThemePreference } from "@/lib/design/theme";
import { setLang, useLang, useT, type Lang } from "@/lib/i18n";
import { setPref, usePrefs, type Prefs } from "@/lib/lincin/prefs";
import { useIsDesktop } from "@/lib/lincin/desktop";
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
  const desktop = useIsDesktop();
  if (desktop) return <Redirect href="/profile" />;
  return <SettingsMobile />;
}

function SettingsMobile() {
  const { session, signOut } = useAuth();
  const myUserId = session?.user.id ?? "anon";
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const theme = usePreference();
  const prefs = usePrefs(myUserId);
  const lincin = useLincinTheme();
  const spec = lincin.spec;

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

  /**
   * De vier groepen als gegevens. Kleur en magazine zetten ze in kaders,
   * modern in tegels met gestippelde scheidingen (2.2 §1). Dezelfde rijen,
   * dezelfde schakelaars, dezelfde handelingen.
   */
  const arrow = (red = false) => (
    <Mono variant="meta" tone={red ? "red" : "ink"} style={{ textTransform: "none" }}>
      →
    </Mono>
  );
  const groups: SettingsGroupData[] = [
    {
      title: t.lookTitle,
      rows: [
        {
          key: "theme",
          label: t.theme,
          sub: t.themeSub,
          right: (
            <Segment<LincinTheme>
              options={[
                { value: "kleur", label: t.themeKleur },
                { value: "magazine", label: t.themeMagazine },
                { value: "modern", label: t.themeModern },
              ]}
              value={lincin.theme}
              onChange={lincin.choose}
            />
          ),
        },
        {
          key: "lang",
          label: t.language,
          sub: t.languageSub,
          right: (
            <Segment<Lang>
              options={[
                { value: "nl", label: "NL" },
                { value: "en", label: "EN" },
                { value: "de", label: "DE" },
              ]}
              value={lang}
              onChange={setLang}
            />
          ),
        },
        {
          key: "stand",
          label: t.lightDark,
          sub: t.followsDevice,
          onPress: () => setPreference(THEME_NEXT[theme]),
          right: (
            <Mono variant="meta" style={{ textTransform: "none" }}>
              {themeLabel} →
            </Mono>
          ),
        },
        { key: "tint", label: t.tint, sub: t.tintSub, onPress: toggle("tint"), right: <Toggle on={prefs.tint} /> },
      ],
    },
    {
      title: t.notifTitle,
      rows: [
        { key: "pushNew", label: t.newPosts, sub: t.newPostsSub, onPress: toggle("pushNew"), right: <Toggle on={prefs.pushNew} /> },
        { key: "quiet", label: t.quiet, sub: t.quietSub, onPress: toggle("quiet"), right: <Toggle on={prefs.quiet} /> },
      ],
    },
    {
      title: t.whoTitle,
      rows: [
        { key: "visible", label: t.visible, sub: t.visibleSub, onPress: toggle("visible"), right: <Toggle on={prefs.visible} /> },
        {
          key: "lincs",
          label: t.myLincs,
          sub: `${lincs} ${t.friends}`,
          onPress: () => router.push("/friends"),
          right: (
            <Mono variant="meta" style={{ textTransform: "none" }}>
              {lincs} →
            </Mono>
          ),
        },
      ],
    },
    {
      title: "Account",
      rows: [
        { key: "edit", label: "Profiel bewerken", sub: session?.user.email ?? "", onPress: () => router.push("/profile-edit"), right: arrow() },
        { key: "device", label: "Toestel koppelen", sub: "Je sleutels naar een tweede toestel", onPress: () => router.push("/device-link"), right: arrow() },
        { key: "logout", label: "Uitloggen", sub: "Op dit toestel", onPress: logout, right: arrow(true) },
      ],
    },
  ];

  if (spec.layout === "bento") {
    return <SettingsModern groups={groups} footer={t.footerNote} t={t} />;
  }

  return (
    <LincinScreen
      tab="you"
      counter={t.settings}
      back="/profile"
      header={
        <TopRow
          center={<Serif variant="pageTitleLarge">{t.settings}</Serif>}
        />
      }
    >
      <ScrollView style={[{ flex: 1 }, vfade()]} contentContainerStyle={{ padding: GUTTER, paddingTop: 16, paddingBottom: 20, gap: 16 }}>
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
