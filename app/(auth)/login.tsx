import { Ionicons } from "@expo/vector-icons";
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

type Mode = "signin" | "signup";
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "magic-sent" }
  | { kind: "confirm-sent" }
  | { kind: "reset-sent" }
  | { kind: "already-exists" }
  | { kind: "error"; message: string };

export default function LoginScreen() {
  const {
    signInWithEmail,
    signInWithPassword,
    signUp,
    sendPasswordReset,
    resendConfirmation,
  } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const passwordRef = useRef<TextInput>(null);

  const submitting = status.kind === "submitting";

  function validate(needPassword: boolean): string | null {
    if (!email.includes("@")) return "Geef een geldig e-mailadres.";
    if (needPassword && password.length < 8)
      return "Wachtwoord moet minstens 8 tekens hebben.";
    return null;
  }

  async function onPasswordSubmit() {
    const err = validate(true);
    if (err) {
      setStatus({ kind: "error", message: err });
      return;
    }
    setStatus({ kind: "submitting" });
    const clean = email.trim().toLowerCase();
    if (mode === "signin") {
      const { error } = await signInWithPassword(clean, password);
      if (error) {
        setStatus({
          kind: "error",
          message:
            error.message === "Invalid login credentials"
              ? "Onbekende e-mail of fout wachtwoord."
              : error.message,
        });
      } else {
        setStatus({ kind: "idle" });
      }
    } else {
      const { error, needsConfirmation, alreadyExists } = await signUp(
        clean,
        password
      );
      if (error) {
        setStatus({
          kind: "error",
          message:
            error.message.includes("registered")
              ? "Dit e-mailadres heeft al een account. Probeer Inloggen."
              : error.message,
        });
      } else if (alreadyExists) {
        // Supabase swallowed the duplicate; show explicit guidance.
        setStatus({ kind: "already-exists" });
      } else if (needsConfirmation) {
        setStatus({ kind: "confirm-sent" });
      } else {
        // Session arrived directly via signUp (email confirmation uit).
        setStatus({ kind: "idle" });
      }
    }
  }

  async function onMagicLink() {
    const err = validate(false);
    if (err) {
      setStatus({ kind: "error", message: err });
      return;
    }
    setStatus({ kind: "submitting" });
    const { error } = await signInWithEmail(email.trim().toLowerCase());
    if (error) setStatus({ kind: "error", message: error.message });
    else setStatus({ kind: "magic-sent" });
  }

  async function onResendConfirmation() {
    const err = validate(false);
    if (err) {
      setStatus({ kind: "error", message: err });
      return;
    }
    setStatus({ kind: "submitting" });
    const { error } = await resendConfirmation(email.trim().toLowerCase());
    if (error) {
      setStatus({
        kind: "error",
        message: /rate limit|too many/i.test(error.message)
          ? "Te veel pogingen. Wacht een uurtje, of zet Resend SMTP op in Supabase."
          : error.message,
      });
    } else {
      setStatus({ kind: "confirm-sent" });
    }
  }

  async function onForgotPassword() {
    const err = validate(false);
    if (err) {
      setStatus({ kind: "error", message: err });
      return;
    }
    setStatus({ kind: "submitting" });
    const { error } = await sendPasswordReset(email.trim().toLowerCase());
    if (error) setStatus({ kind: "error", message: error.message });
    else setStatus({ kind: "reset-sent" });
  }

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
          {/* De woordmerkplaat draagt hier het merk — geen app-icoon in een
              afgerond vierkant. Dit is de eerste pagina die iemand ziet, dus
              hij gebruikt dezelfde plaat als de rest van de app. */}
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
              {mode === "signup" ? "NIEUW HIER" : "WELKOM TERUG"}
            </Text>
            <Text style={[feedType.taglineSmall, { color: feedColor.ink, marginBottom: 24 }]}>
              Link up. Versleuteld, voor je vrienden.
            </Text>

            {/* Modus-keuze — dezelfde gesegmenteerde strip als de tabstrip
                in de kop van de app. */}
            <View
              style={{
                flexDirection: "row",
                borderWidth: FEED_BORDER,
                borderColor: feedColor.ink,
                marginBottom: 24,
              }}
            >
              <ModeTab
                label="Inloggen"
                active={mode === "signin"}
                onPress={() => {
                  setMode("signin");
                  setStatus({ kind: "idle" });
                }}
              />
              <ModeTab
                label="Account aanmaken"
                active={mode === "signup"}
                onPress={() => {
                  setMode("signup");
                  setStatus({ kind: "idle" });
                }}
              />
            </View>

            {/* Email */}
            <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: 8 }]}>
              E-MAILADRES
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              // Zonder deze drie zwijgt elke wachtwoordmanager op het
              // inlogscherm: Keychain, 1Password en Chrome herkennen een
              // veld aan zijn `autoComplete`/`textContentType`, niet aan
              // zijn label. Ze stonden nergens in de app.
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              placeholder="jij@voorbeeld.be"
              placeholderTextColor={feedColor.inkDim}
              style={{ borderWidth: FEED_BORDER, borderColor: feedColor.ink, backgroundColor: feedColor.panel, paddingHorizontal: 16, paddingVertical: 13, color: feedColor.ink, fontFamily: feedType.body.fontFamily, fontSize: 15 }}
              editable={!submitting}
            />

            {/* Password */}
            <Text
              style={[
                feedType.kicker,
                { color: flameDeep, letterSpacing: 0.55, marginTop: 20, marginBottom: 8 },
              ]}
            >
              WACHTWOORD
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", borderWidth: FEED_BORDER, borderColor: feedColor.ink, backgroundColor: feedColor.panel, paddingHorizontal: 16 }}>
              <TextInput
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showPassword}
                ref={passwordRef}
                // "new-password" laat iOS/Chrome een sterk wachtwoord
                // vóórstellen bij registreren; "current-password" laat ze
                // het opgeslagen wachtwoord invullen bij inloggen. Eén
                // waarde voor allebei doet geen van beide goed.
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                textContentType={mode === "signup" ? "newPassword" : "password"}
                returnKeyType={mode === "signup" ? "done" : "go"}
                placeholder={mode === "signup" ? "min. 8 tekens" : "•••••••••"}
                placeholderTextColor={feedColor.inkDim}
                style={{ flex: 1, paddingVertical: 13, color: feedColor.ink, fontFamily: feedType.body.fontFamily, fontSize: 15 }}
                editable={!submitting}
                onSubmitEditing={onPasswordSubmit}
              />
              {/* Een eigen doos van CONTROL_H, geen `hitSlop`: die doet
                  niets op web (§7) en dit is een oogje van twintig punten
                  in een veld waar je met je duim naast tikt. De doos
                  duwt bovendien in plaats van over de tekst heen te
                  liggen, dus hij pakt je cursor niet af. */}
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

            {/* Status banners */}
            {status.kind === "error" && (
              <FieldError style={{ marginTop: 12 }}>{status.message}</FieldError>
            )}
            {status.kind === "magic-sent" && (
              <Banner
                title="Check je inbox"
                body={`We hebben een magic link gestuurd naar ${email}. Klik erop om in te loggen.`}
              />
            )}
            {status.kind === "confirm-sent" && (
              <View className="mt-4 bg-paper-light border border-line-paper px-5 py-4">
                <Text className="text-ink font-semibold text-base mb-1">
                  Bevestig je e-mail
                </Text>
                <Text className="text-ink-soft text-sm leading-5 mb-3">
                  We stuurden een bevestigingslink naar {email}. Klik erop, dan kan je inloggen met je wachtwoord.
                </Text>
                <Text className="text-ink-muted text-xs leading-4 mb-3">
                  Niet ontvangen? Check je spam-map of probeer een van deze:
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <Pressable
                    onPress={onResendConfirmation}
                    disabled={submitting}
                    className="border border-ink/30 px-3 py-1.5"
                  >
                    <Text className="text-ink text-xs font-semibold">
                      Stuur opnieuw
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onMagicLink}
                    disabled={submitting}
                    className="border border-ink/30 px-3 py-1.5"
                  >
                    <Text className="text-ink text-xs font-semibold">
                      Inloggen via magic link
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}
            {status.kind === "reset-sent" && (
              <Banner
                title="Reset-link verstuurd"
                body={`Check ${email} voor een link om in te loggen. Wijzig je wachtwoord daarna in je profiel.`}
              />
            )}
            {status.kind === "already-exists" && (
              <View className="mt-4 bg-paper-light border border-line-paper px-5 py-4">
                <Text className="text-ink font-semibold text-base mb-1">
                  Dit account bestaat al
                </Text>
                <Text className="text-ink-soft text-sm leading-5 mb-3">
                  Er is al een account voor {email}. Log in met je magic-link en stel
                  je wachtwoord in vanuit je Profiel-tab. Daarna kan je gewoon
                  inloggen met email + wachtwoord.
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => {
                      setMode("signin");
                      setStatus({ kind: "idle" });
                    }}
                    className="border border-ink/30 px-3 py-1.5"
                  >
                    <Text className="text-ink text-xs font-semibold">
                      Naar Inloggen
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onMagicLink}
                    disabled={submitting}
                    className="bg-ink active:bg-ink-soft px-3 py-1.5"
                  >
                    <Text className="text-cream text-xs font-semibold">
                      Stuur magic link
                    </Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Primary button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                mode === "signin" ? "Inloggen" : "Account aanmaken"
              }
              accessibilityState={{ disabled: submitting, busy: submitting }}
              onPress={onPasswordSubmit}
              disabled={submitting}
              className="mt-5 bg-ink active:bg-ink-soft items-center justify-center"
              style={{ height: CONTROL_H, marginTop: 20 }}
            >
              <Text className="text-cream font-semibold text-base">
                {submitting
                  ? "Bezig…"
                  : mode === "signin"
                    ? "Inloggen"
                    : "Account aanmaken"}
              </Text>
            </Pressable>

            {/* Secondary actions */}
            {/* Twee tekstlinks van veertien en twaalf punten hoog. Met
                `hitSlop={6}` waren ze op een telefoon net te raken en op
                web precies zo groot als hun letters — §7, de slop valt
                daar weg. Ze krijgen nu allebei een rij van CONTROL_H. */}
            <View className="mt-5 items-center">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Of stuur een magic link"
                accessibilityState={{ disabled: submitting }}
                onPress={onMagicLink}
                disabled={submitting}
                style={{
                  height: CONTROL_H,
                  alignSelf: "stretch",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text className="text-ink-soft text-sm underline">
                  Of stuur een magic link
                </Text>
              </Pressable>
              {mode === "signin" && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Wachtwoord vergeten"
                  accessibilityState={{ disabled: submitting }}
                  onPress={onForgotPassword}
                  disabled={submitting}
                  style={{
                    height: CONTROL_H,
                    alignSelf: "stretch",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text className="text-ink-muted text-xs">
                    Wachtwoord vergeten?
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          <Text className="text-xs text-ink-muted mt-8 text-center">
            End-to-end versleuteld. Lincin's servers zien enkel ciphertext.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ModeTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{
        flex: 1,
        // Eén besturingshoogte, net als elk ander bedieningselement (§4b).
        height: CONTROL_H,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active ? feedColor.ink : "transparent",
      }}
    >
      <Text
        style={[
          feedType.label,
          { fontSize: 12, color: active ? feedColor.lav : feedColor.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
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
