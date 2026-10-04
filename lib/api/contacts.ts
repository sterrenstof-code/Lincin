import * as Contacts from "expo-contacts";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { rememberHues } from "../design/theme";
import { supabase } from "../supabase/client";

/**
 * "Uit je contacten" (0088). De adressen verlaten het toestel niet: we
 * sturen de SHA-256 van elk e-mailadres (kleine letters, zonder spaties),
 * en de server geeft terug wie daarvan al op Lincin zit.
 */

export type PhoneContact = { key: string; name: string; emails: string[] };

export type ContactMatch = {
  hash: string;
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  hue: string | null;
};

/** Kan dit toestel contacten lezen? Op web niet. */
export async function contactsAvailable(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  try {
    return await Contacts.isAvailableAsync();
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function hashEmail(email: string): Promise<string> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, normalizeEmail(email));
  return hex.toLowerCase();
}

/**
 * Je contacten met minstens één e-mailadres, op naam. `denied` als je de
 * toestemming weigerde (of eerder weigerde: dan moet het via Instellingen).
 */
export async function readContactsWithEmail(): Promise<{ status: "ok"; contacts: PhoneContact[] } | { status: "denied"; canAskAgain: boolean }> {
  const perm = await Contacts.requestPermissionsAsync();
  if (perm.status !== "granted") return { status: "denied", canAskAgain: perm.canAskAgain };
  const { data } = await Contacts.getContactsAsync({
    fields: [Contacts.Fields.Name, Contacts.Fields.Emails],
    sort: Contacts.SortTypes.FirstName,
  });
  const contacts: PhoneContact[] = [];
  for (const c of data) {
    const emails = [...new Set((c.emails ?? []).map((e) => normalizeEmail(e.email ?? "")).filter((e) => e.includes("@")))];
    if (emails.length === 0) continue;
    contacts.push({ key: c.id ?? emails[0], name: c.name?.trim() || emails[0], emails });
  }
  return { status: "ok", contacts };
}

/** Wie van deze hashes al op Lincin zit. Hoogstens 2000 per keer, 5 keer per uur. */
export async function matchContacts(hashes: string[]): Promise<ContactMatch[]> {
  if (hashes.length === 0) return [];
  const { data, error } = await supabase.rpc("match_contacts", { p_hashes: hashes.slice(0, 2000) });
  if (error) {
    if (error.hint === "rate_limited" || /rate limited/.test(error.message)) throw new Error("rate_limited");
    throw error;
  }
  const rows = (data ?? []) as ContactMatch[];
  rememberHues(rows.map((r) => ({ id: r.id, hue: r.hue })));
  return rows;
}
