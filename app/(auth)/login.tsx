import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LogoMark } from "@/components/LogoMark";
import { useAuth } from "@/lib/auth/provider";
import { feed as feedColor, FEED_BORDER, feedType, flameDeep } from "@/lib/design/type";

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
                placeholder={mode === "signup" ? "min. 8 tekens" : "•••••••••"}
                placeholderTextColor={feedColor.inkDim}
                style={{ flex: 1, paddingVertical: 13, color: feedColor.ink, fontFamily: feedType.body.fontFamily, fontSize: 15 }}
                editable={!submitting}
                onSubmitEditing={onPasswordSubmit}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={8}
                className="pl-2"
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
              <Text className="text-red-700 text-sm mt-3">{status.message}</Text>
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
              onPress={onPasswordSubmit}
              disabled={submitting}
              className="mt-5 bg-ink active:bg-ink-soft py-3.5 items-center"
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
            <View className="mt-5 items-center gap-2">
              <Pressable onPress={onMagicLink} disabled={submitting} hitSlop={6}>
                <Text className="text-ink-soft text-sm underline">
                  Of stuur een magic link
                </Text>
              </Pressable>
              {mode === "signin" && (
                <Pressable onPress={onForgotPassword} disabled={submitting} hitSlop={6}>
                  <Text className="text-ink-muted text-xs">
                    Wachtwoord vergeten?
                  </Text>
                </Pressable>
              )}
            </View>
          </View>

          <Text className="text-xs text-cream-muted mt-8 text-center">
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
      onPress={onPress}
      style={{
        flex: 1,
        paddingVertical: 12,
        alignItems: "center",
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
