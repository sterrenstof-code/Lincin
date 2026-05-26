import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";

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
    <SafeAreaView className="flex-1 bg-shell">
      <ScreenContainer>
        <View className="flex-1 justify-center px-6">
          <View className="bg-paper rounded-3xl p-8">
            <View className="items-center mb-6">
              <Image
                source={require("../../assets/images/icon.png")}
                style={{ width: 84, height: 84, borderRadius: 20 }}
                resizeMode="contain"
              />
            </View>

            <Text className="text-5xl font-bold tracking-tight text-ink text-center">
              Lincin
            </Text>
            <Text className="text-base text-ink-soft text-center mt-2 mb-6">
              Link up. Versleuteld, voor je vrienden.
            </Text>

            {/* Mode toggle */}
            <View className="bg-paper-light border border-line-paper rounded-full p-1 flex-row mb-5">
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
            <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
              E-mailadres
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="jij@voorbeeld.be"
              placeholderTextColor="#8A7E6C"
              className="bg-paper-light text-ink text-base px-5 py-3.5 rounded-full border border-line-paper"
              editable={!submitting}
            />

            {/* Password */}
            <Text className="text-xs uppercase tracking-wider text-ink-muted mt-4 mb-2">
              Wachtwoord
            </Text>
            <View className="flex-row items-center bg-paper-light border border-line-paper rounded-full px-5">
              <TextInput
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!showPassword}
                placeholder={mode === "signup" ? "min. 8 tekens" : "•••••••••"}
                placeholderTextColor="#8A7E6C"
                className="flex-1 text-ink text-base py-3.5"
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
                  color="#5A4F40"
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
              <View className="mt-4 bg-paper-light border border-line-paper rounded-2xl px-5 py-4">
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
                    className="border border-ink/30 rounded-full px-3 py-1.5"
                  >
                    <Text className="text-ink text-xs font-semibold">
                      Stuur opnieuw
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onMagicLink}
                    disabled={submitting}
                    className="border border-ink/30 rounded-full px-3 py-1.5"
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
              <View className="mt-4 bg-paper-light border border-line-paper rounded-2xl px-5 py-4">
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
                    className="border border-ink/30 rounded-full px-3 py-1.5"
                  >
                    <Text className="text-ink text-xs font-semibold">
                      Naar Inloggen
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={onMagicLink}
                    disabled={submitting}
                    className="bg-ink active:bg-ink-soft rounded-full px-3 py-1.5"
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
              className="mt-5 bg-ink active:bg-ink-soft rounded-full py-3.5 items-center"
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
      </ScreenContainer>
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
      className={`flex-1 rounded-full py-2 items-center ${
        active ? "bg-ink" : ""
      }`}
    >
      <Text
        className={`text-sm font-semibold ${
          active ? "text-cream" : "text-ink-muted"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Banner({ title, body }: { title: string; body: string }) {
  return (
    <View className="mt-4 bg-paper-light border border-line-paper rounded-2xl px-5 py-4">
      <Text className="text-ink font-semibold text-base mb-1">{title}</Text>
      <Text className="text-ink-soft text-sm leading-5">{body}</Text>
    </View>
  );
}
