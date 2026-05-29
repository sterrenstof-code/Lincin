import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { getProfile } from "@/lib/api/profiles";
import { buildAddFriendUrl, copyToClipboard, shareText } from "@/lib/share";

const QR_SIZE = 260;

export default function QRCodeScreen() {
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

  async function onCopyUrl() {
    if (!addUrl) return;
    if (await copyToClipboard(addUrl)) flashHint("Link gekopieerd");
  }

  async function onShare() {
    if (!addUrl) return;
    const r = await shareText({
      title: "Voeg me toe op Lincin",
      message: `Voeg me toe op Lincin: ${addUrl}`,
    });
    if (r === "copied") flashHint("Link gekopieerd");
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top", "left", "right"]}>
      <ScreenContainer>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
        >
          <Ionicons name="close" color="#1A1714" size={20} />
        </Pressable>
        <Text className="flex-1 text-cream text-lg font-semibold ml-3">
          Jouw linc
        </Text>
      </View>

      <View className="flex-1 px-5">
        {/* QR-card */}
        <View className="bg-paper rounded-3xl p-6 mt-6 items-center">
          <View className="bg-paper-light rounded-3xl p-5 border border-line-paper">
            {addUrl ? (
              <QRCode
                value={addUrl}
                size={QR_SIZE}
                color="#1A1714"
                backgroundColor="#F5EFE2"
                logo={require("../assets/images/icon.png")}
                logoSize={56}
                logoBackgroundColor="#F5EFE2"
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
            className="flex-1 flex-row items-center justify-center bg-ink active:bg-ink-soft rounded-full px-4 py-3"
          >
            <Ionicons name="share-outline" color="#F5E8D3" size={16} />
            <Text className="text-cream font-semibold ml-2">Deel link</Text>
          </Pressable>
          <Pressable
            onPress={onCopyUrl}
            className="flex-1 flex-row items-center justify-center border border-cream-muted rounded-full px-4 py-3"
          >
            <Ionicons name="link-outline" color="#F5E8D3" size={16} />
            <Text className="text-cream font-semibold ml-2">Kopieer link</Text>
          </Pressable>
        </View>

        {copyHint && (
          <View className="items-center mt-3">
            <View className="bg-paper-warm rounded-full px-3 py-1">
              <Text className="text-ink text-xs font-medium">✓ {copyHint}</Text>
            </View>
          </View>
        )}
      </View>
      </ScreenContainer>
    </SafeAreaView>
  );
}
