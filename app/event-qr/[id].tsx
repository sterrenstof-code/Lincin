import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";

import { DetailState } from "@/components/DetailState";
import { ScreenContainer } from "@/components/ScreenContainer";
import { safeBack } from "@/lib/nav";
import { useAuth } from "@/lib/auth/provider";
import { buildEventJoinUrl, getEvent } from "@/lib/api/events";
import { copyToClipboard, shareText } from "@/lib/share";
import { creamOnDark, desk, feed } from "@/lib/design/type";
import { NL } from "@/lib/locale";

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

  /**
   * Een schijfje in het midden van een leeg scherm, en geen uitweg.
   *
   * `isLoading || !data` dekte drie situaties met één beeld — nog bezig,
   * mislukt, of het event bestaat niet meer — en bij de laatste twee bleef
   * die spinner draaien tot je de app afsloot. Er stond geen kop boven en
   * dus ook geen sluitknop: dit scherm wordt vanaf de eventpagina geopend,
   * maar je komt er ook via een deep-link, en dan was er niets.
   *
   * `DetailState` scheidt de drie standen en brengt de balk mee. Zie
   * components/DetailState.tsx.
   */
  if (event.isLoading || event.isError || !event.data) {
    return (
      <DetailState
        kind={event.isLoading ? "loading" : event.isError ? "error" : "missing"}
        subject="Dit event"
        error={event.error}
        onRetry={() => event.refetch()}
        backLabel="Terug"
        onBack={() => safeBack(router, `/event/${eventId}`)}
      />
    );
  }

  const ev = event.data;
  const url = buildEventJoinUrl(ev.join_code);

  return (
    <SafeAreaView className="flex-1 bg-desk" edges={["top", "left", "right"]}>
      <ScreenContainer>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
            onPress={() => safeBack(router, `/event/${eventId}`)}
            className="w-9 h-9 bg-paper-soft items-center justify-center"
          >
            <Ionicons name="close" color={feed.ink} size={20} />
          </Pressable>
          <Text className="flex-1 text-desk-ink text-lg font-semibold ml-3">
            Uitnodigen
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View className="bg-paper p-6 items-center">
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
              {new Date(ev.starts_at).toLocaleDateString(NL, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
              {" · "}
              {ev.members_count} {ev.members_count === 1 ? "gast" : "gasten"}
            </Text>

            <View className="bg-paper-light p-5 border border-line-paper">
              <QRCode
                value={url}
                size={QR_SIZE}
                color={feed.ink}
                backgroundColor={feed.panel}
                logo={require("../../assets/images/icon.png")}
                logoSize={56}
                logoBackgroundColor={feed.panel}
                logoBorderRadius={12}
                logoMargin={4}
                ecl="H"
              />
            </View>

            <Text className="text-ink-muted text-xs text-center mt-5 leading-5">
              {ev.join_policy === "closed"
                ? "Laat iemand deze code scannen met hun camera, of stuur de link door. Dit is een gesloten event: hun verzoek komt eerst bij jou terecht."
                : "Laat iemand deze code scannen met hun camera, of stuur de link door. Ze worden automatisch toegevoegd aan het event."}
            </Text>
          </View>

          <View className="bg-paper-light border border-line-paper px-4 py-3 mt-4">
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
              className="flex-1 flex-row items-center justify-center bg-ink active:bg-ink-soft px-4 py-3"
            >
              <Ionicons name="share-outline" color={creamOnDark.DEFAULT} size={16} />
              <Text className="text-cream font-semibold ml-2">Deel link</Text>
            </Pressable>
            <Pressable
              onPress={onCopy}
              className="flex-1 flex-row items-center justify-center border border-desk-muted px-4 py-3"
            >
              <Ionicons name="link-outline" color={desk.ink} size={16} />
              <Text className="text-desk-ink font-semibold ml-2">Kopieer</Text>
            </Pressable>
          </View>

          {copyHint && (
            <View className="items-center mt-3">
              <View className="bg-paper-warm px-3 py-1">
                <Text className="text-ink text-xs font-medium">✓ {copyHint}</Text>
              </View>
            </View>
          )}
        </ScrollView>
      </ScreenContainer>
    </SafeAreaView>
  );
}
