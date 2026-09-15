import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { FieldError } from "@/components/FormError";
import { LogoMark } from "@/components/LogoMark";
import { useAuth } from "@/lib/auth/provider";
import {
  CONTROL_H,
  feed as feedColor,
  FEED_BORDER,
  feedType,
  flameDeep,
} from "@/lib/design/type";

/**
 * Eén weg naar binnen.
 *
 * Er stonden drie: inloggen met wachtwoord, een account aanmaken (een
 * tabje ernaast), en een magic link eronder. Drie deuren op de eerste
 * pagina is drie keer kiezen voordat je iets gedaan hebt.
 *
 * Nu is het: e-mail, wachtwoord, Doorgaan. Kent de server het adres
 * niet, dan zegt de pagina dat en biedt hij aan om met precies deze
 * gegevens een account te maken — dat is het moment waarop die vraag
 * hoort, niet ervoor. "Wachtwoord vergeten" stuurt een link; daarna kies
 * je een nieuw wachtwoord bij Instellingen.
 *
 * Wachtwoordmanagers: `autoComplete` en `textContentType` staan op het
 * bestaande wachtwoord, zodat ze invullen. Bij het aanmaken via de
 * aanbieding wordt hetzelfde veld gebruikt; iOS en Chrome bewaren het
 * daarna gewoon.
 */
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  /** Adres onbekend of wachtwoord fout — bied aan om een account te maken. */
  | { kind: "no-account" }
  | { kind: "confirm-sent" }
  | { kind: "reset-sent" }
  | { kind: "error"; message: string };

export default function LoginScreen() {
  const { signInWithPassword, signUp, sendPasswordReset, resendConfirmation } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const passwordRef = useRef<TextInput>(null);

  const submitting = status.kind === "submitting";
  const clean = () => email.trim().toLowerCase();

  function emailError(): string | null {
    return email.includes("@") ? null : "Geef een geldig e-mailadres.";
  }

  /**
   * Inloggen. Klopt het niet, dan weet de server niet (en zegt hij niet)
   * of het adres onbekend is of het wachtwoord fout — dus bieden we
   * allebei aan: opnieuw proberen, of een account maken.
   */
  async function onContinue() {
    const err = emailError() ?? (password.length === 0 ? "Vul je wachtwoord in." : null);
    if (err) {
      setStatus({ kind: "error", message: err });
      return;
    }
    setStatus({ kind: "submitting" });
    const { error } = await signInWithPassword(clean(), password);
    if (!error) {
      setStatus({ kind: "idle" });
      return;
    }
    if (error.message === "Invalid login credentials") {
      setStatus({ kind: "no-account" });
      return;
    }
    setStatus({ kind: "error", message: error.message });
  }

  /** De acht-tekens-eis geldt alleen hier: bij het kiezen, niet bij het controleren. */
  async function onCreate() {
    if (password.length < 8) {
      setStatus({ kind: "error", message: "Kies een wachtwoord van minstens 8 tekens." });
      return;
    }
    setStatus({ kind: "submitting" });
    const { error, needsConfirmation, alreadyExists } = await signUp(clean(), password);
    if (error) {
      setStatus({
        kind: "error",
        message: error.message.includes("registered")
          ? "Er is al een account voor dit adres. Klopt je wachtwoord niet meer? Gebruik dan 'Wachtwoord vergeten'."
          : error.message,
      });
    } else if (alreadyExists) {
      setStatus({
        kind: "error",
        message:
          "Er is al een account voor dit adres. Klopt je wachtwoord niet meer? Gebruik dan 'Wachtwoord vergeten'.",
      });
    } else if (needsConfirmation) {
      setStatus({ kind: "confirm-sent" });
    } else {
      setStatus({ kind: "idle" });
    }
  }

  async function onResendConfirmation() {
    setStatus({ kind: "submitting" });
    const { error } = await resendConfirmation(clean());
    if (error) {
      setStatus({
        kind: "error",
        message: /rate limit|too many/i.test(error.message)
          ? "Te veel pogingen op dit adres. Probeer het over een uurtje opnieuw."
          : error.message,
      });
    } else {
      setStatus({ kind: "confirm-sent" });
    }
  }

  async function onForgotPassword() {
    const err = emailError();
    if (err) {
      setStatus({ kind: "error", message: err });
      return;
    }
    setStatus({ kind: "submitting" });
    const { error } = await sendPasswordReset(clean());
    if (error) setStatus({ kind: "error", message: error.message });
    else setStatus({ kind: "reset-sent" });
  }

  const fieldStyle = {
    borderWidth: FEED_BORDER,
    borderColor: feedColor.ink,
    backgroundColor: feedColor.panel,
    paddingHorizontal: 16,
    color: feedColor.ink,
    fontFamily: feedType.body.fontFamily,
    fontSize: 15,
  } as const;

  return (
    <SafeAreaView className="flex-1 bg-feed-lav">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}>
        <View
          style={{
            width: "100%",
            maxWidth: 620,
            alignSelf: "center",
            paddingHorizontal: 20,
            paddingVertical: 40,
          }}
        >
          {/* De woordmerkplaat draagt hier het merk — dezelfde plaat als de
              rest van de app, geen app-icoon in een afgerond vierkant. */}
          <LogoMark size="plate" />

          <View
            style={{
              borderWidth: FEED_BORDER,
              borderColor: feedColor.ink,
              borderTopWidth: 0,
              padding: 28,
            }}
          >
            <Text
              style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 10 }]}
            >
              WELKOM
            </Text>
            <Text style={[feedType.taglineSmall, { color: feedColor.ink, marginBottom: 24 }]}>
              Link up. Versleuteld, voor je vrienden.
            </Text>

            <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 8 }]}>
              E-MAILADRES
            </Text>
            <TextInput
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                if (status.kind !== "idle" && status.kind !== "submitting") setStatus({ kind: "idle" });
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="jij@voorbeeld.be"
              placeholderTextColor={feedColor.inkDim}
              style={[fieldStyle, { paddingVertical: 13 }]}
              editable={!submitting}
            />

            <Text
              style={[
                feedType.kicker,
                { color: flameDeep, letterSpacing: 0.55, marginTop: 20, marginBottom: 8 },
              ]}
            >
              WACHTWOORD
            </Text>
            <View style={[fieldStyle, { flexDirection: "row", alignItems: "center" }]}>
              <TextInput
                ref={passwordRef}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (status.kind === "error") setStatus({ kind: "idle" });
                }}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                placeholder="•••••••••"
                placeholderTextColor={feedColor.inkDim}
                style={{
                  flex: 1,
                  paddingVertical: 13,
                  color: feedColor.ink,
                  fontFamily: feedType.body.fontFamily,
                  fontSize: 15,
                }}
                editable={!submitting}
                onSubmitEditing={onContinue}
              />
              {/* Een eigen doos van CONTROL_H, geen `hitSlop`: die doet niets
                  op web (§7) en dit is een oogje van twintig punten. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
                accessibilityState={{ checked: showPassword }}
                onPress={() => setShowPassword((s) => !s)}
                style={{
                  width: CONTROL_H,
                  height: CONTROL_H,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: -12,
                }}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  color={feedColor.inkDim}
                  size={20}
                />
              </Pressable>
            </View>

            {status.kind === "error" && (
              <FieldError style={{ marginTop: 12 }}>{status.message}</FieldError>
            )}

            {status.kind === "no-account" && (
              <View className="mt-4 bg-paper-light border border-line-paper px-5 py-4">
                <Text className="text-ink font-semibold text-base mb-1">
                  Dat klopt niet
                </Text>
                <Text className="text-ink-soft text-sm leading-5 mb-3">
                  We kennen {email.trim()} niet, of het wachtwoord is fout. Nieuw hier? Dan
                  maken we met dit adres en dit wachtwoord een account.
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Account aanmaken met dit adres"
                    onPress={onCreate}
                    disabled={submitting}
                    className="bg-ink active:bg-ink-soft px-3 py-1.5"
                  >
                    <Text className="text-cream text-xs font-semibold">
                      Account aanmaken
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Wachtwoord vergeten"
                    onPress={onForgotPassword}
                    disabled={submitting}
                    className="border border-ink/30 px-3 py-1.5"
                  >
                    <Text className="text-ink text-xs font-semibold">
                      Wachtwoord vergeten
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {status.kind === "confirm-sent" && (
              <View className="mt-4 bg-paper-light border border-line-paper px-5 py-4">
                <Text className="text-ink font-semibold text-base mb-1">
                  Bevestig je e-mail
                </Text>
                <Text className="text-ink-soft text-sm leading-5 mb-3">
                  We stuurden een bevestigingslink naar {email.trim()}. Klik erop, en kom dan
                  hier terug om in te loggen.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bevestigingslink opnieuw sturen"
                  onPress={onResendConfirmation}
                  disabled={submitting}
                  className="self-start border border-ink/30 px-3 py-1.5"
                >
                  <Text className="text-ink text-xs font-semibold">Niet ontvangen? Stuur opnieuw</Text>
                </Pressable>
              </View>
            )}

            {status.kind === "reset-sent" && (
              <Banner
                title="Check je inbox"
                body={`We stuurden een link naar ${email.trim()}. Klik erop om in te loggen; daarna kies je bij Instellingen een nieuw wachtwoord.`}
              />
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Doorgaan"
              accessibilityState={{ disabled: submitting, busy: submitting }}
              onPress={onContinue}
              disabled={submitting}
              className="bg-ink active:bg-ink-soft items-center justify-center"
              style={{ height: CONTROL_H, marginTop: 20 }}
            >
              <Text className="text-cream font-semibold text-base">
                {submitting ? "Bezig…" : "Doorgaan"}
              </Text>
            </Pressable>

            {/* Eén tekstlink, een rij van CONTROL_H hoog (§7: op web valt
                de hitSlop weg, dus de rij zelf moet raakbaar zijn). */}
            {status.kind !== "no-account" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Wachtwoord vergeten"
                accessibilityState={{ disabled: submitting }}
                onPress={onForgotPassword}
                disabled={submitting}
                style={{
                  marginTop: 12,
                  height: CONTROL_H,
                  alignSelf: "stretch",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="text-ink-muted text-xs">Wachtwoord vergeten?</Text>
              </Pressable>
            )}
          </View>

          <Text className="text-xs text-ink-muted mt-8 text-center">
            End-to-end versleuteld. Lincin's servers zien enkel ciphertext.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Banner({ title, body }: { title: string; body: string }) {
  return (
    <View className="mt-4 bg-paper-light border border-line-paper px-5 py-4">
      <Text className="text-ink font-semibold text-base mb-1">{title}</Text>
      <Text className="text-ink-soft text-sm leading-5">{body}</Text>
    </View>
  );
}
