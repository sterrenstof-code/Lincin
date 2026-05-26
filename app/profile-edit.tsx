import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import {
  getProfile,
  updateMyProfile,
  validateUsername,
} from "@/lib/api/profiles";

export default function ProfileEditScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session, setPassword } = useAuth();
  const myUserId = session!.user.id;

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [password, setPwd] = useState("");
  const [passwordConfirm, setPwdConfirm] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdResult, setPwdResult] = useState<
    null | { ok: true } | { ok: false; message: string }
  >(null);

  useEffect(() => {
    (async () => {
      const p = await getProfile(myUserId);
      if (p) {
        setUsername(p.username);
        setDisplayName(p.display_name ?? "");
      }
      setLoading(false);
    })();
  }, [myUserId]);

  const usernameError =
    username.length > 0 ? validateUsername(username.toLowerCase()) : null;
  const canSave = !saving && username.length >= 3 && !usernameError;

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await updateMyProfile(myUserId, {
        username: username.toLowerCase(),
        display_name: displayName,
      });
      await qc.invalidateQueries({ queryKey: ["profile", myUserId] });
      router.back();
    } catch (e: any) {
      setError(e?.message ?? "Kon profiel niet opslaan.");
    } finally {
      setSaving(false);
    }
  }

  const passwordValid =
    password.length >= 8 && password === passwordConfirm && !pwdSaving;

  async function onSavePassword() {
    if (!passwordValid) return;
    setPwdSaving(true);
    setPwdResult(null);
    const { error } = await setPassword(password);
    if (error) {
      setPwdResult({ ok: false, message: error.message });
    } else {
      setPwdResult({ ok: true });
      setPwd("");
      setPwdConfirm("");
    }
    setPwdSaving(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top", "left", "right"]}>
      <ScreenContainer>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
        >
          <Ionicons name="close" color="#1A1714" size={20} />
        </Pressable>
        <Text className="flex-1 text-cream text-lg font-semibold ml-3">
          Profiel bewerken
        </Text>
        <Pressable
          onPress={onSave}
          disabled={!canSave}
          className={`rounded-full px-4 py-2 ${
            canSave ? "bg-cream active:bg-cream-soft" : "bg-shell-soft"
          }`}
        >
          <Text className={`font-semibold ${canSave ? "text-ink" : "text-cream-muted"}`}>
            {saving ? "Bezig…" : "Bewaren"}
          </Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#F5E8D3" />
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}>
            <View className="bg-paper rounded-3xl p-6">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Gebruikersnaam
              </Text>
              <View className="flex-row items-center bg-paper-light rounded-full px-4 border border-line-paper">
                <Text className="text-ink-muted text-base">@</Text>
                <TextInput
                  value={username}
                  onChangeText={(t) => setUsername(t.toLowerCase())}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="kies een handle"
                  placeholderTextColor="#8A7E6C"
                  className="flex-1 text-ink text-base py-3 pl-1"
                  maxLength={32}
                />
              </View>
              {usernameError ? (
                <Text className="text-red-700 text-xs mt-2">{usernameError}</Text>
              ) : (
                <Text className="text-ink-muted text-xs mt-2">
                  3–32 tekens. Kleine letters, cijfers, punt of underscore.
                </Text>
              )}

              <View className="h-6" />

              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Weergavenaam (optioneel)
              </Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="bv. Tom"
                placeholderTextColor="#8A7E6C"
                className="bg-paper-light text-ink text-base px-4 py-3 rounded-full border border-line-paper"
                maxLength={48}
              />
              <Text className="text-ink-muted text-xs mt-2">
                Dit zien je vrienden in chats en op je posts.
              </Text>
            </View>

            {error && (
              <View className="bg-red-100 border border-red-300 rounded-2xl px-4 py-3 mt-4">
                <Text className="text-red-800 text-sm">{error}</Text>
              </View>
            )}

            {/* Wachtwoord instellen / wijzigen */}
            <View className="bg-paper rounded-3xl p-6 mt-4">
              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
                Beveiliging
              </Text>
              <Text className="text-2xl font-bold tracking-tight text-ink mb-1">
                Wachtwoord instellen
              </Text>
              <Text className="text-ink-soft text-sm leading-5 mb-4">
                Voeg een wachtwoord toe zodat je niet telkens een magic link
                moet gebruiken. Bestaande sessies blijven actief.
              </Text>

              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Nieuw wachtwoord
              </Text>
              <TextInput
                value={password}
                onChangeText={setPwd}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="min. 8 tekens"
                placeholderTextColor="#8A7E6C"
                className="bg-paper-light text-ink text-base px-4 py-3 rounded-full border border-line-paper"
              />

              <View className="h-4" />

              <Text className="text-xs uppercase tracking-wider text-ink-muted mb-2">
                Bevestig
              </Text>
              <TextInput
                value={passwordConfirm}
                onChangeText={setPwdConfirm}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="herhaal je wachtwoord"
                placeholderTextColor="#8A7E6C"
                className="bg-paper-light text-ink text-base px-4 py-3 rounded-full border border-line-paper"
              />

              {password.length > 0 && password.length < 8 && (
                <Text className="text-red-700 text-xs mt-2">
                  Minstens 8 tekens.
                </Text>
              )}
              {passwordConfirm.length > 0 && password !== passwordConfirm && (
                <Text className="text-red-700 text-xs mt-2">
                  Bevestiging matcht niet.
                </Text>
              )}

              <Pressable
                onPress={onSavePassword}
                disabled={!passwordValid}
                className={`mt-5 rounded-full py-3 items-center ${
                  passwordValid ? "bg-ink active:bg-ink-soft" : "bg-paper-warm"
                }`}
              >
                <Text
                  className={`font-semibold ${
                    passwordValid ? "text-cream" : "text-ink-muted"
                  }`}
                >
                  {pwdSaving ? "Bezig…" : "Wachtwoord opslaan"}
                </Text>
              </Pressable>

              {pwdResult?.ok === true && (
                <Text className="text-ink text-sm mt-3 text-center">
                  ✓ Wachtwoord ingesteld. Volgende keer kan je inloggen met je e-mail en wachtwoord.
                </Text>
              )}
              {pwdResult && pwdResult.ok === false && (
                <Text className="text-red-700 text-sm mt-3 text-center">
                  {pwdResult.message}
                </Text>
              )}
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
  );
}
