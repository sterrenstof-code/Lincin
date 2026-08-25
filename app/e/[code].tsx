import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { joinEventByCode } from "@/lib/api/events";
import { creamOnDark, feed, flame } from "@/lib/design/type";

/**
 * Landing voor /e/{join_code}: roept de join_event RPC aan.
 *
 * Bij een **open** event sta je meteen in de gastenlijst en sturen we door
 * naar /event/{id}. Bij een **gesloten** event is er nog niets om naartoe te
 * gaan — je verzoek staat bij de host — dus blijft dit scherm staan met de
 * uitleg. Bij niet-ingelogd: eerst naar login.
 */
export default function JoinEventScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session, loading } = useAuth();
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = (raw ?? "").toString();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      // Niet ingelogd → bewaar code voor na login (eenvoudig: in URL via redirect)
      router.replace(`/(auth)/login?event=${encodeURIComponent(code)}`);
      return;
    }
    (async () => {
      setBusy(true);
      try {
        const result = await joinEventByCode(code);
        await qc.invalidateQueries({ queryKey: ["events", session.user.id] });
        if (result.status === "pending") {
          setPending(true);
          return;
        }
        router.replace(`/event/${result.eventId}`);
      } catch (e: any) {
        setError(e?.message ?? "Kon event niet joinen.");
      } finally {
        setBusy(false);
      }
    })();
  }, [code, loading, session, router, qc]);

  return (
    <SafeAreaView className="flex-1 bg-desk" edges={["top", "left", "right"]}>
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-6">
          {error ? (
            <View className="bg-paper p-8 w-full items-center">
              <View className="w-14 h-14 bg-paper-warm items-center justify-center mb-3">
                <Ionicons name="alert-circle-outline" color={feed.ink} size={24} />
              </View>
              <Text className="text-ink font-bold text-xl text-center mb-1">
                Kon niet meedoen
              </Text>
              <Text className="text-ink-soft text-sm text-center leading-5">
                {error}
              </Text>
              <Pressable
                onPress={() => router.replace("/(app)/feed")}
                className="mt-5 bg-ink active:bg-ink-soft px-6 py-3"
              >
                <Text className="text-desk-ink font-semibold">Naar Lincin</Text>
              </Pressable>
            </View>
          ) : pending ? (
            <View className="bg-paper p-8 w-full items-center">
              <View className="w-14 h-14 bg-paper-warm items-center justify-center mb-3">
                <Ionicons name="hourglass-outline" color={feed.ink} size={24} />
              </View>
              <Text className="text-ink font-bold text-xl text-center mb-1">
                Verzoek verstuurd
              </Text>
              <Text className="text-ink-soft text-sm text-center leading-5">
                Dit is een gesloten event. De organisator kreeg je verzoek en
                laat je binnen zodra hij het goedkeurt — je krijgt er een
                melding van.
              </Text>
              <Pressable
                onPress={() => router.replace("/(app)/events")}
                className="mt-5 bg-ink active:bg-ink-soft px-6 py-3"
              >
                <Text className="text-desk-ink font-semibold">Naar Lincin</Text>
              </Pressable>
            </View>
          ) : (
            <View className="bg-paper p-8 w-full items-center">
              <View className="w-14 h-14 bg-flame items-center justify-center mb-3">
                <Ionicons name="sparkles" color={creamOnDark.DEFAULT} size={24} />
              </View>
              <Text className="text-ink font-bold text-xl text-center mb-1">
                Je doet mee
              </Text>
              <Text className="text-ink-soft text-sm text-center">
                {busy ? "Even één moment…" : "Bijna klaar"}
              </Text>
            </View>
          )}
        </View>
      </ScreenContainer>
    </SafeAreaView>
  );
}
