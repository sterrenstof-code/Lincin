import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";

import { Label, Ser } from "@/components/lincin/magazine/Omslag";
import { Box, Btn, DashedCard, GUTTER, Head, Mono, Serif } from "@/components/lincin/ui";
import { ON_LIGHT, color, useThemeSpec } from "@/lib/design/theme";
import { useT } from "@/lib/i18n";

/** De lege staat (HANDOFF §11): nog niemand hier. */
export function EmptyFeed() {
  const t = useT();
  const router = useRouter();
  const mag = useThemeSpec().id === "magazine";
  if (mag) return <EmptyMagazine />;
  return (
    <View style={{ paddingHorizontal: GUTTER, paddingBottom: 20, gap: 12 }}>
      <Box fill="acid" style={{ paddingVertical: 18, paddingHorizontal: 16, gap: 10 }}>
        <Mono variant="micro" color={ON_LIGHT}>
          {t.emptyKicker}
        </Mono>
        <Head variant="emptyTitle" color={ON_LIGHT}>
          {t.emptyTitle}
        </Head>
        <Serif variant="captionLarge" color={ON_LIGHT} style={{ fontSize: 18, lineHeight: 23 }}>
          {t.emptyBody}
        </Serif>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
          <Btn label={t.scanQr} flex={1} bg={ON_LIGHT} fg={color("acid")} onPress={() => router.push("/qr-scan")} />
          <Btn label={t.shareCode} flex={1} bg="transparent" fg={ON_LIGHT} style={{ borderWidth: 1.5, borderColor: ON_LIGHT }} onPress={() => router.push("/qr-code")} />
        </View>
      </Box>
      <DashedCard onPress={() => router.push("/post-compose")}>{t.emptyCompose}</DashedCard>
    </View>
  );
}

/**
 * Magazine (mobile-app.dc.html, `magEmpty`): geen vlak maar een blok tussen
 * twee haarlijnen — kicker, titel in serif, de uitleg cursief, en twee
 * tekstlinks. Het woordmerk erboven tekent de feed zelf.
 */
function EmptyMagazine() {
  const t = useT();
  const router = useRouter();
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  return (
    <View>
      <View style={{ padding: 24, gap: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: rule }}>
        <Label size={9} weight={500} ls={0.2} color={dim}>
          {t.emptyKicker}
        </Label>
        <Ser size={36} f={1.04} ls={-0.015}>
          {t.emptyTitle}
        </Ser>
        <Ser size={18} italic f={1.4} color={dim}>
          {t.emptyBody}
        </Ser>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 18, marginTop: 6, flexWrap: "wrap" }}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/qr-scan")} hitSlop={10}>
            <Ser size={18} underline>
              {t.scanQr}
            </Ser>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push("/qr-code")} hitSlop={10}>
            <Ser size={18} color={dim}>
              {t.shareCode}
            </Ser>
          </Pressable>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push("/post-compose")} style={{ padding: 24 }}>
        <Ser size={19} italic color={dim}>
          {t.emptyCompose}
        </Ser>
      </Pressable>
    </View>
  );
}
