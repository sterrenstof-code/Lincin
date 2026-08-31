import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { rememberPendingInvite } from "@/lib/pending-invite";
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
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      /**
       * De code moet de reis naar het inloggen overleven.
       *
       * Hier stond `?event=CODE` in de URL, met de opmerking dat dat de
       * eenvoudige manier was. Alleen las niemand hem ooit uit: niet het
       * inlogscherm, niet `app/index.tsx`. Je kwam na het inloggen binnen op
       * een lege feed en het event waarvoor je uitgenodigd was, was weg — en
       * dat is nu net de enige link die deze app naar buiten stuurt.
       *
       * Een queryparameter kán die reis ook niet overleven: op web zit er
       * een bevestigingsmail en een terugkeer vanaf een ander adres tussen.
       * Zie lib/pending-invite.ts; `app/index.tsx` verzilvert hem zodra er
       * een sessie is.
       */
      rememberPendingInvite(code);
      router.replace("/(auth)/login");
      return;
    }
    (async () => {
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
                <Text className="text-cream font-semibold">Naar Lincin</Text>
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
                <Text className="text-cream font-semibold">Naar Lincin</Text>
              </Pressable>
            </View>
          ) : (
            <View className="bg-paper p-8 w-full items-center">
              <View className="w-14 h-14 bg-flame items-center justify-center mb-3">
                <Ionicons name="sparkles" color={creamOnDark.DEFAULT} size={24} />
              </View>
              {/* "Je doet mee" was de standaardtak, dus hij stond er
                  vóórdat de RPC iets teruggegeven had — ook op het moment
                  dat het antwoord "je verzoek staat bij de host" of "dit
                  event bestaat niet" ging worden. Een scherm hoort geen
                  uitkomst te melden die het nog niet weet. */}
              <Text className="text-ink font-bold text-xl text-center mb-1">
                Je aanmelding loopt
              </Text>
              <Text className="text-ink-soft text-sm text-center">
                Even één moment — we kijken of dit event nog openstaat.
              </Text>
            </View>
          )}
        </View>
      </ScreenContainer>
    </SafeAreaView>
  );
}
