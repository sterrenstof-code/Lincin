import { router, useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, View, type TextInput } from "react-native";

import {
  AuthLabel,
  AuthNotice,
  AuthPage,
  AuthSub,
  AuthTitle,
  AuthTop,
  HueStrip,
  LinedField,
  PrimaryButton,
  SIGNUP_HUES,
  StepBars,
} from "@/components/lincin/auth/AuthKit";
import { useAuth } from "@/lib/auth/provider";
import { color, type Hue } from "@/lib/design/theme";
import { usePageTitle } from "@/lib/page-title";

/**
 * Account maken, stap 1 van 3 (Login Voorbeeld 1c): naam, e-mail,
 * wachtwoord en jouw kleur.
 *
 * Naam en kleur gaan mee in de aanmelding (`signUp`, metadata) en komen via
 * de profieltrigger (0082) op je profiel — ook als er eerst een
 * bevestigingsmail tussen zit. Stap 2 (foto) en 3 (vrienden uitnodigen)
 * volgen ná het inloggen, in `app/onboarding`: daar is een sessie voor
 * nodig.
 */
const HUE_LABELS: Record<Hue, string> = {
  orange: "Oranje",
  blue: "Blauw",
  ochre: "Oker",
  green: "Groen",
  red: "Rood",
  acid: "Zuur",
};

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "exists" }
  | { kind: "confirm"; sent: boolean }
  | { kind: "error"; message: string };

export default function SignupScreen() {
  usePageTitle("Account maken");
  const params = useLocalSearchParams<{ email?: string }>();
  const { signUp, resendConfirmation } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState(typeof params.email === "string" ? params.email : "");
  const [password, setPassword] = useState("");
  // Een willekeurige kleur om mee te beginnen: anders kiest iedereen die
  // niet kiest dezelfde.
  const [hue, setHue] = useState<Hue>(() => SIGNUP_HUES[Math.floor(Math.random() * SIGNUP_HUES.length)]);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const clean = () => email.trim().toLowerCase();
  const reset = () => {
    if (status.kind === "error" || status.kind === "exists") setStatus({ kind: "idle" });
  };

  async function onNext() {
    const err =
      name.trim().length < 2
        ? "Vul je naam in."
        : !clean().includes("@")
          ? "Geef een geldig e-mailadres."
          : password.length < 8
            ? "Kies een wachtwoord van minstens 8 tekens."
            : null;
    if (err) return setStatus({ kind: "error", message: err });
    setStatus({ kind: "submitting" });
    const { error, needsConfirmation, alreadyExists } = await signUp(clean(), password, { displayName: name, hue });
    if (error) {
      return setStatus(
        error.message.includes("registered") ? { kind: "exists" } : { kind: "error", message: error.message },
      );
    }
    if (alreadyExists) return setStatus({ kind: "exists" });
    // Met een sessie neemt de app het over (app/(app)/_layout → onboarding).
    setStatus(needsConfirmation ? { kind: "confirm", sent: false } : { kind: "idle" });
  }

  async function onResend() {
    const { error } = await resendConfirmation(clean());
    if (error) setStatus({ kind: "error", message: /rate limit|too many/i.test(error.message) ? "Te veel pogingen op dit adres. Probeer het over een uurtje opnieuw." : error.message });
    else setStatus({ kind: "confirm", sent: true });
  }

  const back = () => (router.canGoBack() ? router.back() : router.replace("/(auth)/welcome"));

  if (status.kind === "confirm") {
    return (
      <AuthPage>
        <AuthTop label="Account maken · 1 / 3" onBack={() => setStatus({ kind: "idle" })} />
        <View style={{ marginTop: 20, marginHorizontal: 24 }}>
          <StepBars step={1} />
        </View>
        <View style={{ paddingTop: 28, paddingHorizontal: 24, gap: 10 }}>
          <AuthTitle>Check je inbox.</AuthTitle>
          <AuthSub>
            We stuurden een link naar {clean()}. Tik erop en je gaat verder met je foto en je eerste vrienden.
          </AuthSub>
        </View>
        <View style={{ marginTop: 28, marginHorizontal: 24, gap: 12 }}>
          {status.sent ? <AuthNotice>Opnieuw verstuurd.</AuthNotice> : null}
          <Pressable accessibilityRole="button" onPress={onResend} hitSlop={8} style={{ alignSelf: "flex-start" }}>
            <AuthLabel weight={700} color={color("ink")} underline>
              Niets gekregen? Stuur opnieuw →
            </AuthLabel>
          </Pressable>
        </View>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthTop label="Account maken · 1 / 3" onBack={back} />
      <View style={{ marginTop: 20, marginHorizontal: 24 }}>
        <StepBars step={1} />
      </View>

      <View style={{ paddingTop: 28, paddingHorizontal: 24, gap: 10 }}>
        <AuthTitle>Hoe heet je in het colofon?</AuthTitle>
        <AuthSub>Je vrienden zien deze naam bij elke bijdrage.</AuthSub>
      </View>

      <View style={{ marginTop: 28, marginHorizontal: 24, gap: 22 }}>
        <LinedField
          label="Naam"
          value={name}
          onChangeText={(v) => {
            setName(v);
            reset();
          }}
          placeholder="Voornaam Achternaam"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />
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
          placeholder="minstens 8 tekens"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={onNext}
        />
      </View>

      <View style={{ marginTop: 26, marginHorizontal: 24, gap: 10 }}>
        <AuthLabel>Jouw kleur</AuthLabel>
        <HueStrip value={hue} onChange={setHue} labels={HUE_LABELS} />
      </View>

      {status.kind === "error" || status.kind === "exists" ? (
        <View style={{ marginTop: 20, marginHorizontal: 24, gap: 10 }}>
          {status.kind === "error" ? <AuthNotice tone="error">{status.message}</AuthNotice> : null}
          {status.kind === "exists" ? (
            <>
              <AuthNotice tone="error">Er is al een account voor dit adres.</AuthNotice>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace({ pathname: "/(auth)/login", params: { email: clean() } })}
                hitSlop={8}
                style={{ alignSelf: "flex-start" }}
              >
                <AuthLabel weight={700} color={color("ink")} underline>
                  Inloggen met dit adres →
                </AuthLabel>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: 28 }} />
      <View style={{ marginHorizontal: 6, marginBottom: 24 }}>
        <PrimaryButton label="Volgende" onPress={onNext} busy={status.kind === "submitting"} />
      </View>
    </AuthPage>
  );
}
