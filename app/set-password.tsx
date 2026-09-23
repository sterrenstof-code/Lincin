import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Field, Note, PageTitle, Section } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import { color, friendColor, pageTint, RASTER, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { usePageTitle } from "@/lib/page-title";

/**
 * Verplicht wachtwoord-instellen scherm. Wordt afgedwongen na de eerste
 * magic-link login (zie app/(app)/_layout.tsx redirect). Detecteert
 * automatisch als de gebruiker al een wachtwoord heeft (via "same password"
 * error) en biedt een handmatige escape voor wie zeker weet dat hij er één
 * heeft maar de metadata-vlag mist.
 *
 * DE VORM. Een poort, geen subpagina: er is geen weg terug en de app
 * erachter is nog dicht, dus geen `SubPage` met terugknop, tabbalk of
 * meldingen. Wel dezelfde onderdelen als Instellingen en Profiel
 * bewerken (kop, rubriek, veld, knop) op een los blad in de vorm van het
 * thema — hetzelfde blad als het inlogscherm.
 */
export default function SetPasswordScreen() {
  usePageTitle("Wachtwoord instellen");
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
  const confirmRef = useRef<TextInput>(null);

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
    <Gate>
      <PageTitle
        kicker="Eén stap nog"
        title="Stel een wachtwoord in"
        sub={`Je bent ingelogd via ${session?.user.email}. Voeg een wachtwoord toe zodat je niet telkens een magic-link moet aanvragen.`}
      />

      <Section label="Wachtwoord" pad>
        <Field
          label="Wachtwoord"
          value={password}
          onChangeText={setPwd}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          placeholder="min. 8 tekens"
          error={password.length > 0 && password.length < 8 ? "Minstens 8 tekens." : null}
        />
        <Field
          ref={confirmRef}
          label="Bevestig"
          value={confirmPwd}
          onChangeText={setConfirmPwd}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          placeholder="herhaal"
          onSubmitEditing={onSave}
          error={confirmPwd.length > 0 && password !== confirmPwd ? "Bevestiging matcht niet." : null}
        />

        <Button
          label={saving ? "Bezig…" : "Wachtwoord opslaan"}
          tone="primary"
          busy={saving}
          disabled={!canSave && !saving}
          onPress={onSave}
        />

        {error ? <Note tone="red">{error}</Note> : null}
      </Section>

      {/* Escape voor accounts die al een wachtwoord hebben */}
      <Button
        label={skipping ? "Bezig…" : "Ik heb al een wachtwoord — sla over"}
        tone="quiet"
        small
        disabled={skipping}
        onPress={onSkipAlreadyHave}
      />
      <Button label="Uitloggen" tone="quiet" small icon="log-out-outline" onPress={signOut} />
    </Gate>
  );
}

// ---------------------------------------------------------------
// Het blad van een poort (dezelfde vorm als app/(auth)/login.tsx)
// ---------------------------------------------------------------

/** De kleur van het blad: dezelfde als de kop (`PageTitle` valt terug op oranje). */
const GATE_HUE: Hue = "orange";

/**
 * Een los blad in de vorm van het thema: papier, in modern met de zachte
 * kleurhaze eronder, een kolom van hoogstens 520 in het midden, en het
 * toetsenbord dat de pagina opschuift. De marges en de naad zijn die van
 * `SubPage`.
 */
function Gate({ children }: { children: ReactNode }) {
  const th = useThemeSpec().id;
  const insets = useSafeAreaInsets();
  const pad = th === "kleur" ? 18 : RASTER.seam;
  return (
    <View style={{ flex: 1, backgroundColor: color("paper") }}>
      {th === "modern" ? <Haze hue={GATE_HUE} /> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", padding: pad, gap: th === "kleur" ? 16 : RASTER.seam }}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/** De kleurhaze van modern, zoals in `LincinScreen`: alleen op web. */
function Haze({ hue }: { hue: Hue }) {
  const scheme = useScheme();
  if (Platform.OS !== "web") return null;
  const fill = friendColor(hue, scheme).fill;
  const a = pageTint(fill, scheme, { light: 0.4, dark: 0.52 });
  const b = pageTint(fill, scheme, { light: 0.26, dark: 0.34 });
  return (
    <View
      style={[
        { pointerEvents: "none", position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
        {
          backgroundImage: [
            `radial-gradient(118% 60% at 12% -8%, ${a} 0%, transparent 62%)`,
            `radial-gradient(110% 60% at 100% 110%, ${b} 0%, transparent 66%)`,
          ].join(", "),
        } as object,
      ]}
    />
  );
}
