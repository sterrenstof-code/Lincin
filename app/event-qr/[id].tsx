import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { buildEventJoinUrl, getEvent } from "@/lib/api/events";
import { copyToClipboard, shareText } from "@/lib/share";

const QR_SIZE = 260;

export default function EventQrScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id!;
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const event = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => getEvent(eventId, myUserId),
  });

  const [copyHint, setCopyHint] = useState<string | null>(null);

  function flashHint(text: string) {
    setCopyHint(text);
    setTimeout(() => setCopyHint(null), 1600);
  }

  async function onShare() {
    if (!event.data) return;
    const url = buildEventJoinUrl(event.data.join_code);
    const r = await shareText({
      title: `Join "${event.data.name}" op Lincin`,
      message: `Je bent uitgenodigd voor "${event.data.name}": ${url}`,
    });
    if (r === "copied") flashHint("Link gekopieerd");
  }

  async function onCopy() {
    if (!event.data) return;
    const url = buildEventJoinUrl(event.data.join_code);
    if (await copyToClipboard(url)) flashHint("Link gekopieerd");
  }

  if (event.isLoading || !event.data) {
    return (
      <SafeAreaView className="flex-1 bg-shell">
        <ScreenContainer>
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#F5E8D3" />
          </View>
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  const ev = event.data;
  const url = buildEventJoinUrl(ev.join_code);

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
            Uitnodigen
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View className="bg-paper rounded-3xl p-6 items-center">
            <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
              Scan om mee te doen
            </Text>
            <Text
              className="text-2xl font-bold tracking-tight text-ink mb-1 text-center"
              numberOfLines={2}
            >
              {ev.name}
            </Text>
            <Text className="text-ink-soft text-sm text-center mb-5">
              {new Date(ev.starts_at).toLocaleDateString("nl-BE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {" · "}
              {ev.members_count} {ev.members_count === 1 ? "gast" : "gasten"}
            </Text>

            <View className="bg-paper-light rounded-3xl p-5 border border-line-paper">
              <QRCode
                value={url}
                size={QR_SIZE}
                color="#1A1714"
                backgroundColor="#F5EFE2"
                logo={require("../../assets/images/icon.png")}
                logoSize={56}
                logoBackgroundColor="#F5EFE2"
                logoBorderRadius={12}
                logoMargin={4}
                ecl="H"
              />
            </View>

            <Text className="text-ink-muted text-xs text-center mt-5 leading-5">
              Laat iemand deze code scannen met hun camera, of stuur de link door. Ze worden automatisch toegevoegd aan het event.
            </Text>
          </View>

          <View className="bg-paper-light border border-line-paper rounded-2xl px-4 py-3 mt-4">
            <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
              Join-link
            </Text>
            <Text className="text-ink text-sm font-mono" numberOfLines={1}>
              {url}
            </Text>
          </View>

          <View className="flex-row gap-2 mt-4">
            <Pressable
              onPress={onShare}
              className="flex-1 flex-row items-center justify-center bg-ink active:bg-ink-soft rounded-full px-4 py-3"
            >
              <Ionicons name="share-outline" color="#F5E8D3" size={16} />
              <Text className="text-cream font-semibold ml-2">Deel link</Text>
            </Pressable>
            <Pressable
              onPress={onCopy}
              className="flex-1 flex-row items-center justify-center border border-cream-muted rounded-full px-4 py-3"
            >
              <Ionicons name="link-outline" color="#F5E8D3" size={16} />
              <Text className="text-cream font-semibold ml-2">Kopieer</Text>
            </Pressable>
          </View>

          {copyHint && (
            <View className="items-center mt-3">
              <View className="bg-paper-warm rounded-full px-3 py-1">
                <Text className="text-ink text-xs font-medium">✓ {copyHint}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </ScreenContainer>
    </SafeAreaView>
  );
}
