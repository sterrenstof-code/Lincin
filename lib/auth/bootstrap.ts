import { bytesToBase64 } from "../crypto/base64";
import {
  generateAndStoreIdentity,
  getOrCreateDeviceId,
  loadIdentity,
} from "../crypto/keys";
import { registerOrUpdateDevice, guessDeviceLabel } from "../api/devices";
import { supabase } from "../supabase/client";

/**
 * Wordt aangeroepen na succesvolle login. Zorgt voor:
 *   1. Identity keypair op dit toestel (genereer indien afwezig).
 *   2. Registratie van dit toestel in `profile_devices` met eigen pubkey.
 *   3. Profile-rij aanmaken als die nog niet bestaat.
 *
 * Multi-device model: elk toestel heeft een eigen identity keypair.
 * `sendMessage` encrypt voor elk geregistreerd device van de ontvanger,
 * zodat elk toestel berichten zelfstandig kan ontsleutelen — zonder
 * dat een toestel-login een ander toestel blokkeert.
 *
 * `confirmOverwrite` wordt genegeerd en is alleen nog aanwezig voor
 * backwards-compat met bestaande call-sites.
 */
export async function bootstrapProfile(args: {
  userId: string;
  email: string;
  preferredUsername?: string;
  /** @deprecated Genegeerd — niet langer nodig in het multi-device model. */
  confirmOverwrite?: boolean;
}): Promise<{
  username: string | null;
  pubkeyMismatch: boolean;
  isNewDevice: boolean;
  needsDeviceConfirm: boolean;
}> {
  // 1. Laad of genereer identity keypair voor dit toestel.
  const hadLocalKeys = !!(await loadIdentity());
  let identity = await loadIdentity();
  if (!identity) {
    identity = await generateAndStoreIdentity();
  }
  const pubB64 = bytesToBase64(identity.publicKey);

  // 2. Registreer dit toestel in profile_devices (upsert — veilig om
  //    meerdere keren aan te roepen, bv. bij app-herstart).
  const deviceId = await getOrCreateDeviceId();
  await registerOrUpdateDevice({
    userId: args.userId,
    deviceId,
    identityPubkey: pubB64,
    label: guessDeviceLabel(),
  });

  // 3. Controleer of er al een profiel-rij bestaat.
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("id, username, identity_pubkey")
    .eq("id", args.userId)
    .maybeSingle();
  if (selErr) throw selErr;

  if (!existing) {
    // Nieuw account: maak profiel aan.
    const username =
      args.preferredUsername ?? args.email.split("@")[0].toLowerCase();
    const { error } = await supabase.from("profiles").insert({
      id: args.userId,
      username,
      identity_pubkey: pubB64,
    });
    if (error) throw error;
    return {
      username,
      pubkeyMismatch: false,
      isNewDevice: true,
      needsDeviceConfirm: false,
    };
  }

  // 4. Bestaand profiel — geen pubkey-overschrijving nodig. In het
  //    multi-device model worden berichten per device_id geëncrypt;
  //    profiles.identity_pubkey wordt alleen nog bijgehouden voor
  //    legacy-berichten die vóór de migratie zijn verstuurd.

  return {
    username: existing.username,
    pubkeyMismatch: false,
    isNewDevice: !hadLocalKeys,
    needsDeviceConfirm: false, // nooit meer blokkeren op nieuw toestel
  };
}
