import { bytesToBase64, base64ToBytes } from "../crypto/base64";
import {
  generateAndStoreIdentity,
  loadIdentity,
  storeIdentity,
} from "../crypto/keys";
import { supabase } from "../supabase/client";

/**
 * Wordt aangeroepen na succesvolle login. Zorgt voor:
 *   1. Identity keypair beschikbaar op dit toestel.
 *   2. Sleutels gesynchroniseerd met de server (profiles.identity_privkey).
 *
 * Defensief ontworpen: werkt ook als migratie 0026 (identity_privkey kolom)
 * nog niet is uitgevoerd — in dat geval worden sleutels alleen lokaal bewaard.
 */
export async function bootstrapProfile(args: {
  userId: string;
  email: string;
  preferredUsername?: string;
  /** @deprecated Genegeerd */
  confirmOverwrite?: boolean;
}): Promise<{
  username: string | null;
  pubkeyMismatch: boolean;
  isNewDevice: boolean;
  needsDeviceConfirm: boolean;
}> {
  // ── Stap 1: Haal basisprofiel op (stabiele kolommen — werkt altijd) ──────
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, username, identity_pubkey")
    .eq("id", args.userId)
    .maybeSingle();
  if (selErr) throw selErr;

  // ── Stap 2: Probeer identity_privkey op te halen (migratie 0026) ─────────
  // Kan mislukken als de migratie nog niet is uitgevoerd — we vangen dit op.
  let storedPrivkey: string | null = null;
  if (existing) {
    try {
      const { data: privRow } = await supabase
        .from("profiles")
        .select("identity_privkey")
        .eq("id", args.userId)
        .maybeSingle();
      storedPrivkey = (privRow as any)?.identity_privkey ?? null;
    } catch {
      // Kolom bestaat nog niet (migratie 0026 niet uitgevoerd) — doorgaan.
    }
  }

  // Helper: sla privkey op in server (fire-and-forget bij kolomfout)
  async function saveKeysToServer(pubB64: string, privB64: string): Promise<void> {
    try {
      await supabase
        .from("profiles")
        .update({ identity_pubkey: pubB64, identity_privkey: privB64 } as any)
        .eq("id", args.userId);
    } catch {
      // Kolom bestaat nog niet — lokale sleutels volstaan voor nu.
    }
  }

  // ── A. Lokale sleutels aanwezig ──────────────────────────────────────────
  const localIdentity = await loadIdentity();
  if (localIdentity) {
    const pubB64 = bytesToBase64(localIdentity.publicKey);
    const privB64 = bytesToBase64(localIdentity.secretKey);

    if (!existing) {
      // Nieuw account, lokale keys al aanwezig.
      const username =
        args.preferredUsername ?? args.email.split("@")[0].toLowerCase();
      // Probeer met identity_privkey; val terug op alleen identity_pubkey bij fout.
      const { error: insErr } = await supabase.from("profiles").insert({
        id: args.userId,
        username,
        identity_pubkey: pubB64,
        identity_privkey: privB64,
      } as any);
      if (insErr) {
        // Kolom bestaat nog niet — insert zonder privkey.
        const { error: insErr2 } = await supabase.from("profiles").insert({
          id: args.userId,
          username,
          identity_pubkey: pubB64,
        });
        if (insErr2) throw insErr2;
      }
      return { username, pubkeyMismatch: false, isNewDevice: false, needsDeviceConfirm: false };
    }

    // Sync sleutels naar server als ze er nog niet staan of als pubkey veranderd is.
    if (!storedPrivkey || (existing as any).identity_pubkey !== pubB64) {
      await saveKeysToServer(pubB64, privB64);
    }

    return {
      username: existing.username,
      pubkeyMismatch: false,
      isNewDevice: false,
      needsDeviceConfirm: false,
    };
  }

  // ── B. Geen lokale sleutels — herstel van server ─────────────────────────
  if (storedPrivkey && existing?.identity_pubkey) {
    const kp = {
      secretKey: base64ToBytes(storedPrivkey),
      publicKey: base64ToBytes(existing.identity_pubkey),
    };
    await storeIdentity(kp);
    return {
      username: existing.username,
      pubkeyMismatch: false,
      isNewDevice: true,
      needsDeviceConfirm: false,
    };
  }

  // ── C. Nergens — genereer nieuw keypair ──────────────────────────────────
  const fresh = await generateAndStoreIdentity();
  const pubB64 = bytesToBase64(fresh.publicKey);
  const privB64 = bytesToBase64(fresh.secretKey);

  if (!existing) {
    const username =
      args.preferredUsername ?? args.email.split("@")[0].toLowerCase();
    const { error: insErr } = await supabase.from("profiles").insert({
      id: args.userId,
      username,
      identity_pubkey: pubB64,
      identity_privkey: privB64,
    } as any);
    if (insErr) {
      // Kolom bestaat nog niet — insert zonder privkey.
      const { error: insErr2 } = await supabase.from("profiles").insert({
        id: args.userId,
        username,
        identity_pubkey: pubB64,
      });
      if (insErr2) throw insErr2;
    }
    return { username, pubkeyMismatch: false, isNewDevice: true, needsDeviceConfirm: false };
  }

  await saveKeysToServer(pubB64, privB64);

  return {
    username: existing.username,
    pubkeyMismatch: false,
    isNewDevice: true,
    needsDeviceConfirm: false,
  };
}
