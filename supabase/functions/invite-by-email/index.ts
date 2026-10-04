/**
 * Edge Function: invite-by-email
 *
 * Stuurt een Supabase-invite naar een email-adres en registreert een
 * pending_invite voor de inviter. Zodra de invitee z'n account aanmaakt,
 * materialiseert de DB-trigger in 0009 automatisch een vriendschap.
 *
 * Deploy:
 *   supabase functions deploy invite-by-email --no-verify-jwt
 *
 * Secrets nodig (worden automatisch door Supabase gevuld):
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 */

// @ts-ignore deno imports — runs in Supabase Edge Functions runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// @ts-ignore Deno global
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (cleanEmail.length < 3 || cleanEmail.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return json({ error: "Ongeldig e-mailadres" }, 400);
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    // Identify the caller via the JWT they sent.
    const userClient = createClient(
      // @ts-ignore Deno
      Deno.env.get("SUPABASE_URL")!,
      // @ts-ignore Deno
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return json({ error: "Niet ingelogd" }, 401);
    }

    if (user.email && user.email.toLowerCase() === cleanEmail) {
      return json({ error: "Je kan jezelf niet uitnodigen" }, 400);
    }

    // Privileged client to invite + write pending_invite.
    const admin = createClient(
      // @ts-ignore Deno
      Deno.env.get("SUPABASE_URL")!,
      // @ts-ignore Deno
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Hoeveel je mag uitnodigen (veiligheidscontrole okt 2026): zonder rem
    // kon één account onbeperkt mails laten versturen vanaf ons domein — en
    // dat raakt de mailreputatie en de limiet waarmee ook echte
    // aanmeldingen en wachtwoordherstel moeten werken.
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const [{ count: today }, { count: open }] = await Promise.all([
      admin.from("pending_invites").select("id", { count: "exact", head: true }).eq("inviter_user_id", user.id).gt("created_at", dayAgo),
      admin.from("pending_invites").select("id", { count: "exact", head: true }).eq("inviter_user_id", user.id),
    ]);
    if ((today ?? 0) >= 10 || (open ?? 0) >= 50) {
      return json({ error: "Je hebt vandaag al genoeg mensen uitgenodigd. Probeer het morgen opnieuw." }, 429);
    }

    // Send the Supabase invite email. Returns 422 if user already exists.
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      cleanEmail
    );
    if (inviteErr) {
      const msg = inviteErr.message ?? "";
      // Bestaat het account al, dan zeggen we dat niet: anders kon je met
      // deze functie nagaan wie er op Lincin zit.
      if (/already|exists|registered/i.test(msg)) return json({ ok: true });
      console.error("invite failed", msg);
      return json({ error: "De uitnodiging kon niet verstuurd worden." }, 500);
    }

    // Record the pending invite so the post-signup trigger can use it.
    const { error: insertErr } = await admin
      .from("pending_invites")
      .upsert(
        { inviter_user_id: user.id, email: cleanEmail },
        { onConflict: "inviter_user_id,email" }
      );
    if (insertErr) {
      console.error("pending_invites", insertErr.message);
      return json({ error: "De uitnodiging kon niet bewaard worden." }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    console.error("invite-by-email", (e as Error).message);
    return json({ error: "Onbekende fout" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
