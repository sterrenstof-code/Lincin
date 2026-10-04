import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";

import { supabase } from "../supabase/client";

/**
 * Inloglinks op de telefoon.
 *
 * Op web leest Supabase de sessie zelf uit de adresbalk
 * (`detectSessionInUrl`). Op de telefoon niet: daar kwam een link uit een
 * mail (bevestigen, magic link, wachtwoord vergeten) en de terugkeer van
 * Apple/Google op de website uit in plaats van in de app, en je bleef er
 * uitgelogd. Nu wijzen die links naar `lincin://auth-callback`, en zet
 * deze module wat erin staat om in een sessie.
 *
 * Supabase moet dat adres toelaten: Authentication → URL Configuration →
 * Redirect URLs → `lincin://**` (en `exp+lincin://**` voor een dev-build).
 */
export const NATIVE_AUTH_REDIRECT = Linking.createURL("auth-callback");

export type AuthLinkResult = "session" | "recovery" | "error" | null;

function paramsOf(url: string): URLSearchParams {
  const out = new URLSearchParams();
  const q = url.indexOf("?");
  const h = url.indexOf("#");
  const query = q >= 0 ? url.slice(q + 1, h > q ? h : undefined) : "";
  const hash = h >= 0 ? url.slice(h + 1) : "";
  for (const part of [query, hash]) new URLSearchParams(part).forEach((v, k) => out.set(k, v));
  return out;
}

/**
 * Een binnenkomende link verwerken. Geeft `null` voor links die niets met
 * inloggen te maken hebben (een uitnodiging, een bijdrage).
 */
export async function handleAuthLink(url: string | null | undefined): Promise<AuthLinkResult> {
  if (!url || !url.includes("auth-callback")) return null;
  const p = paramsOf(url);
  if (p.get("error") || p.get("error_description")) return "error";
  try {
    const code = p.get("code");
    const access = p.get("access_token");
    const refresh = p.get("refresh_token");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return "error";
    } else if (access && refresh) {
      const { error } = await supabase.auth.setSession({ access_token: access, refresh_token: refresh });
      if (error) return "error";
    } else {
      return null;
    }
  } catch {
    return "error";
  }
  return p.get("type") === "recovery" ? "recovery" : "session";
}

/**
 * Apple of Google op de telefoon: de aanmeldpagina in een systeemvenster
 * dat zelf sluit zodra hij terugkeert naar `lincin://auth-callback`.
 */
export async function signInWithProviderNative(provider: "apple" | "google"): Promise<Error | null> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true },
  });
  if (error) return error;
  if (!data?.url) return new Error("Geen aanmeldadres ontvangen.");
  const res = await WebBrowser.openAuthSessionAsync(data.url, NATIVE_AUTH_REDIRECT);
  if (res.type !== "success") return null; // geannuleerd: geen fout tonen
  const r = await handleAuthLink(res.url);
  return r === "error" ? new Error("Aanmelden is niet gelukt.") : null;
}
