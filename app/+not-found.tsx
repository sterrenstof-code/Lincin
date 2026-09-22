import { Stack, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { DesktopShell, MonoLink, TopBar } from "@/components/lincin/desktop/Shell";
import { color } from "@/lib/design/theme";
import {
  announce,
  announceDeep,
  capf,
  CONTROL_H,
  creamOnDark,
  feed,
  feedType,
  flameDeep,
  mono,
  sans,
  space,
} from "@/lib/design/type";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { usePageTitle } from "@/lib/page-title";

/**
 * Catch-all 404 voor paden die de router niet kan matchen. Dit gebeurt
 * bv. wanneer iemand een outdated invite-link opent, een verkeerde
 * username intypt, of een share-link uit een ander gesprek volgt.
 *
 * In plaats van de naakte Vercel-edge 404 (waar geen weg terug uit is)
 * landt de gebruiker hier binnen de Lincin-shell. Werkt op web én native.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT SCHERM OPNIEUW GETEKEND IS
 * ---------------------------------------------------------------
 * Het stond nog volledig op het systeem van vóór v3: `ScreenContainer`
 * met zijn kolom van 600, `text-3xl font-semibold`, een grijs vierkant
 * met een kompas erin, en twee hexwaarden (`#1a1a1a`, `#fdfaf3`) die met
 * geen van beide standen meeschoven. Uitgerekend hier telt dat: dit is
 * het scherm dat iemand ziet die van búiten de app binnenkomt via een
 * link die niet meer klopt, en dat is vaak hun eerste beeld ervan.
 *
 * Nu draagt het dezelfde ruggengraat als elk ander scherm (§5) — dus ook
 * de balk, en daarmee de navigatie. Dat is het echte verschil: je zat
 * hier eerder vast aan één knop.
 *
 * ---------------------------------------------------------------
 * DE KNOP ZEI IETS ANDERS DAN HIJ DEED
 * ---------------------------------------------------------------
 * Er stond "Terug naar Lincin" en er gebeurde `router.back()`. Kom je van
 * buiten binnen, dan is "terug" de pagina wáár je vandaan kwam — een
 * mailtje, een gesprek in een andere app — en niet Lincin. De knop bracht
 * je dus precies weg van waar hij zei je heen te brengen.
 *
 * Het zijn nu twee dingen. "Naar de feed" gaat naar de feed en zegt dat
 * ook. Terug is de terug-knop in de balk, die overal in de app hetzelfde
 * doet.
 */
export default function NotFoundScreen() {
  usePageTitle("Pagina niet gevonden");
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
  const desktop = useIsDesktop();

  // Op het brede scherm in de Lincin-rail, zoals elk ander scherm daar:
  // de navigatie is hier juist het belangrijkste wat je aanreikt.
  if (desktop) {
    return (
      <DesktopShell active="feed">
        <Stack.Screen options={{ headerShown: false }} />
        <TopBar
          left={
            <MonoLink
              label="← Terug"
              active
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/feed"))}
            />
          }
        />
        <View style={{ padding: 32, maxWidth: 520, gap: 16 }}>
          <Text style={[mono(500), { fontSize: 10, letterSpacing: 1.2, color: color("red"), textTransform: "uppercase" }]}>
            404 — verdwaald
          </Text>
          <Text style={[capf(false, true), { fontSize: 46, lineHeight: 46, color: color("ink") }]}>
            Deze pagina <Text style={[capf(true, true), { color: color("ink", "inkDim") }]}>bestaat niet</Text>
          </Text>
          <Text style={[sans(), { fontSize: 15, lineHeight: 22, color: color("ink", "inkDim") }]}>
            Misschien is de link verlopen, of werd hij verkeerd gekopieerd. Er staat in elk geval niets meer achter.
          </Text>
          <MonoLink label="Naar de feed →" active onPress={() => router.replace("/feed")} />
        </View>
      </DesktopShell>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        backLabel="Terug"
        onBack={() => {
          if (router.canGoBack()) router.back();
          else router.replace("/");
        }}
        contentStyle={{ paddingVertical: space.section }}
      >
        <View style={{ maxWidth: 460 }}>
          <Text
            style={[
              feedType.kicker,
              { color: flameDeep, letterSpacing: 0.55, marginBottom: space.md },
            ]}
          >
            404 — VERDWAALD
          </Text>
          <Text
            style={[
              wide ? feedType.hero : feedType.heroSmall,
              { color: feed.ink, marginBottom: space.lg },
            ]}
          >
            Deze pagina bestaat niet
          </Text>
          <Text
            style={[
              feedType.body,
              { color: feed.inkDim, marginBottom: space.section },
            ]}
          >
            Misschien is de link verlopen, of werd hij verkeerd gekopieerd.
            Er staat in elk geval niets meer achter.
          </Text>

          {/* De enige gevulde knop op dit scherm, en dus oranje (§2, §4). */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Naar de feed"
            onPress={() => router.replace("/(app)/feed")}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              height: CONTROL_H,
              paddingHorizontal: space.xxl,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: pressed ? announceDeep : announce,
            })}
          >
            <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>
              Naar de feed
            </Text>
          </Pressable>
        </View>
      </PageScroll>
    </SafeAreaView>
  );
}
