import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import {
  AuthNotice,
  AuthPage,
  AuthSub,
  AuthTitle,
  AuthTop,
  CellRow,
  OutlineButton,
  PrimaryButton,
  StepBars,
  type CellAction,
} from "@/components/lincin/auth/AuthKit";
import { getMyFriendCode } from "@/lib/api/friend-codes";
import { getProfile, updateMyProfile, uploadAvatar } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { uriToBytes } from "@/lib/crypto/file";
import { color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import { usePageTitle } from "@/lib/page-title";
import { buildFriendCodeUrl, copyToClipboard, shareText } from "@/lib/share";
import { supabase } from "@/lib/supabase/client";

/**
 * De stappen na het aanmaken van een account (Login Voorbeeld 1c–1d):
 *
 *   2 / 3  een profielfoto, optioneel. Het prototype tekent deze stap niet;
 *          hij volgt de vorm van stap 1 en 3.
 *   3 / 3  vrienden uitnodigen: jouw code (`JV-4821`, 0082), de link en
 *          een QR erbij, en de rij Deel link · Scan code · Contacten.
 *
 * "Later doen" en "Naar je editie" zetten allebei `onboarded_at` (0082):
 * de stappen komen daarna niet meer terug. Alleen een nieuw account komt
 * hier; zie de poort in `app/(app)/_layout.tsx`.
 */
const QR_INK = "#16160F";
const QR_PAPER = "#F7F4EE";

export default function OnboardingScreen() {
  usePageTitle("Welkom");
  const { session, loading } = useAuth();
  const [step, setStep] = useState<2 | 3>(2);
  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  return step === 2 ? <PhotoStep userId={session.user.id} onNext={() => setStep(3)} /> : <InviteStep userId={session.user.id} onBack={() => setStep(2)} />;
}

function PhotoStep({ userId, onNext }: { userId: string; onNext: () => void }) {
  const scheme = useScheme();
  const modern = useThemeSpec().id === "modern";
  useHueChoices();
  const profile = useQuery({ queryKey: ["profile", userId], queryFn: () => getProfile(userId) });
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();

  const name = profile.data?.display_name || profile.data?.username || "";
  const fc = friendColor(hueFor(userId), scheme);
  const shown = preview ?? profile.data?.avatar_url ?? null;

  async function onPick() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setPreview(asset.uri);
    setBusy(true);
    try {
      const bytes = await uriToBytes(asset.uri);
      const url = await uploadAvatar(userId, bytes, asset.mimeType ?? "image/jpeg");
      await updateMyProfile(userId, { avatar_url: url });
      await qc.invalidateQueries({ queryKey: ["profile", userId] });
    } catch (e: any) {
      setPreview(null);
      setError(e?.message ?? "De foto kon niet bewaard worden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthPage>
      <AuthTop label="Account maken · 2 / 3" />
      <View style={{ marginTop: 20, marginHorizontal: 24 }}>
        <StepBars step={2} />
      </View>
      <View style={{ paddingTop: 28, paddingHorizontal: 24, gap: 10 }}>
        <AuthTitle>Een gezicht bij je naam?</AuthTitle>
        <AuthSub>Optioneel. Zo herkennen je vrienden je meteen tussen de bijdragen.</AuthSub>
      </View>

      <View style={{ marginTop: 32, alignItems: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Kies een profielfoto"
          onPress={onPick}
          style={{ width: 168, height: 168, borderRadius: modern ? 84 : 0, overflow: "hidden", backgroundColor: fc.fill, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={[sans(900), { fontSize: 88, lineHeight: 92, letterSpacing: -4, color: fc.ink }]}>{name.slice(0, 1).toUpperCase() || "?"}</Text>
          {shown ? <Image source={{ uri: shown }} contentFit="cover" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} /> : null}
        </Pressable>
        {name ? <Text style={[serif(true), { marginTop: 14, fontSize: 24, lineHeight: 28, color: color("ink") }]}>{name}</Text> : null}
      </View>

      <View style={{ marginTop: 24, marginHorizontal: 6, gap: 6 }}>
        <OutlineButton label={shown ? "Andere foto" : "Kies een foto"} onPress={onPick} />
      </View>
      {error ? (
        <View style={{ marginTop: 14, marginHorizontal: 24 }}>
          <AuthNotice tone="error">{error}</AuthNotice>
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: 28 }} />
      <View style={{ paddingHorizontal: 24, paddingBottom: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <Pressable accessibilityRole="button" onPress={onNext} hitSlop={10}>
          <AuthSub>Overslaan</AuthSub>
        </Pressable>
        <PrimaryButton label="Volgende" onPress={onNext} busy={busy} height={48} style={{ minWidth: 180, gap: 28 }} />
      </View>
    </AuthPage>
  );
}

function InviteStep({ userId, onBack }: { userId: string; onBack: () => void }) {
  const qc = useQueryClient();
  const modern = useThemeSpec().id === "modern";
  const code = useQuery({ queryKey: ["friend-code", userId], queryFn: () => getMyFriendCode(userId) });
  const [note, setNote] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const link = code.data ? buildFriendCodeUrl(code.data) : null;

  async function finish() {
    setLeaving(true);
    await supabase.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("id", userId);
    qc.setQueryData(["onboarded", userId], true);
    router.replace("/(app)/feed");
  }

  async function onShare() {
    if (!link || !code.data) return;
    const result = await shareText({ title: "Linc met mij op Lincin", message: `Linc met mij op Lincin — mijn code is ${code.data}: ${link}` });
    if (result === "copied") setNote("Link gekopieerd.");
    else if (result === "failed" && (await copyToClipboard(link))) setNote("Link gekopieerd.");
  }

  const cells: CellAction[] = [
    { key: "share", glyph: "↗", label: "Deel link", onPress: onShare },
    { key: "scan", glyph: "▣", label: "Scan code", onPress: () => router.push("/qr-scan") },
    // Contacten lezen kan alleen op een telefoon (app/contacts.tsx); op
    // web nodigt de derde cel uit per e-mail (de bestaande uitnodiging).
    Platform.OS === "web"
      ? { key: "mail", glyph: "✉", label: "E-mail", onPress: () => router.push("/invite-email") }
      : { key: "contacts", glyph: "☷", label: "Contacten", onPress: () => router.push("/contacts") },
  ];

  return (
    <AuthPage>
      <AuthTop label="Account maken · 3 / 3" onBack={onBack} />
      <View style={{ marginTop: 20, marginHorizontal: 24 }}>
        <StepBars step={3} />
      </View>
      <View style={{ paddingTop: 28, paddingHorizontal: 24, gap: 10 }}>
        <AuthTitle>Je editie is nog leeg.</AuthTitle>
        <AuthSub>Lincin werkt alleen met vrienden die je kent. Nodig er een paar uit, of scan hun code.</AuthSub>
      </View>

      <View style={{ marginTop: 26, marginHorizontal: 6, backgroundColor: color("ink"), paddingVertical: 22, paddingHorizontal: 20, gap: 14, borderRadius: modern ? 18 : 0 }}>
        <Text style={[sans(500), { fontSize: 8.5, lineHeight: 11, letterSpacing: 8.5 * 0.2, textTransform: "uppercase", color: color("paper"), opacity: 0.7 }]}>Jouw code</Text>
        <Text selectable style={[sans(900), { fontSize: 54, lineHeight: Platform.OS === "web" ? 44 : 54, letterSpacing: 54 * -0.04, color: color("paper") }]}>
          {code.data ?? (code.isLoading ? "…" : "—")}
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
          <Text selectable numberOfLines={2} style={[serif(true), { flex: 1, fontSize: 16, lineHeight: 20, color: color("paper"), opacity: 0.85 }]}>
            {link?.replace(/^https?:\/\//, "") ?? ""}
          </Text>
          <View style={{ width: 92, height: 92, padding: 6, backgroundColor: QR_PAPER }}>
            {link ? <QRCode value={link} size={80} color={QR_INK} backgroundColor={QR_PAPER} /> : null}
          </View>
        </View>
      </View>

      <View style={{ marginTop: 6, marginHorizontal: 6 }}>
        <CellRow cells={cells} />
      </View>
      {note ? (
        <View style={{ marginTop: 14, marginHorizontal: 24 }}>
          <AuthNotice>{note}</AuthNotice>
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: 28 }} />
      <View style={{ paddingHorizontal: 24, paddingBottom: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <Pressable accessibilityRole="button" onPress={finish} hitSlop={10} disabled={leaving}>
          <AuthSub>Later doen</AuthSub>
        </Pressable>
        <PrimaryButton label="Naar je editie" onPress={finish} busy={leaving} height={48} style={{ minWidth: 200, gap: 28 }} />
      </View>
    </AuthPage>
  );
}
