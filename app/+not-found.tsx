import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";

/**
 * Catch-all 404 voor paden die de router niet kan matchen. Dit gebeurt
 * bv. wanneer iemand een outdated invite-link opent, een verkeerde
 * username intypt, of een share-link uit een ander gesprek volgt.
 *
 * In plaats van de naakte Vercel-edge 404 (waar geen weg terug uit is)
 * landt de gebruiker hier binnen de Lincin-shell met een duidelijke
 * boodschap + knop terug naar de feed. Werkt op web én native.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  function goHome() {
    // replace ipv push — we willen niet dat de 404 in de back-stack blijft
    // hangen zodat een tweede tap op "terug" niet hier opnieuw belandt.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <Stack.Screen options={{ headerShown: false }} />
      <ScreenContainer className="px-6 justify-center">
        <View className="items-center gap-6">
          <View className="size-20 rounded-full bg-paper-soft items-center justify-center">
            <Ionicons name="compass-outline" size={40} color="#1a1a1a" />
          </View>

          <View className="items-center gap-2">
            <Text className="text-3xl font-semibold text-ink text-center">
              Verdwaald
            </Text>
            <Text className="text-base text-ink/60 text-center leading-snug">
              Deze pagina bestaat niet (meer). Misschien is de link verlopen
              of werd hij verkeerd gekopieerd.
            </Text>
          </View>

          <Pressable
            onPress={goHome}
            className="bg-shell active:bg-ink rounded-full px-6 py-3 flex-row items-center gap-2"
          >
            <Ionicons name="arrow-back" size={18} color="#fdfaf3" />
            <Text className="text-cream font-medium">Terug naar Lincin</Text>
          </Pressable>
        </View>
      </ScreenContainer>
    </SafeAreaView>
  );
}
