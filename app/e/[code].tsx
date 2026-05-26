import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { joinEventByCode } from "@/lib/api/events";

/**
 * Landing voor /e/{join_code}: roept join_event RPC aan, doet auto-redirect
 * naar /event/{event_id} bij succes. Bij niet-ingelogd: stuur naar login.
 */
export default function JoinEventScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session, loading } = useAuth();
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = (raw ?? "").toString();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        const eventId = await joinEventByCode(code);
        await qc.invalidateQueries({ queryKey: ["events", session.user.id] });
        router.replace(`/event/${eventId}`);
      } catch (e: any) {
        setError(e?.message ?? "Kon event niet joinen.");
      } finally {
        setBusy(false);
      }
    })();
  }, [code, loading, session, router, qc]);

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top", "left", "right"]}>
      <ScreenContainer>
        <View className="flex-1 items-center justify-center px-6">
          {error ? (
            <View className="bg-paper rounded-3xl p-8 w-full items-center">
              <View className="w-14 h-14 rounded-full bg-paper-warm items-center justify-center mb-3">
                <Ionicons name="alert-circle-outline" color="#1A1714" size={24} />
              </View>
              <Text className="text-ink font-bold text-xl text-center mb-1">
                Kon niet meedoen
              </Text>
              <Text className="text-ink-soft text-sm text-center leading-5">
                {error}
              </Text>
              <Pressable
                onPress={() => router.replace("/(app)/feed")}
                className="mt-5 bg-ink active:bg-ink-soft rounded-full px-6 py-3"
              >
                <Text className="text-cream font-semibold">Naar Lincin</Text>
              </Pressable>
            </View>
          ) : (
            <View className="bg-paper rounded-3xl p-8 w-full items-center">
              <View className="w-14 h-14 rounded-full bg-flame items-center justify-center mb-3">
                <Ionicons name="sparkles" color="#F5E8D3" size={24} />
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
