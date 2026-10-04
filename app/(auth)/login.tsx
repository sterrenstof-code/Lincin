import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, View, type TextInput } from "react-native";

import {
  AuthLabel,
  AuthNotice,
  AuthPage,
  AuthTitle,
  AuthTop,
  AuthWordmark,
  CellRow,
  FooterBar,
  LinedField,
  OrRule,
  PrimaryButton,
  type CellAction,
} from "@/components/lincin/auth/AuthKit";
import { useAuth } from "@/lib/auth/provider";
import { color } from "@/lib/design/theme";
import { usePageTitle } from "@/lib/page-title";

/**
 * Inloggen (Login Voorbeeld 1b).
 *
 * E-mail en wachtwoord in gelinieerde velden, één rood vlak, en daaronder
 * de andere wegen: Apple, Google (alleen als ze in Supabase aanstaan, zie
 * `providers`) en een magic link. Wat het oude scherm deed blijft: klopt
 * het niet, dan zegt de server niet óf het adres onbekend is, dus bieden we
 * ook "Account maken" aan; een onbevestigd adres kan zijn mail opnieuw
 * krijgen; "Wachtwoord vergeten" stuurt een herstellink.
 */
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  /** Adres onbekend of wachtwoord fout. */
  | { kind: "no-account" }
  /** Het adres is nog niet bevestigd. */
  | { kind: "unconfirmed" }
  | { kind: "confirm-sent" }
  | { kind: "reset-sent" }
  | { kind: "link-sent" }
  | { kind: "error"; message: string };

const RATE = /rate limit|too many/i;

export default function LoginScreen() {
  usePageTitle("Inloggen");
  const params = useLocalSearchParams<{ email?: string }>();
  const { signInWithPassword, signInWithEmail, signInWithProvider, providers, sendPasswordReset, resendConfirmation } = useAuth();

  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const submitting = status.kind === "submitting";
  const clean = () => email.trim().toLowerCase();
  const reset = () => {
    if (status.kind !== "idle" && status.kind !== "submitting") setStatus({ kind: "idle" });
  };

  function emailError(): string | null {
    return clean().includes("@") ? null : "Geef een geldig e-mailadres.";
  }

  async function onLogin() {
    const err = emailError() ?? (password.length === 0 ? "Vul je wachtwoord in." : null);
    if (err) return setStatus({ kind: "error", message: err });
    setStatus({ kind: "submitting" });
    const { error } = await signInWithPassword(clean(), password);
    if (!error) return setStatus({ kind: "idle" });
    if (error.message === "Invalid login credentials") return setStatus({ kind: "no-account" });
    if (/not confirmed/i.test(error.message)) return setStatus({ kind: "unconfirmed" });
    setStatus({ kind: "error", message: error.message });
  }

  async function onMagicLink() {
    const err = emailError();
    if (err) {
      emailRef.current?.focus();
      return setStatus({ kind: "error", message: "Vul je e-mailadres in; we sturen er een link naartoe." });
    }
    setStatus({ kind: "submitting" });
    const { error } = await signInWithEmail(clean());
    if (error) setStatus({ kind: "error", message: RATE.test(error.message) ? "Te veel links aangevraagd. Probeer het over een uurtje opnieuw." : error.message });
    else setStatus({ kind: "link-sent" });
  }

  async function onResendConfirmation() {
    setStatus({ kind: "submitting" });
    const { error } = await resendConfirmation(clean());
    if (error) setStatus({ kind: "error", message: RATE.test(error.message) ? "Te veel pogingen op dit adres. Probeer het over een uurtje opnieuw." : error.message });
    else setStatus({ kind: "confirm-sent" });
  }

  async function onForgotPassword() {
    const err = emailError();
    if (err) return setStatus({ kind: "error", message: err });
    setStatus({ kind: "submitting" });
    const { error } = await sendPasswordReset(clean());
    if (error) setStatus({ kind: "error", message: error.message });
    else setStatus({ kind: "reset-sent" });
  }

  async function onProvider(p: "apple" | "google") {
    setStatus({ kind: "submitting" });
    const { error } = await signInWithProvider(p);
    if (error) setStatus({ kind: "error", message: error.message });
  }

  const cells: CellAction[] = [
    ...(providers.includes("apple") ? [{ key: "apple", glyph: "", label: "Apple", onPress: () => onProvider("apple") }] : []),
    ...(providers.includes("google") ? [{ key: "google", glyph: "G", label: "Google", onPress: () => onProvider("google") }] : []),
    { key: "link", glyph: "✉", label: "Magic link", onPress: onMagicLink },
  ];

  const toSignup = () => router.push({ pathname: "/(auth)/signup", params: clean() ? { email: clean() } : {} });

  return (
    <AuthPage>
      <AuthTop label="Inloggen" onBack={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/welcome"))} />

      <View style={{ paddingTop: 28, paddingHorizontal: 24, gap: 8 }}>
        <AuthWordmark size={40} />
        <AuthTitle>Welkom terug.</AuthTitle>
      </View>

      <View style={{ marginTop: 28, marginHorizontal: 24, gap: 22 }}>
        <LinedField
          ref={emailRef}
          label="E-mail"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            reset();
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <LinedField
          ref={passwordRef}
          label="Wachtwoord"
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            reset();
          }}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={onLogin}
        />
        <Pressable accessibilityRole="button" onPress={onForgotPassword} hitSlop={10} style={{ alignSelf: "flex-start" }}>
          <AuthLabel color={color("ink")} underline>
            Wachtwoord vergeten?
          </AuthLabel>
        </Pressable>
      </View>

      {status.kind !== "idle" && status.kind !== "submitting" ? (
        <View style={{ marginTop: 20, marginHorizontal: 24, gap: 10 }}>
          {status.kind === "error" ? <AuthNotice tone="error">{status.message}</AuthNotice> : null}
          {status.kind === "no-account" ? (
            <>
              <AuthNotice>Dat klopt niet. Wachtwoord fout, of nog geen account op dit adres?</AuthNotice>
              <Pressable accessibilityRole="button" onPress={toSignup} hitSlop={8} style={{ alignSelf: "flex-start" }}>
                <AuthLabel weight={700} color={color("ink")} underline>
                  Account maken met dit adres →
                </AuthLabel>
              </Pressable>
            </>
          ) : null}
          {status.kind === "unconfirmed" ? (
            <>
              <AuthNotice>Je adres is nog niet bevestigd. Kijk in je mail (ook bij spam).</AuthNotice>
              <Pressable accessibilityRole="button" onPress={onResendConfirmation} hitSlop={8} style={{ alignSelf: "flex-start" }}>
                <AuthLabel weight={700} color={color("ink")} underline>
                  Stuur de mail opnieuw →
                </AuthLabel>
              </Pressable>
            </>
          ) : null}
          {status.kind === "confirm-sent" ? <AuthNotice>Verstuurd. Bevestig je adres via de link in de mail.</AuthNotice> : null}
          {status.kind === "reset-sent" ? <AuthNotice>Als er een account op dit adres is, staat er nu een link in je mail om een nieuw wachtwoord te kiezen.</AuthNotice> : null}
          {status.kind === "link-sent" ? <AuthNotice>Check je inbox: de link logt je meteen in.</AuthNotice> : null}
        </View>
      ) : null}

      <View style={{ marginTop: 28, marginHorizontal: 6 }}>
        <PrimaryButton label="Inloggen" onPress={onLogin} busy={submitting} />
      </View>

      <View style={{ marginTop: 22, marginHorizontal: 24 }}>
        <OrRule label="of" />
      </View>
      <View style={{ marginTop: 16, marginHorizontal: 6 }}>
        <CellRow cells={cells} />
      </View>

      <View style={{ flex: 1, minHeight: 28 }} />
      <FooterBar text="Nog geen account?" action="Account maken" onPress={toSignup} />
    </AuthPage>
  );
}
