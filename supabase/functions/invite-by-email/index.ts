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
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    if (typeof email !== "string" || !email.includes("@")) {
      return json({ error: "Ongeldig e-mailadres" }, 400);
    }
    const cleanEmail = email.trim().toLowerCase();

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

    // Send the Supabase invite email. Returns 422 if user already exists.
    const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(
      cleanEmail
    );
    if (inviteErr) {
      const msg = inviteErr.message ?? "";
      if (/already|exists|registered/i.test(msg)) {
        return json(
          {
            error:
              "Deze persoon heeft al een Lincin-account. Voeg ze direct toe via hun handle.",
          },
          400
        );
      }
      return json({ error: msg }, 500);
    }

    // Record the pending invite so the post-signup trigger can use it.
    const { error: insertErr } = await admin
      .from("pending_invites")
      .upsert(
        { inviter_user_id: user.id, email: cleanEmail },
        { onConflict: "inviter_user_id,email" }
      );
    if (insertErr) {
      return json({ error: insertErr.message }, 500);
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: (e as Error).message ?? "Onbekende fout" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
