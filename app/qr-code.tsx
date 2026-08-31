import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import { RequireSession } from "@/components/RequireSession";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { getProfile } from "@/lib/api/profiles";
import { buildAddFriendUrl, copyToClipboard, shareText } from "@/lib/share";
import { creamOnDark, desk, feed } from "@/lib/design/type";
import { safeBack } from "@/lib/nav";

const QR_SIZE = 260;

function QRCodeScreenBody() {
  const router = useRouter();
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const [copyHint, setCopyHint] = useState<string | null>(null);

  const profile = useQuery({
    queryKey: ["profile", myUserId],
    queryFn: () => getProfile(myUserId),
  });

  const username = profile.data?.username ?? "";
  const displayName = profile.data?.display_name;
  const heroName = displayName ?? username;
  const addUrl = username ? buildAddFriendUrl(username) : "";

  function flashHint(text: string) {
    setCopyHint(text);
    setTimeout(() => setCopyHint(null), 1600);
  }

  /**
   * Kopiëren en delen zeggen allebei óf het gelukt is.
   *
   * `lib/share.ts` geeft nadrukkelijk een uitkomst terug — `"shared"`,
   * `"copied"`, `"cancelled"`, `"failed"` — en beide functies keken alleen
   * naar één van de vier. Bij `"failed"` (een klembord dat geweigerd wordt,
   * een browser zonder rechten) gebeurde er dus letterlijk niets: je tikt op
   * "Kopieer link", er verschijnt geen bevestiging, en je weet niet of er nu
   * wel of niet iets in je klembord staat. Dan plak je het en dan blijkt het.
   *
   * `"cancelled"` blijft stil — dat is een keuze van de gebruiker en geen
   * mislukking.
   */
  async function onCopyUrl() {
    if (!addUrl) return;
    flashHint(
      (await copyToClipboard(addUrl))
        ? "Link gekopieerd"
        : "Kopiëren lukte niet — de link staat hieronder."
    );
  }

  async function onShare() {
    if (!addUrl) return;
    const r = await shareText({
      title: "Voeg me toe op Lincin",
      message: `Voeg me toe op Lincin: ${addUrl}`,
    });
    if (r === "copied") flashHint("Link gekopieerd");
    else if (r === "failed") flashHint("Delen lukte niet — de link staat hieronder.");
  }

  return (
    <SafeAreaView className="flex-1 bg-desk" edges={["top", "left", "right"]}>
      <ScreenContainer>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
          onPress={() => safeBack(router, "/(app)/profile")}
          className="w-9 h-9 bg-paper-soft items-center justify-center"
        >
          <Ionicons name="close" color={feed.ink} size={20} />
        </Pressable>
        <Text className="flex-1 text-desk-ink text-lg font-semibold ml-3">
          Jouw linc
        </Text>
      </View>

      <View className="flex-1 px-5">
        {/* QR-card */}
        <View className="bg-paper p-6 mt-6 items-center">
          <View className="bg-paper-light p-5 border border-line-paper">
            {addUrl ? (
              <QRCode
                value={addUrl}
                size={QR_SIZE}
                color={feed.ink}
                backgroundColor={feed.panel}
                logo={require("../assets/images/icon.png")}
                logoSize={56}
                logoBackgroundColor={feed.panel}
                logoBorderRadius={12}
                logoMargin={4}
                ecl="H"
              />
            ) : (
              <View style={{ width: QR_SIZE, height: QR_SIZE }} />
            )}
          </View>

          <Text className="text-2xl font-bold tracking-tight text-ink mt-5">
            {heroName || "…"}
          </Text>
          <Text className="text-ink-soft text-base">
            @{username || "…"}
          </Text>
        </View>

        {/* Actions */}
        <View className="flex-row gap-2 mt-4">
          <Pressable
            onPress={onShare}
            className="flex-1 flex-row items-center justify-center bg-ink active:bg-ink-soft px-4 py-3"
          >
            <Ionicons name="share-outline" color={creamOnDark.DEFAULT} size={16} />
            <Text className="text-cream font-semibold ml-2">Deel link</Text>
          </Pressable>
          <Pressable
            onPress={onCopyUrl}
            className="flex-1 flex-row items-center justify-center border border-desk-muted px-4 py-3"
          >
            <Ionicons name="link-outline" color={desk.ink} size={16} />
            <Text className="text-desk-ink font-semibold ml-2">Kopieer link</Text>
          </Pressable>
        </View>

        {copyHint && (
          <View className="items-center mt-3">
            <View className="bg-paper-warm px-3 py-1">
              <Text className="text-ink text-xs font-medium">✓ {copyHint}</Text>
            </View>
          </View>
        )}
      </View>
      </ScreenContainer>
    </SafeAreaView>
  );
}

/**
 * Dit scherm leest `session!.user.id` en staat in de wortelstack, die niets
 * bewaakt — zie components/RequireSession.tsx voor waarom dat een wit scherm
 * opleverde in plaats van een inlogpagina.
 */
export default function QRCodeScreen() {
  return (
    <RequireSession>
      <QRCodeScreenBody />
    </RequireSession>
  );
}
