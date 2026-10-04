import { router } from "expo-router";
import { Platform, Text, View, type ViewStyle } from "react-native";

import { AuthLabel, AuthPage, AuthWordmark, OutlineButton, PrimaryButton } from "@/components/lincin/auth/AuthKit";
import { color, useThemeSpec } from "@/lib/design/theme";
import { serif } from "@/lib/design/type";
import { usePageTitle } from "@/lib/page-title";

/**
 * Welkom (Login Voorbeeld 1a): de eerste pagina van de editie.
 *
 * Bovenaan het woordmerk, daaronder een cover over de volle breedte met de
 * coverregel, en twee knoppen: Inloggen (het rode vlak) en Account maken.
 * De cover heeft (nog) geen foto; het prototype valt dan terug op een
 * diep rood met het verloop naar inkt, en dat doen wij ook.
 */
const COVER = "#9C3B2E";
const ON_COVER = "#F7F4EE";

export default function WelcomeScreen() {
  usePageTitle("Welkom");
  const modern = useThemeSpec().id === "modern";
  const gradient: ViewStyle | null =
    Platform.OS === "web"
      ? ({ backgroundImage: "linear-gradient(180deg, rgba(22,22,15,0) 30%, rgba(22,22,15,.85) 100%)" } as ViewStyle)
      : null;

  return (
    <AuthPage fill>
      <View style={{ paddingHorizontal: 24, gap: 6 }}>
        <AuthLabel size={8.5} ls={0.2}>
          Editie № 0 · geen algoritme
        </AuthLabel>
        <AuthWordmark size={96} />
      </View>

      <View
        style={{
          flex: 1,
          minHeight: 280,
          marginTop: 22,
          marginHorizontal: 6,
          overflow: "hidden",
          backgroundColor: COVER,
          borderRadius: modern ? 18 : 0,
        }}
      >
        {gradient ? (
          <View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, gradient]} />
        ) : (
          <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "60%", backgroundColor: "rgba(22,22,15,.55)" }} />
        )}
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}>
          <Text accessibilityRole="header" style={[serif(true), { fontSize: 44, lineHeight: 42, letterSpacing: -0.44, color: ON_COVER }]}>
            Een tijdschrift van je vrienden, elke dag.
          </Text>
          <Text style={[serif(false), { fontSize: 17, lineHeight: 22, color: ON_COVER, opacity: 0.9 }]}>
            Geen feed, geen algoritme. Alleen wat je vrienden vandaag deelden — en dan ben je bij.
          </Text>
        </View>
      </View>

      <View style={{ marginTop: 6, marginHorizontal: 6, gap: 6 }}>
        <PrimaryButton label="Inloggen" onPress={() => router.push("/(auth)/login")} />
        <OutlineButton label="Account maken" onPress={() => router.push("/(auth)/signup")} />
      </View>

      <View style={{ paddingTop: 16, paddingHorizontal: 24, paddingBottom: 24, alignItems: "center" }}>
        <AuthLabel style={{ textAlign: "center", color: color("ink", "inkDim") }}>
          Door verder te gaan ga je akkoord met de{" "}
          <Text style={{ textDecorationLine: "underline" }}>voorwaarden</Text>
        </AuthLabel>
      </View>
    </AuthPage>
  );
}
