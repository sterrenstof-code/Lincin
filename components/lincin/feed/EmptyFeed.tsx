import { useRouter } from "expo-router";
import { View } from "react-native";

import { Box, Btn, DashedCard, GUTTER, Head, Mono, Serif } from "@/components/lincin/ui";
import { ON_LIGHT, color } from "@/lib/design/theme";
import { useT } from "@/lib/i18n";

/** De lege staat (HANDOFF §11): nog niemand hier. */
export function EmptyFeed() {
  const t = useT();
  const router = useRouter();
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
