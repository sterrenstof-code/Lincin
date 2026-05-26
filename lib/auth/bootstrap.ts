import { bytesToBase64 } from "../crypto/base64";
import { generateAndStoreIdentity, loadIdentity } from "../crypto/keys";
import { supabase } from "../supabase/client";

/**
 * Wordt aangeroepen na succesvolle login. Zorgt voor:
 *   1. Identity keypair op dit toestel (genereer indien afwezig).
 *   2. Profile-rij voor deze user.
 *   3. Sync van device pubkey naar profiel (met retry bij netwerk-jitter).
 *
 * Single-device model: één identity_pubkey per profiel. Logged-in-elsewhere
 * scenario lost de gebruiker manueel op via Profiel → Reset device keys
 * (welke browser dat doet, "wint" de account).
 */
export async function bootstrapProfile(args: {
  userId: string;
  email: string;
  preferredUsername?: string;
}): Promise<{ username: string | null; pubkeyMismatch: boolean }> {
  // 1. Load or generate identity keypair on this device.
  let identity = await loadIdentity();
  if (!identity) {
    identity = await generateAndStoreIdentity();
  }
  const pubB64 = bytesToBase64(identity.publicKey);

  // 2. Check whether profile already exists.
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, username, identity_pubkey")
    .eq("id", args.userId)
    .maybeSingle();
  if (selErr) throw selErr;

  if (!existing) {
    const username =
      args.preferredUsername ?? args.email.split("@")[0].toLowerCase();
    const { error } = await supabase.from("profiles").insert({
      id: args.userId,
      username,
      identity_pubkey: pubB64,
    });
    if (error) throw error;
    return { username, pubkeyMismatch: false };
  }

  // 3. Sync device pubkey naar profile bij mismatch (met 1 retry).
  if (existing.identity_pubkey !== pubB64) {
    let lastError: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { error } = await supabase
        .from("profiles")
        .update({ identity_pubkey: pubB64 })
        .eq("id", args.userId);
      if (!error) {
        lastError = null;
        break;
      }
      lastError = error;
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 600));
      }
    }
    if (lastError) {
      console.error(
        "[bootstrapProfile] pubkey sync naar Supabase faalde. Fix via Profiel → Sync naar profile.",
        lastError
      );
      return { username: existing.username, pubkeyMismatch: true };
    }
  }

  return { username: existing.username, pubkeyMismatch: false };
}
