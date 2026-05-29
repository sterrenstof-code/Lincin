/**
 * Edge Function: send-push
 *
 * Verstuurt push-notificaties naar alle devices van de ontvanger(s).
 * Ondersteunt twee token-types:
 *   - Expo push tokens (native iOS/Android): naar exp.host
 *   - Web Push subscriptions (browser PWA): via VAPID naar de browser endpoint
 *
 * Triggeren via een Database Webhook (Supabase Studio → Database → Webhooks):
 *   - Table: messages, Events: INSERT
 *   - Table: friendships, Events: INSERT
 *
 * Deploy:
 *   supabase functions deploy send-push --no-verify-jwt
 *
 * Required secrets (stel in via Supabase Studio → Edge Functions → Secrets):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (auto-injected)
 *   VAPID_PUBLIC_KEY     (zelfde waarde als EXPO_PUBLIC_VAPID_PUBLIC_KEY in de app)
 *   VAPID_PRIVATE_KEY    (geheim — nooit in de client)
 *   VAPID_SUBJECT        (mailto: of URL, bv. "mailto:tom@beyondesign.io")
 */

// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore
import webpush from "https://esm.sh/web-push@3.6.7";

// @ts-ignore Deno
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
// @ts-ignore Deno
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
// @ts-ignore Deno
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@lincin.app";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

/** Een web push subscription zoals opgeslagen in user_devices.push_token. */
interface WebPushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Onderscheid web push subscriptions van Expo push tokens. */
function isWebPushSubscription(token: string): boolean {
  try {
    const obj = JSON.parse(token);
    return typeof obj?.endpoint === "string" && typeof obj?.keys?.auth === "string";
  } catch {
    return false;
  }
}

interface PushNotification {
  to: string;         // Expo push token OF JSON-string van web subscription
  title: string;
  body: string;
  data: Record<string, any>;
}

/** Stuur web push via VAPID naar één subscription. */
async function sendWebPush(
  subscriptionJson: string,
  title: string,
  body: string,
  data: Record<string, any>
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.warn("VAPID keys niet geconfigureerd — web push overgeslagen");
    return;
  }
  const subscription: WebPushSubscription = JSON.parse(subscriptionJson);
  const payload = JSON.stringify({ title, body, data });
  await webpush.sendNotification(subscription, payload);
}

// @ts-ignore Deno
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    const payload = await req.json();
    const table: string = payload.table;
    const record: Record<string, any> = payload.record ?? {};

    const admin = createClient(
      // @ts-ignore Deno
      Deno.env.get("SUPABASE_URL")!,
      // @ts-ignore Deno
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let notifications: PushNotification[] = [];

    if (table === "messages") {
      const chatId = record.chat_id;
      const senderId = record.sender_id;

      const { data: chat } = await admin
        .from("chats")
        .select("id, type, name")
        .eq("id", chatId)
        .maybeSingle();
      if (!chat) return new Response("chat not found", { status: 200 });

      const { data: members } = await admin
        .from("chat_members")
        .select("user_id")
        .eq("chat_id", chatId)
        .neq("user_id", senderId);
      const recipientIds = (members ?? []).map((m: any) => m.user_id);
      if (recipientIds.length === 0) return new Response("no recipients", { status: 200 });

      const { data: sender } = await admin
        .from("profiles")
        .select("display_name, username")
        .eq("id", senderId)
        .maybeSingle();
      const senderName = sender?.display_name ?? sender?.username ?? "Iemand";

      const { data: devices } = await admin
        .from("user_devices")
        .select("push_token")
        .in("user_id", recipientIds);

      const title =
        chat.type === "group"
          ? `${senderName} in ${chat.name ?? "groep"}`
          : senderName;

      notifications = (devices ?? []).map((d: any) => ({
        to: d.push_token,
        title,
        body: "Nieuw bericht",
        data: { chat_id: chatId, type: "message" },
      }));
    } else if (table === "friendships") {
      if (record.status !== "pending") {
        return new Response("not a new request", { status: 200 });
      }
      const requesterId = record.requester_id;
      const addresseeId = record.addressee_id;

      const { data: requester } = await admin
        .from("profiles")
        .select("display_name, username")
        .eq("id", requesterId)
        .maybeSingle();
      const name = requester?.display_name ?? requester?.username ?? "Iemand";

      const { data: devices } = await admin
        .from("user_devices")
        .select("push_token")
        .eq("user_id", addresseeId);

      notifications = (devices ?? []).map((d: any) => ({
        to: d.push_token,
        title: "Nieuw vriendschapsverzoek",
        body: `${name} wil je toevoegen op Lincin.`,
        data: { type: "friend_request" },
      }));
    } else {
      return new Response("unsupported table", { status: 200 });
    }

    if (notifications.length === 0) {
      return new Response("nothing to send", { status: 200 });
    }

    // Splits in Expo tokens vs web push subscriptions.
    const expoNotifications = notifications.filter(
      (n) => !isWebPushSubscription(n.to)
    );
    const webNotifications = notifications.filter(
      (n) => isWebPushSubscription(n.to)
    );

    const results: Record<string, any> = {};

    // --- Expo push (native iOS/Android) ---
    if (expoNotifications.length > 0) {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        body: JSON.stringify(
          expoNotifications.map((n) => ({
            to: n.to,
            title: n.title,
            body: n.body,
            data: n.data,
            sound: "default",
          }))
        ),
      });
      results.expo = await response.json();
    }

    // --- Web push (PWA) ---
    if (webNotifications.length > 0) {
      const webResults = await Promise.allSettled(
        webNotifications.map((n) =>
          sendWebPush(n.to, n.title, n.body, n.data)
        )
      );
      results.web = webResults.map((r) =>
        r.status === "fulfilled" ? "ok" : r.reason?.message ?? "error"
      );
    }

    return new Response(JSON.stringify({ ok: true, ...results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
