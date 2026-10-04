import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { Platform } from "react-native";

import { clearHues, type Hue } from "../design/theme";
import { supabase } from "../supabase/client";

type AuthError = { error: Error | null };

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  /** Heeft deze user al een wachtwoord ingesteld? Magic-link-only users hebben dit niet. */
  hasPassword: boolean;
  /** Send a one-time-link email. Creates the user if they don't exist yet. */
  signInWithEmail: (email: string) => Promise<AuthError>;
  /** Email + wachtwoord login voor bestaande accounts. */
  signInWithPassword: (email: string, password: string) => Promise<AuthError>;
  /**
   * Maak een nieuw account aan met email + wachtwoord. Als email-confirmation
   * in Supabase aan staat, krijgt de gebruiker eerst een mail; in dat geval
   * is `needsConfirmation: true`. Bij een al bestaand e-mailadres geeft
   * Supabase géén foutmelding terug (anti-enumeration), maar dan zetten wij
   * `alreadyExists: true` zodat de UI dit kan herkennen.
   */
  signUp: (
    email: string,
    password: string,
    profile?: SignUpProfile
  ) => Promise<AuthError & { needsConfirmation: boolean; alreadyExists: boolean }>;
  /**
   * Inloggen via Apple of Google (web). Alleen de aanbieders in
   * `providers` werken; de knoppen voor de andere blijven verborgen.
   */
  signInWithProvider: (provider: OAuthProvider) => Promise<AuthError>;
  /** Welke aanbieders aan staan (`EXPO_PUBLIC_AUTH_PROVIDERS`). */
  providers: OAuthProvider[];
  /**
   * Binnengekomen via de link uit "Wachtwoord vergeten"? Dan stuurt de app
   * je eerst naar een nieuw wachtwoord (app/set-password.tsx).
   */
  recovering: boolean;
  /** Het nieuwe wachtwoord staat er; de herstelstand mag weg. */
  endRecovery: () => void;
  /** Stel of wijzig het wachtwoord van het huidige ingelogde account. */
  setPassword: (password: string) => Promise<AuthError>;
  /**
   * Markeer enkel dat dit account al een wachtwoord heeft, zonder het te
   * wijzigen. Nodig voor accounts die hun wachtwoord al ingesteld hadden
   * vóór de has_password metadata-flag bestond.
   */
  markHasPassword: () => Promise<AuthError>;
  /** Stuur een reset-mail die als magic-link werkt (en daarna kunnen ze hun wachtwoord wijzigen in profiel). */
  sendPasswordReset: (email: string) => Promise<AuthError>;
  /** Stuur de signup-bevestigingsmail opnieuw (bv. eerder verloren in spam). */
  resendConfirmation: (email: string) => Promise<AuthError>;
  signOut: () => Promise<void>;
};

export type OAuthProvider = "apple" | "google";

/** Wat het aanmaken van een account meegeeft aan het profiel (0082). */
export type SignUpProfile = { displayName: string; hue: Hue };

/**
 * Apple en Google staan pas aan als ze in Supabase ingesteld zijn — anders
 * leidt de knop naar een foutpagina. `EXPO_PUBLIC_AUTH_PROVIDERS=apple,google`
 * zet ze aan. Alleen op web: native heeft er eigen pakketten voor nodig.
 */
function enabledProviders(): OAuthProvider[] {
  if (Platform.OS !== "web") return [];
  const raw = process.env.EXPO_PUBLIC_AUTH_PROVIDERS ?? "";
  return raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter((p): p is OAuthProvider => p === "apple" || p === "google");
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Bepaal de redirect-URL voor magic-link / confirmation-mails. Op web gebruiken
 * we `window.location.origin` zodat preview-deploys, productie en lokaal dev
 * elk naar hun eigen origin terugverwijzen — anders zou Supabase terugvallen
 * op de in het dashboard ingestelde Site URL, wat tot links-naar-localhost
 * leidt zodra een dev-Site-URL is blijven staan. Op native (toekomstig) valt
 * `window` weg en gebruiken we de expliciet geconfigureerde public URL.
 *
 * Belangrijk: elke origin die hier teruggegeven kan worden, moet ook staan in
 * Supabase → Authentication → URL Configuration → Redirect URLs allowlist,
 * anders weigert Supabase de redirect.
 */
function getAuthRedirectUrl(): string | undefined {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.EXPO_PUBLIC_PUBLIC_URL;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const hasPassword = !!(session?.user?.user_metadata as any)?.has_password;

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      hasPassword,
      recovering,
      providers: enabledProviders(),
      endRecovery() {
        setRecovering(false);
      },
      async signInWithEmail(email: string) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });
        return { error };
      },
      async signInWithPassword(email: string, password: string) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (!error) {
          // Successful password login bewijst dat ze er één hebben — markeer
          // de vlag indien die nog niet aanwezig was, zodat de set-password
          // gate die ze niet onnodig blokkeert.
          await supabase.auth
            .updateUser({ data: { has_password: true } })
            .catch(() => {});
        }
        return { error };
      },
      async signUp(email: string, password: string, profile?: SignUpProfile) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            // Naam en kleur reizen mee in de metadata, zodat ze een
            // bevestigingsmail overleven; de profieltrigger (0082) neemt
            // ze over zodra het profiel aangemaakt wordt.
            data: {
              has_password: true,
              ...(profile ? { display_name: profile.displayName.trim(), hue: profile.hue } : null),
            },
            emailRedirectTo: getAuthRedirectUrl(),
          },
        });
        if (error) {
          return { error, needsConfirmation: false, alreadyExists: false };
        }
        // Supabase anti-enumeration: bij bestaand email-adres komt er een
        // dummy user terug met een lege identities-array. Detecteer dat.
        const alreadyExists = Array.isArray(data?.user?.identities)
          ? data.user!.identities!.length === 0
          : false;
        return {
          error: null,
          needsConfirmation: !data.session && !alreadyExists,
          alreadyExists,
        };
      },
      async signInWithProvider(provider: OAuthProvider) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: getAuthRedirectUrl() },
        });
        return { error };
      },
      async setPassword(password: string) {
        const { error } = await supabase.auth.updateUser({
          password,
          data: { has_password: true },
        });
        return { error };
      },
      async markHasPassword() {
        const { error } = await supabase.auth.updateUser({
          data: { has_password: true },
        });
        return { error };
      },
      async sendPasswordReset(email: string) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: getAuthRedirectUrl(),
        });
        return { error };
      },
      async resendConfirmation(email: string) {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: getAuthRedirectUrl() },
        });
        return { error };
      },
      async signOut() {
        await supabase.auth.signOut();
        // Je kleuren per persoon horen bij jou, niet bij het toestel.
        clearHues();
      },
    }),
    [session, loading, hasPassword, recovering]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
