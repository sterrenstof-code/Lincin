import "../global.css";

import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Fragment, useEffect, type ReactNode } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "@/lib/auth/provider";
import { WebAnalytics } from "@/components/WebAnalytics";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OfflineNotice } from "@/components/OfflineNotice";
import { LincinThemeProvider } from "@/components/lincin/ThemeProvider";
import { PageTransition } from "@/components/PageTransition";
import { initCryptoRandom } from "@/lib/crypto/random";
import { installPageTransitions } from "@/lib/page-transition";
import { ConfirmProvider } from "@/lib/confirm";
import { ToastProvider } from "@/lib/toast";
import { loadStoredPreference, useScheme, useTheme, useThemeSpec } from "@/lib/design/theme";
import { setDesktopNow, useIsDesktop } from "@/lib/lincin/desktop";
import { desk, FONT_FILES } from "@/lib/design/type";
import { useFonts } from "expo-font";
import { LightboxHost } from "@/components/lincin/Lightbox";
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

/** Eén modaal blad: van onder, zonder kop. */
const MODAL = {
  headerShown: false,
  presentation: "modal",
  animation: "slide_from_bottom",
} as const;

/**
 * Elk scherm hertekent zich bij een wissel van thema.
 *
 * `color()` is op web een variabele, maar de kaderdikte (`BORDER`), de
 * letter van de koppen (`lincinType`) en de ronding zijn gewone waarden
 * die een scherm bij het tekenen leest. Een `key` op de inhoud van elk
 * scherm laat dat scherm opnieuw beginnen zónder de navigatie te raken:
 * wie in Instellingen van thema wisselt, blijft in Instellingen. Op web
 * blijft de paginaovergang (`PageTransition`) eromheen staan.
 */
function ThemedScreen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const body = Platform.OS === "web" ? <PageTransition>{children}</PageTransition> : children;
  return <Fragment key={theme}>{body}</Fragment>;
}

const themedScreenLayout = ({ children }: { children: ReactNode }) => <ThemedScreen>{children}</ThemedScreen>;

export default function RootLayout() {
  const scheme = useScheme();
  const spec = useThemeSpec();
  // Boven 1100px opent een kaart het paneel rechts in plaats van een scherm.
  setDesktopNow(useIsDesktop());
  /**
   * De letters van v2 (lib/design/type.ts). Op web staan ze in de <head>
   * (`app/+html.tsx`) en is dit meteen klaar; op native laden ze hier, en
   * tot die tijd staat er niets — een halve tel systeemletter die daarna
   * verspringt is lelijker dan een halve tel leeg blad.
   */
  const [fontsReady] = useFonts(Platform.OS === "web" ? {} : FONT_FILES);

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

  return (
    // Op native staat de kleur van een prop als échte waarde in de boom (zie
    // lib/design/type.ts), dus een wissel moet hertekenen. De `key` doet dat.
    // Op web zit de kleur in een CSS-variabele en hoeft er niets te gebeuren —
    // vandaar dat de key daar constant blijft.
    <ErrorBoundary key={Platform.OS === "web" ? "app" : scheme}>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LincinThemeProvider>
        <ThemeProvider value={spec.dark ? DarkTheme : DefaultTheme}>
          {/* De strook onderaan die zegt wat er zojuist misging. Staat hier
              en niet per scherm: hij ligt óp de navigatie, dus een melding
              overleeft de pagina die hem opriep. Zie lib/toast.tsx. */}
          <ToastProvider>
          {/* De vraag "weet je het zeker" hoorde op web bij de browser, en
              die gooit het label weg dat zegt wát er gaat gebeuren — ook bij
              het resetten van je toestelsleutels, de enige onomkeerbare
              handeling in deze app. Zie lib/confirm.tsx. */}
          <ConfirmProvider>
            <RootStack />
            {/* Blijft staan zolang de toestand duurt — anders dan de toast,
                die een gebeurtenis meldt en weer weggaat. Zie het onderdeel. */}
            <OfflineNotice />
            {/* De lichtbak van 2.1: één exemplaar, elke kaart kan hem openen. */}
            <LightboxHost />
          </ConfirmProvider>
          </ToastProvider>
          {/* De klok volgt het blad: donker op papier, licht op een
              donker blad (kleur-donker). */}
          <StatusBar style={spec.dark ? "light" : "dark"} />
          <WebAnalytics />
        </ThemeProvider>
        </LincinThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
    </ErrorBoundary>
  );
}

/**
 * De navigator, pas zodra bekend is wie er is.
 *
 * Bijna elk scherm leest `session!.user` alsof die er altijd is. Vanuit de
 * app klopt dat — je komt er via een tab of een tik, en dan is de sessie
 * al geladen. Maar een adres kun je ook rechtstreeks openen: verversen,
 * een pushmelding, de deelknop van de browser die op /post-compose landt.
 * Dan stond het scherm er vóór de sessie, en viel de app om op het eerste
 * `.user`. Vier schermen hadden daar elk een eigen wacht voor; de rest
 * niet.
 *
 * Nu wacht de hele stack één keer, hier. En wie er niet is, komt niet op
 * een scherm dat een sessie nodig heeft: `Stack.Protected` stuurt je naar
 * de eerste vrije route (index), en die naar het inlogscherm. Wat buiten
 * de wacht staat is precies wat zonder sessie moet werken: inloggen, een
 * event-uitnodiging, iemands deellink.
 */
function RootStack() {
  const { session, loading } = useAuth();
  const router = useRouter();

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

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-desk">
        <ActivityIndicator color={desk.ink} />
      </View>
    );
  }

  return (
    /* `animation: fade_from_bottom` is de native evenknie van de
       web-overgang: vervagen met een lichte stijging, dezelfde 320ms. Hij
       geldt als default voor élk scherm hieronder; de modals zetten hem om
       naar slide_from_bottom, want een modaal blad hoort van onder te
       komen en niet te vervagen.

       `animationDuration` werkt alleen op iOS (Android houdt zijn eigen
       systeemduur aan); zonder deze regel duurt hij daar 500ms.

       `screenLayout` vult het gat voor browsers zonder View Transitions —
       zie components/PageTransition.tsx. */
    <Stack
      screenLayout={themedScreenLayout}
      screenOptions={{
        headerShown: false,
        animation: "fade_from_bottom",
        animationDuration: 320,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="e/[code]" options={{ animation: "fade" }} />
      <Stack.Screen name="add/[username]" options={{ animation: "slide_from_bottom" }} />

      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
        <Stack.Screen name="set-password" options={{ animation: "fade" }} />
        {/*
          Terugvegen op een gesprek en een vondst.

          Dit vraagt om een schuivende overgang: een veeg pakt de pagina vast
          en sleept hem opzij, en bij `fade_from_bottom` is er niets om vast
          te pakken. Randgebaar en niet over het hele scherm: in een gesprek
          ligt op elke bubbel al een horizontale veeg om te antwoorden, en
          twee herkenners die dezelfde beweging claimen laten er één
          verliezen.
        */}
        <Stack.Screen name="chat/[id]" options={{ animation: "slide_from_right", gestureEnabled: true }} />
        <Stack.Screen name="post/[id]" options={{ animation: "slide_from_right", gestureEnabled: true }} />
        <Stack.Screen name="user/[username]" />
        <Stack.Screen name="group/[id]" />
        <Stack.Screen name="event/[id]" />
        <Stack.Screen name="list/[id]" />
        <Stack.Screen name="profile-edit" options={MODAL} />
        <Stack.Screen name="post-compose" options={MODAL} />
        <Stack.Screen name="poll-compose" options={MODAL} />
        <Stack.Screen name="list-compose" options={MODAL} />
        <Stack.Screen name="call-plan-compose" options={MODAL} />
        <Stack.Screen name="group-create" options={MODAL} />
        <Stack.Screen name="group-add/[id]" options={MODAL} />
        <Stack.Screen name="invite-email" options={MODAL} />
        <Stack.Screen name="event-create" options={MODAL} />
        <Stack.Screen name="event-qr/[id]" options={MODAL} />
        <Stack.Screen name="event-link/[id]" options={MODAL} />
        <Stack.Screen name="qr-code" options={MODAL} />
        <Stack.Screen name="device-link" options={MODAL} />
        <Stack.Screen name="device-receive" options={MODAL} />
        <Stack.Screen
          name="event-camera/[id]"
          options={{ headerShown: false, presentation: "fullScreenModal", animation: "slide_from_bottom" }}
        />
        <Stack.Screen
          name="qr-scan"
          options={{ headerShown: false, presentation: "fullScreenModal", animation: "slide_from_bottom" }}
        />
      </Stack.Protected>
    </Stack>
  );
}
