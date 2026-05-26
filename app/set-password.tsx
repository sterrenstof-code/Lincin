import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";

/**
 * Verplicht wachtwoord-instellen scherm. Wordt afgedwongen na de eerste
 * magic-link login (zie app/(app)/_layout.tsx redirect). Detecteert
 * automatisch als de gebruiker al een wachtwoord heeft (via "same password"
 * error) en biedt een handmatige escape voor wie zeker weet dat hij er één
 * heeft maar de metadata-vlag mist.
 */
export default function SetPasswordScreen() {
  const router = useRouter();
  const { setPassword, signOut, session, markHasPassword, hasPassword } = useAuth();

  // Wanneer hasPassword via een andere route true wordt (bv. signInWithPassword
  // schrijft de metadata-vlag automatisch), verplaats user naar feed.
  useEffect(() => {
    if (hasPassword) {
      router.replace("/(app)/feed");
    }
  }, [hasPassword, router]);
  const [password, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave =
    !saving && password.length >= 8 && password === confirmPwd;

  async function onSave() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const { error } = await setPassword(password);
    if (error) {
      // Supabase weigert ditzelfde wachtwoord opnieuw te zetten — dat is
      // bewijs dat er al een wachtwoord staat. Markeer de vlag en ga door.
      if (
        /different from|same.password|niet hetzelfde|same as the old/i.test(
          error.message
        )
      ) {
        const { error: markErr } = await markHasPassword();
        if (markErr) {
          setError(markErr.message);
        } else {
          router.replace("/(app)/feed");
        }
        setSaving(false);
        return;
      }
      setError(error.message);
      setSaving(false);
      return;
    }
    router.replace("/(app)/feed");
  }

  async function onSkipAlreadyHave() {
    setSkipping(true);
    setError(null);
    const { error } = await markHasPassword();
    if (error) {
      setError(error.message);
      setSkipping(false);
      return;
    }
    router.replace("/(app)/feed");
  }

  return (
    <SafeAreaView className="flex-1 bg-shell">
      <ScreenContainer>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              padding: 24,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View className="bg-paper rounded-3xl p-8">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
                Eén stap nog
              </Text>
              <Text className="text-3xl font-bold tracking-tight text-ink">
                Stel een wachtwoord in
              </Text>
              <Text className="text-ink-soft text-base mt-2 mb-6 leading-6">
                Je bent ingelogd via {session?.user.email}. Voeg een wachtwoord toe zodat je niet telkens een magic-link moet aanvragen.
              </Text>

              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Wachtwoord
              </Text>
              <TextInput
                value={password}
                onChangeText={setPwd}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="min. 8 tekens"
                placeholderTextColor="#8A7E6C"
                className="bg-paper-light text-ink text-base px-5 py-3.5 rounded-full border border-line-paper"
              />

              <View className="h-4" />

              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Bevestig
              </Text>
              <TextInput
                value={confirmPwd}
                onChangeText={setConfirmPwd}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="herhaal"
                placeholderTextColor="#8A7E6C"
                onSubmitEditing={onSave}
                className="bg-paper-light text-ink text-base px-5 py-3.5 rounded-full border border-line-paper"
              />

              {password.length > 0 && password.length < 8 && (
                <Text className="text-red-700 text-xs mt-2">
                  Minstens 8 tekens.
                </Text>
              )}
              {confirmPwd.length > 0 && password !== confirmPwd && (
                <Text className="text-red-700 text-xs mt-2">
                  Bevestiging matcht niet.
                </Text>
              )}

              <Pressable
                onPress={onSave}
                disabled={!canSave}
                className={`mt-6 rounded-full py-3.5 items-center ${
                  canSave ? "bg-ink active:bg-ink-soft" : "bg-paper-warm"
                }`}
              >
                <Text
                  className={`font-semibold text-base ${
                    canSave ? "text-cream" : "text-ink-muted"
                  }`}
                >
                  {saving ? "Bezig…" : "Wachtwoord opslaan"}
                </Text>
              </Pressable>

              {error && (
                <Text className="text-red-700 text-sm mt-3 text-center">
                  {error}
                </Text>
              )}

              {/* Escape voor accounts die al een wachtwoord hebben */}
              <Pressable
                onPress={onSkipAlreadyHave}
                disabled={skipping}
                className="mt-5 items-center"
                hitSlop={8}
              >
                <Text className="text-ink-soft text-sm underline">
                  {skipping ? "Bezig…" : "Ik heb al een wachtwoord — sla over"}
                </Text>
              </Pressable>

              <Pressable
                onPress={signOut}
                className="mt-3 items-center"
                hitSlop={8}
              >
                <Text className="text-ink-muted text-xs underline">
                  Uitloggen
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}
