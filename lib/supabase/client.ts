import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import type { Database } from "./types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. " +
      "Copy .env.example to .env.local and fill in your Supabase project values."
  );
}

/**
 * Auth-session storage. On native we use AsyncStorage; on web Supabase
 * falls back to its own localStorage adapter when `storage` is undefined.
 */
const authStorage = Platform.OS === "web" ? undefined : AsyncStorage;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE: een link uit een mail (of de terugkeer van Apple/Google) draagt
    // een eenmalige `?code=` in plaats van losse tokens. Die code is alleen
    // in te wisselen met de verifier die bij de aanvraag in `authStorage`
    // (`<storageKey>-code-verifier`, naast de sessie) is gezet. Zo kan een
    // gelekte of vervalste link je niet in andermans account zetten.
    // Keerzijde: de link werkt alleen in de browser of op het toestel waar
    // hij is aangevraagd. Op een ander toestel geopend mislukt het inloggen
    // en moet je daar een nieuwe link vragen.
    flowType: "pkce",
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web: de client wisselt een `?code=` in de adresbalk zelf in. De
    // schermen wachten daarvoor op `loading` (AuthProvider), zodat geen
    // redirect de code uit de URL haalt voor dat gebeurd is.
    detectSessionInUrl: Platform.OS === "web",
  },
});
