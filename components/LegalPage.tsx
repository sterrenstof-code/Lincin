import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { AuthPage, AuthSub, AuthTitle, AuthTop } from "@/components/lincin/auth/AuthKit";
import { color } from "@/lib/design/theme";
import { sans } from "@/lib/design/type";
import { BIJGEWERKT, type LegalSection } from "@/lib/legal";

/** Privacybeleid en voorwaarden: zonder account leesbaar (lib/legal.ts). */
export function LegalPage({ titel, secties }: { titel: string; secties: LegalSection[] }) {
  const back = () => (router.canGoBack() ? router.back() : router.replace("/"));
  return (
    <AuthPage>
      <AuthTop label={titel} onBack={back} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48, gap: 26, maxWidth: 680 }}>
        <View style={{ gap: 8 }}>
          <AuthTitle>{titel}</AuthTitle>
          <AuthSub>Bijgewerkt op {BIJGEWERKT}.</AuthSub>
        </View>
        {secties.map((s) => (
          <View key={s.kop} style={{ gap: 8 }}>
            <Text accessibilityRole="header" style={[sans(700), { fontSize: 17, lineHeight: 22, color: color("ink") }]}>
              {s.kop}
            </Text>
            {s.tekst.map((t, i) => (
              <Text key={i} style={[sans(400), { fontSize: 15, lineHeight: 22, color: color("ink") }]}>
                {t}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
    </AuthPage>
  );
}
