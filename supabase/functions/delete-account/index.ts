/**
 * Edge Function: delete-account (0105, nov 2026)
 *
 * Wist je account voorgoed: eerst je bestanden in de opslag (foto's,
 * video's, avatar, bijlagen), dan de gebruiker. Al je rijen hangen met
 * `on delete cascade` aan auth.users of profiles en gaan mee. Gesprekken
 * en groepen blijven voor de anderen; een groep waar jij eigenaar was krijgt
 * een nieuwe eigenaar.
 *
 * Alleen voor jezelf: wie gewist wordt komt uit de JWT, nooit uit de body.
 *
 * Deploy:
 *   supabase functions deploy delete-account
 */

// @ts-ignore deno imports — runs in Supabase Edge Functions runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.117.2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// @ts-ignore Deno
const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "content-type": "application/json" } });
}

// @ts-ignore Deno global
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const { data: who } = await admin.auth.getUser((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const userId = who?.user?.id;
  if (!userId) return json({ error: "Niet ingelogd" }, 401);

  const { data: files, error: prepErr } = await admin.rpc("prepare_account_deletion", { p_user: userId });
  if (prepErr) {
    console.warn("delete-account prepare", prepErr.message);
    return json({ error: "Verwijderen lukte niet. Probeer het opnieuw." }, 500);
  }

  const byBucket = new Map<string, string[]>();
  for (const f of (files ?? []) as { bucket_id: string; name: string }[]) {
    byBucket.set(f.bucket_id, [...(byBucket.get(f.bucket_id) ?? []), f.name]);
  }
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += 100) {
      const { error } = await admin.storage.from(bucket).remove(names.slice(i, i + 100));
      if (error) {
        console.warn("delete-account storage", bucket, error.message);
        return json({ error: "Verwijderen lukte niet. Probeer het opnieuw." }, 500);
      }
    }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(userId);
  if (delErr) {
    console.warn("delete-account user", delErr.message);
    return json({ error: "Verwijderen lukte niet. Probeer het opnieuw." }, 500);
  }
  return json({ ok: true });
});
