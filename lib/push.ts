import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { supabase } from "./supabase/client";

/**
 * iOS notification categories — actieknoppen in de notificatie zelf.
 *
 * "message" categorie: "Beantwoorden"-knop opent direct de chat.
 * Roep dit aan bij app-start, samen met setupNotificationChannels.
 *
 * De Edge Function die pushes verstuurt moet `categoryIdentifier: "message"`
 * meesturen in de notification payload voor iOS.
 */
export async function setupNotificationCategories(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.setNotificationCategoryAsync("message", [
      {
        identifier: "reply",
        buttonTitle: "Beantwoorden",
        // Opent de app naar de juiste chat
        options: { opensAppToForeground: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync("friend_request", [
      {
        identifier: "view",
        buttonTitle: "Bekijken",
        options: { opensAppToForeground: true },
      },
    ]);
  } catch {
    /* Niet-fataal — notificaties werken zonder categorieën gewoon */
  }
}

/**
 * Maak de Android-notificatiekanalen aan. Op Android 8+ (API 26) worden
 * notificaties zonder kanaal stilletjes genegeerd. Veilig om meerdere keren
 * te aanroepen — Android negeert duplicaten.
 *
 * Roep dit aan bij app-start vóór de eerste push-registratie.
 */
export async function setupNotificationChannels(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("messages", {
    name: "Berichten",
    description: "Notificaties voor nieuwe chatberichten.",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#E66B3F",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
  await Notifications.setNotificationChannelAsync("general", {
    name: "Algemeen",
    description: "Overige Lincin-meldingen (vriendschapsverzoeken, events).",
    importance: Notifications.AndroidImportance.DEFAULT,
    showBadge: true,
  });
}

/**
 * Configureer wat er gebeurt wanneer een notificatie binnenkomt terwijl de
 * app open is. Standaard tonen we de banner + speel het geluid niet
 * (gebruiker is al in de app, dus subtieler).
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Converteer de URL-safe base64 VAPID public key naar Uint8Array zoals de
 * browser PushManager dat verwacht als applicationServerKey.
 */
function vapidKeyToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/**
 * De publieke VAPID-sleutel.
 *
 * Twee bronnen, in volgorde: een omgevingsvariabele van de deploy, en
 * anders de waarde uit `app.config.ts`. Die tweede is er zodat een build
 * zonder extra configuratie tóch werkt — dat het er eerder alleen de eerste
 * was, is precies waarom web push nooit is aangegaan.
 */
function vapidPublicKey(): string | null {
  const fromEnv = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (fromEnv) return fromEnv;
  const fromConfig = (Constants.expoConfig?.extra as any)?.vapidPublicKey;
  return typeof fromConfig === "string" && fromConfig.length > 0 ? fromConfig : null;
}

/**
 * Web Push registratie via de native browser Push API.
 * Bypassed expo-notifications — die is bedoeld voor native iOS/Android.
 *
 * Flow:
 *   1. Registreer service worker (/sw.js)
 *   2. Vraag Notification-permissie
 *   3. Abonneer via pushManager met VAPID public key
 *   4. Sla de subscription JSON op in user_devices
 *
 * iOS-noot: Web Push werkt op iOS 16.4+ MAAR enkel als de app geïnstalleerd
 * is als PWA (via "Zet op beginscherm"). In de browser zelf doet het niets.
 * De InstallBanner component begeleidt gebruikers hierin.
 */
async function registerWebPush(userId: string): Promise<string | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  if (!("PushManager" in window)) return null;

  const vapidKey = vapidPublicKey();
  if (!vapidKey) return null; // Web push uitgeschakeld op deze deploy

  try {
    // Registreer de SW. Als hij al actief is, krijg je de bestaande
    // registratie terug — geen dubbele installatie.
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });
    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    // subscribe() is idempotent: bestaand abonnement → zelfde object terug.
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyToUint8Array(vapidKey),
    });

    const subscriptionJson = JSON.stringify(subscription.toJSON());

    const { error } = await supabase.from("user_devices").upsert(
      {
        user_id: userId,
        push_token: subscriptionJson,
        platform: "web",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "push_token" }
    );
    if (error) {
      console.warn("registerWebPush db error", error.message);
      return null;
    }

    return subscription.endpoint;
  } catch (e) {
    console.warn("registerWebPush failed", e);
    return null;
  }
}

/**
 * Vraag permissie + registreer push token + sla op in user_devices.
 * Roep dit één keer per sessie aan, na succesvolle bootstrap.
 *
 * Op web: gebruikt de native browser Push API + VAPID (zie registerWebPush).
 * Op iOS/Android: gebruikt Expo push tokens via Expo's push service.
 */
export async function registerPushToken(userId: string): Promise<string | null> {
  // Web: volledig eigen pad via browser Push API.
  if (Platform.OS === "web") {
    return registerWebPush(userId);
  }

  // Native: expo-notifications werkt niet op simulators.
  if (!Device.isDevice) return null;

  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.status === "granted";
  if (!granted) {
    const ask = await Notifications.requestPermissionsAsync();
    granted = ask.status === "granted";
  }
  if (!granted) return null;

  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;

    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    const token = tokenResponse.data;
    if (!token) return null;

    const { error } = await supabase.from("user_devices").upsert(
      {
        user_id: userId,
        push_token: token,
        platform: Platform.OS === "ios" ? "ios" : "android",
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "push_token" }
    );
    if (error) {
      console.warn("registerPushToken db error", error.message);
      return null;
    }

    return token;
  } catch (e) {
    console.warn("registerPushToken failed", e);
    return null;
  }
}

/**
 * Listener voor inkomende notificaties (native). Roep dit in een useEffect
 * aan en cleanup de returnwaarde. Op web worden taps afgehandeld via de
 * service worker (zie public/sw.js notificationclick + postMessage).
 */
export function addNotificationTapListener(
  onTap: (data: Record<string, any>) => void
) {
  const sub = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<
        string,
        any
      >;
      // "reply"-actie vanuit notificatie-center — zelfde navigatie als tap
      // (chat opent, gebruiker kan beantwoorden). Inline-send zonder app-open
      // vereist background task en is fase 2.
      onTap(data);
    }
  );
  return () => sub.remove();
}
