import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

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
    password: string
  ) => Promise<AuthError & { needsConfirmation: boolean; alreadyExists: boolean }>;
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

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
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
      async signInWithEmail(email: string) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: true },
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
      async signUp(email: string, password: string) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { has_password: true } },
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
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        return { error };
      },
      async resendConfirmation(email: string) {
        const { error } = await supabase.auth.resend({ type: "signup", email });
        return { error };
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [session, loading, hasPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
