import "../global.css";

import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform } from "react-native";
import "react-native-reanimated";

import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { AuthProvider } from "@/lib/auth/provider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { stackScreenLayout } from "@/components/PageTransition";
import { initCryptoRandom } from "@/lib/crypto/random";
import { installPageTransitions } from "@/lib/page-transition";
import { loadStoredPreference, useScheme } from "@/lib/design/theme";
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
  const scheme = useScheme();

  useEffect(() => {
    // Haalt de bewaarde voorkeur op. Op web heeft het script in `+html.tsx`
    // de stand al gezet vóór het eerste beeld; dit bevestigt hem alleen.
    loadStoredPreference();
    initCryptoRandom();
    // Zet de app-brede paginaovergangen aan. Op web omwikkelt dit élke
    // navigatie met een View Transition; op native een no-op, want daar
    // animeert de stack hieronder het al. Zie lib/page-transition.web.ts.
    installPageTransitions();
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
    // Op native staat de kleur van een prop als échte waarde in de boom (zie
    // lib/design/type.ts), dus een wissel moet hertekenen. De `key` doet dat.
    // Op web zit de kleur in een CSS-variabele en hoeft er niets te gebeuren —
    // vandaar dat de key daar constant blijft.
    <ErrorBoundary key={Platform.OS === "web" ? "app" : scheme}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider value={scheme === "light" ? DefaultTheme : DarkTheme}>
          {/* `animation: fade_from_bottom` is de native evenknie van de
              web-overgang: vervagen met een lichte stijging, dezelfde
              320ms. Hij geldt als default voor élk scherm hieronder; de
              modals zetten hem bewust om naar slide_from_bottom, want een
              modaal blad hoort van onder te komen en niet te vervagen.

              `animationDuration` werkt alleen op iOS (Android houdt zijn
              eigen systeemduur aan); zonder deze regel duurt hij daar 500ms.

              `screenLayout` vult het gat voor browsers zonder View
              Transitions — zie components/PageTransition.tsx. */}
          <Stack
            screenLayout={stackScreenLayout}
            screenOptions={{
              headerShown: false,
              animation: "fade_from_bottom",
              animationDuration: 320,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(app)" />
            <Stack.Screen
              name="chat/[id]"
              // Erft `fade_from_bottom` uit de screenOptions hierboven.
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="add/[username]"
              options={{ headerShown: false, animation: "slide_from_bottom" }}
            />
            <Stack.Screen
              name="user/[username]"
              // Erft `fade_from_bottom` uit de screenOptions hierboven.
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="post/[id]"
              // Erft `fade_from_bottom` uit de screenOptions hierboven.
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="bugs"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
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
              // Erft `fade_from_bottom` uit de screenOptions hierboven.
              options={{ headerShown: false }}
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
              // Erft `fade_from_bottom` uit de screenOptions hierboven.
              options={{ headerShown: false }}
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
          {/* De balk bovenaan is in béide standen zwart, dus de
              systeemklok erboven blijft licht. */}
          <StatusBar style="light" />
          <Analytics />
          <SpeedInsights />
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}
