import { Redirect, useRouter } from "expo-router";
import { useRef, useState } from "react";
import { View, type TextInput } from "react-native";

import { AuthNotice, AuthPage, AuthSub, AuthTitle, AuthTop, AuthWordmark, LinedField, PrimaryButton } from "@/components/lincin/auth/AuthKit";
import { useAuth } from "@/lib/auth/provider";
import { usePageTitle } from "@/lib/page-title";

/**
 * Een (nieuw) wachtwoord kiezen.
 *
 * Tot okt 2026 was dit een verplichte poort voor iedereen zonder
 * wachtwoord — wie via een magic link binnenkwam, moest er eerst een
 * kiezen. Magic link, Apple en Google zijn nu volwaardige manieren om in te
 * loggen, dus die poort is weg. Twee wegen leiden nog hierheen:
 *
 *   - de link uit "Wachtwoord vergeten" (`recovering`, zie
 *     lib/auth/provider.tsx): de app stuurt je hier eerst langs;
 *   - wie een wachtwoord wil toevoegen aan een account zonder.
 *
 * Zelfde blad en bouwstenen als het inlogscherm (Login Voorbeeld).
 */
export default function SetPasswordScreen() {
  usePageTitle("Wachtwoord instellen");
  const router = useRouter();
  const { setPassword, session, loading, recovering, endRecovery } = useAuth();
  const [password, setPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<TextInput>(null);

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/welcome" />;

  const done = () => {
    endRecovery();
    router.replace("/(app)/feed");
  };

  async function onSave() {
    if (password.length < 8) return setError("Kies een wachtwoord van minstens 8 tekens.");
    if (password !== confirmPwd) return setError("De twee wachtwoorden zijn niet gelijk.");
    setSaving(true);
    setError(null);
    const { error } = await setPassword(password);
    setSaving(false);
    // Supabase weigert hetzelfde wachtwoord opnieuw te zetten. Dan staat
    // het er dus al, en is er niets meer te doen.
    if (error && !/different from|same.password|same as the old/i.test(error.message)) return setError(error.message);
    done();
  }

  return (
    <AuthPage>
      <AuthTop label="Wachtwoord" onBack={recovering ? undefined : () => router.replace("/(app)/feed")} />
      <View style={{ paddingTop: 28, paddingHorizontal: 24, gap: 10 }}>
        <AuthWordmark size={40} />
        <AuthTitle>{recovering ? "Kies een nieuw wachtwoord." : "Een wachtwoord erbij?"}</AuthTitle>
        <AuthSub>
          {recovering
            ? `Je bent ingelogd als ${session.user.email}. Kies een nieuw wachtwoord om voortaan mee in te loggen.`
            : `Je bent ingelogd als ${session.user.email}. Met een wachtwoord hoef je geen link meer aan te vragen.`}
        </AuthSub>
      </View>

      <View style={{ marginTop: 28, marginHorizontal: 24, gap: 22 }}>
        <LinedField
          label="Nieuw wachtwoord"
          value={password}
          onChangeText={(v) => {
            setPwd(v);
            setError(null);
          }}
          placeholder="minstens 8 tekens"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <LinedField
          ref={confirmRef}
          label="Nog eens"
          value={confirmPwd}
          onChangeText={(v) => {
            setConfirmPwd(v);
            setError(null);
          }}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={onSave}
        />
      </View>
      {error ? (
        <View style={{ marginTop: 20, marginHorizontal: 24 }}>
          <AuthNotice tone="error">{error}</AuthNotice>
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: 28 }} />
      <View style={{ marginHorizontal: 6, marginBottom: 24 }}>
        <PrimaryButton label="Wachtwoord bewaren" onPress={onSave} busy={saving} />
      </View>
    </AuthPage>
  );
}
