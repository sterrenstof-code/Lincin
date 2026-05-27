import "../global.css";

import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";

import { AuthProvider } from "@/lib/auth/provider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { initCryptoRandom } from "@/lib/crypto/random";
import { setupNotificationCategories, setupNotificationChannels } from "@/lib/push";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Refetch op window-focus is uit-by-default omdat het op native
      // overkill is, maar we zetten het AAN voor de chats-query specifiek
      // via useQuery-options. Hier blijft de default uit zodat andere
      // queries (posts, events) niet onnodig refetchen.
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    initCryptoRandom();
    setupNotificationChannels().catch(() => {});
    setupNotificationCategories().catch(() => {});
  }, []);

  useEffect(() => {
    // Wanneer de PWA heropend wordt vanuit de achtergrond, onthoudt iOS de
    // exacte URL van de laatste pagina (bv. /chat/abc). Dit geeft een lege
    // of gebroken chat bij herstart. We detecteren standalone-modus bij mount
    // en sturen detail-routes terug naar / zodat index.tsx naar de feed leidt.
    //
    // Uitzondering: push-notificatie navigatie (via SW postMessage) vuurt
    // ná deze mount, dus die overschrijft de redirect correct.
    if (typeof window === "undefined") return;
    // matchMedia bestaat niet op native iOS — enkel in browsers
    const isStandalone =
      (typeof window.matchMedia === "function" &&
        window.matchMedia("(display-mode: standalone)").matches) ||
      !!(window.navigator as any).standalone;
    if (!isStandalone) return;

    const path = window.location.pathname;
    const isDetailRoute =
      path.startsWith("/chat/") ||
      path.startsWith("/post/") ||
      path.startsWith("/event/") ||
      path.startsWith("/user/");
    if (isDetailRoute) {
      router.replace("/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // enkel op mount — niet bij elke navigatie

  return (
    <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={DarkTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
            <Stack.Screen
              name="chat/[id]"
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="add/[username]"
              options={{ headerShown: false, animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="user/[username]"
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="post/[id]"
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="profile-edit"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="post-compose"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="group-create"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="qr-code"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="group/[id]"
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="group-add/[id]"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="invite-email"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="set-password"
              options={{ headerShown: false, animation: "fade" }}
            />
            <Stack.Screen
              name="event-create"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="event/[id]"
              options={{ headerShown: false, animation: "slide_from_right" }}
            />
            <Stack.Screen
              name="e/[code]"
              options={{ headerShown: false, animation: "fade" }}
            />
            <Stack.Screen
              name="event-camera/[id]"
              options={{
                headerShown: false,
                presentation: "fullScreenModal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="event-qr/[id]"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="event-link/[id]"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="device-link"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="device-receive"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
          </Stack>
          <StatusBar style="light" />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
