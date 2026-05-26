/**
 * Edge Function: send-push
 *
 * Verstuurt push-notificaties via Expo's push service. Te triggeren via een
 * Database Webhook (Supabase Studio → Database → Webhooks) op INSERT van
 * `messages` of `friendships`. De webhook payload bevat de nieuwe rij.
 *
 * Deploy:
 *   supabase functions deploy send-push --no-verify-jwt
 *
 * In Supabase Studio:
 *   Database → Webhooks → New webhook
 *     - Table: messages
 *     - Events: INSERT
 *     - HTTP Request → Supabase Edge Function → send-push
 *     - Body: payload zoals webhook hem stuurt
 *
 * Required secrets:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
 */

// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore Deno
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const payload = await req.json();
    // Supabase Webhooks bevatten {type, table, record, schema}
    const table: string = payload.table;
    const record: Record<string, any> = payload.record ?? {};

    const admin = createClient(
      // @ts-ignore Deno
      Deno.env.get("SUPABASE_URL")!,
      // @ts-ignore Deno
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let notifications: Array<{
      to: string;
      title: string;
      body: string;
      data: Record<string, any>;
    }> = [];

    if (table === "messages") {
      // Notify everyone in the chat except the sender.
      const chatId = record.chat_id;
      const senderId = record.sender_id;

      // Fetch chat type/name + members + sender display
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
      const senderName =
        sender?.display_name ?? sender?.username ?? "Iemand";

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
        body: "🔒 Nieuw bericht",
        data: { chat_id: chatId, type: "message" },
      }));
    } else if (table === "friendships") {
      // Notify addressee on new pending friend request.
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

    // Expo's push service accepts batches up to 100.
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
      },
      body: JSON.stringify(notifications),
    });
    const expoBody = await response.json();

    return new Response(JSON.stringify({ ok: true, expoBody }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
