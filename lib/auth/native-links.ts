import type { EmailOtpType } from "@supabase/supabase-js";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

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
 *
 * Sinds PKCE (lib/supabase/client.ts) draagt zo'n link een `?code=`, die we
 * hier inwisselen. Een `token_hash` (uitnodiging) wordt ook op web hier
 * afgehandeld, via de AuthProvider.
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

const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

/**
 * Dezelfde link kan twee keer binnenkomen: op Android ziet zowel
 * `openAuthSessionAsync` als de `url`-listener de terugkeer van Apple/Google,
 * en bij een koude start kan `getInitialURL` hem nog eens geven. Een PKCE-code
 * is maar één keer in te wisselen (de verifier wordt daarna gewist), dus de
 * tweede poging zou "mislukt" melden terwijl je al binnen bent. Daarom delen
 * gelijke links dezelfde afhandeling.
 */
const inFlight = new Map<string, Promise<AuthLinkResult>>();

/**
 * Een binnenkomende link verwerken. Geeft `null` voor links die niets met
 * inloggen te maken hebben (een uitnodiging, een bijdrage).
 */
export function handleAuthLink(url: string | null | undefined): Promise<AuthLinkResult> {
  if (!url) return Promise.resolve(null);
  // Het pad moet exact auth-callback zijn, niet ergens in de link staan.
  const path = url.split(/[?#]/)[0].replace(/\/+$/, "");
  if (!/(^|[/:])auth-callback$/.test(path)) return Promise.resolve(null);
  const p = paramsOf(url);
  const key = p.get("code") ?? p.get("token_hash") ?? url;
  const pending = inFlight.get(key);
  if (pending) return pending;
  const run = handleParams(p);
  inFlight.set(key, run);
  return run;
}

async function handleParams(p: URLSearchParams): Promise<AuthLinkResult> {
  if (p.get("error") || p.get("error_description")) return "error";
  try {
    const code = p.get("code");
    const tokenHash = p.get("token_hash");
    const type = p.get("type") as EmailOtpType | null;
    if (code) {
      // Op web wisselt de client de code zelf in (`detectSessionInUrl`);
      // nog eens proberen zou op een gewiste verifier stuklopen.
      if (Platform.OS === "web") return null;
      // Geen check op een bestaande sessie: een code is alleen in te
      // wisselen met de verifier die dít toestel bij de aanvraag bewaarde,
      // dus een vreemde link faalt hier vanzelf. Een herstelmail terwijl je
      // ingelogd bent moet wel gewoon werken.
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return "error";
      // Bij PKCE staat `type=recovery` niet meer in de link: de client
      // onthoudt het bij de verifier, stuurt zelf PASSWORD_RECOVERY uit en
      // geeft het hier terug. Dat laatste staat (nog) niet in de types van
      // auth-js, vandaar de cast.
      const redirectType = (data as { redirectType?: string | null }).redirectType;
      return redirectType === "recovery" ? "recovery" : "session";
    }
    if (tokenHash && type && OTP_TYPES.includes(type)) {
      // Mails die de server zelf verstuurt (een uitnodiging) hebben geen
      // verifier op dit toestel. Hun sjabloon wijst daarom naar
      // `/auth-callback?token_hash=…&type=…`. Zo'n link kan iedereen maken,
      // ook voor een eigen account: ben je al ingelogd, dan wisselen we daar
      // niet stilletjes naar over (je zou anders posten in iemand anders'
      // account).
      const { data: current } = await supabase.auth.getSession();
      if (current.session) return null;
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
      if (error) return "error";
      return type === "recovery" ? "recovery" : "session";
    }
    // Losse `access_token`s (de oude impliciete flow) nemen we niet meer
    // aan: met PKCE maakt de app zulke links niet meer aan, en ze zijn door
    // iedereen te vervalsen.
    return null;
  } catch {
    return "error";
  }
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
