/**
 * Nieuw toestel: ontvang de identity-sleutels via QR-scan of geplakte link.
 * Hiermee worden ook oude berichten (van vóór dit toestel zich registreerde)
 * leesbaar, doordat de private key van het brontoestel gekopieerd wordt.
 *
 * Toegangspaden:
 *   1. Profiel → Beveiliging → "Nieuw apparaat koppelen" → camera-scanner
 *   2. Deep link: lincin://device-receive?s=…&u=…  (automatisch verwerkt)
 *   3. Handmatig plakken (desktop-web: geen camera, of bij camerafout)
 *
 * In de vorm van het thema (components/lincin/SubPage): de vraag om
 * cameratoegang en het plakveld als subpagina, de scanner met een korte
 * kop zodat de camera de ruimte krijgt.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Text, useWindowDimensions, View } from "react-native";

import { bodyStyle, Button, Field, IconBtn, labelStyle, Note, Panel, Section, SubPage, titleStyle } from "@/components/lincin/SubPage";
import { RequireSession } from "@/components/RequireSession";
import { useAuth } from "@/lib/auth/provider";
import { consumeTransferPackage } from "@/lib/crypto/transfer";
import { color, ON_DARK, ON_LIGHT, RASTER, useThemeSpec } from "@/lib/design/theme";
import { mono } from "@/lib/design/type";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";

function DeviceReceiveScreenBody() {
  const { session } = useAuth();
  const router = useRouter();
  // Params via deep link: lincin://device-receive?s=<secret>&u=<userId>
  const params = useLocalSearchParams<{ s?: string; u?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [showManual, setShowManual] = useState(
    // Desktop web heeft zelden een bruikbare camera — start direct met handmatig
    Platform.OS === "web" && typeof navigator !== "undefined"
      ? !/Android|iPhone|iPad/.test(navigator.userAgent)
      : false
  );

  // Verwerk deep-link params zodra scherm opent
  useEffect(() => {
    if (params.s && params.u && !scanned) {
      handleTransfer(decodeURIComponent(params.s), params.u);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.s, params.u]);

  async function handleTransfer(secret: string, userId: string) {
    if (processing) return;
    setScanned(true);
    setProcessing(true);
    setError(null);
    try {
      if (userId !== session!.user.id) {
        throw new Error(
          "Deze QR-code is voor een ander account. Log in met het juiste account."
        );
      }
      await consumeTransferPackage(secret, userId);
      // Na overdracht: navigeer direct naar feed.
      // Bootstrap is non-blocking — de nieuwe private key is nu in SecureStore.
      router.replace("/(app)/feed" as any);
    } catch (e: any) {
      setError(e?.message ?? "Overdracht mislukt.");
      setScanned(false);
    } finally {
      setProcessing(false);
    }
  }

  function onBarcodeScanned({ data }: { data: string }) {
    if (scanned || processing) return;
    parseAndHandle(data);
  }

  function parseAndHandle(raw: string) {
    try {
      // Zet lincin:// om naar https:// voor URL-parsing
      const normalized = raw.startsWith("lincin://")
        ? raw.replace("lincin://", "https://lincin.app/")
        : raw;
      const url = new URL(normalized);
      const s = url.searchParams.get("s");
      const u = url.searchParams.get("u");
      if (s && u) {
        handleTransfer(decodeURIComponent(s), u);
      } else {
        setError("Ongeldige QR-code. Scan een Lincin-koppelingsQR.");
        setScanned(false);
      }
    } catch {
      setError("Ongeldige QR-code of URL.");
      setScanned(false);
    }
  }

  async function onManualSubmit() {
    const cleaned = manualInput.trim();
    if (!cleaned) return;
    parseAndHandle(cleaned);
  }

  const th = useThemeSpec().id;
  const round = th !== "kleur";
  const { height: winH } = useWindowDimensions();

  // ── Laadspinner tijdens verwerking ──────────────────────────────────────────
  // Zonder kop of terugknop, net als eerst: de overdracht loopt, en weglopen
  // halverwege helpt niemand.
  if (processing) {
    return (
      <View style={{ flex: 1, backgroundColor: color("paper"), alignItems: "center", justifyContent: "center", gap: 16 }}>
        <ActivityIndicator color={color("ink")} size="large" />
        <Text style={labelStyle(th, 10, color("ink", "inkDim"))}>Sleutels worden overgedragen…</Text>
      </View>
    );
  }

  // ── Handmatige invoer (desktop web of camera geweigerd) ─────────────────────
  if (showManual) {
    return (
      <SubPage
        title="Koppelingslink invoeren"
        kicker="Nieuw toestel"
        sub="Kopieer de koppelingslink van je andere apparaat en plak hem hieronder."
        back="/(app)/profile"
        tab="you"
        keyboard
      >
        <Section label="Koppelingslink" pad>
          <Field
            accessibilityLabel="Koppelingslink"
            value={manualInput}
            onChangeText={setManualInput}
            placeholder="lincin://device-receive?s=…&u=…"
            autoCapitalize="none"
            autoCorrect={false}
            multiline={false}
            error={error}
            style={{ ...mono(400), fontSize: 12 }}
          />
          <Button
            label="Koppel apparaat"
            tone="primary"
            icon="link-outline"
            disabled={!manualInput.trim()}
            onPress={onManualSubmit}
          />
          {Platform.OS !== "web" && (
            <Button label="Camera gebruiken" tone="quiet" icon="camera-outline" onPress={() => setShowManual(false)} />
          )}
        </Section>
      </SubPage>
    );
  }

  /**
   * Nog niets gevraagd is nog geen weigering.
   *
   * `!permission?.granted` was op de eerste render altijd waar — `permission`
   * is dan `null`, want de hook heeft het systeem nog niet gesproken. Je zag
   * dus "Camera nodig" flitsen vóórdat er iemand iets geweigerd had, en pas
   * daarna verscheen de camera. Een scherm dat zegt dat je iets weigerde
   * terwijl je nog niets gevraagd is, is een leugen met een knop eronder.
   *
   * `qr-scan.tsx` doet dit twintig regels verderop wél goed; dit is dezelfde
   * regel.
   */
  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: color("paper") }} />;
  }

  // ── Camera toestemming vragen ────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <SubPage
        title="Camera nodig"
        kicker="Nieuw toestel"
        sub="Om de QR-code te scannen heeft Lincin toegang tot je camera nodig."
        back="/(app)/profile"
        tab="you"
      >
        {error ? <Note tone="red">{error}</Note> : null}
        <Section pad>
          <Button label="Geef cameratoegang" tone="primary" icon="camera-outline" onPress={requestPermission} />
          <Button label="Link handmatig invoeren" icon="link-outline" onPress={() => setShowManual(true)} />
          <Button label="Annuleren" tone="quiet" onPress={() => safeBack(router, "/(app)/profile")} />
        </Section>
      </SubPage>
    );
  }

  // ── QR-scanner ──────────────────────────────────────────────────────────────
  return (
    <SubPage title={null} kicker="Nieuw toestel" back="/(app)/profile" tab="you" scroll={false}>
      {/* Een korte kop in plaats van de grote: de camera krijgt de ruimte. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: th === "kleur" ? 0 : 12 }}>
        <Text style={[titleStyle(th, 26), { flex: 1 }]} numberOfLines={1}>
          Scan QR-code
        </Text>
        <Button label="Link invoeren" small icon="link-outline" onPress={() => setShowManual(true)} />
      </View>

      {/* Camera, in de vorm van het thema: kader in kleur, ronding in modern.
          Een vaste hoogte uit het venster: zonder scroll rekt het blad van
          `SubPage` zijn inhoud niet op, dus `flex: 1` zou hier inklappen. */}
      <View
        style={{
          height: Math.max(280, Math.min(640, winH - 260)),
          overflow: "hidden",
          backgroundColor: ON_LIGHT,
          borderRadius: th === "modern" ? RASTER.tileRadius : 0,
          borderWidth: th === "kleur" ? 1.5 : 0,
          borderColor: color("ink"),
        }}
      >
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcodeScanned}
        />

        {/* Scanner-overlay */}
        <View
          style={{
            pointerEvents: "none",
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 240,
              height: 240,
              borderWidth: th === "kleur" ? 3 : 2,
              borderColor: ON_DARK,
              borderRadius: round ? 16 : 0,
            }}
          />
          <Text style={[labelStyle(th, 10, ON_DARK), { marginTop: 16 }]}>Richt je camera op de QR-code</Text>
        </View>
      </View>

      {/* Foutmelding onderaan */}
      {error ? (
        <Panel style={{ borderLeftWidth: th === "kleur" ? undefined : 5, borderLeftColor: color("red"), ...(th === "kleur" ? { borderColor: color("red") } : null) }}>
          <View accessibilityRole="alert" style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 12 }}>
            <Ionicons name="warning-outline" color={color("red")} size={16} />
            <Text style={[bodyStyle(th, 13), { flex: 1 }]}>{error}</Text>
            <IconBtn icon="close" label="Waarschuwing sluiten" size={32} onPress={() => setError(null)} />
          </View>
        </Panel>
      ) : null}
    </SubPage>
  );
}

/**
 * Dit scherm leest `session!.user.id` en staat in de wortelstack, die niets
 * bewaakt — zie components/RequireSession.tsx voor waarom dat een wit scherm
 * opleverde in plaats van een inlogpagina.
 */
export default function DeviceReceiveScreen() {
  usePageTitle("Toestel koppelen");
  return (
    <RequireSession>
      <DeviceReceiveScreenBody />
    </RequireSession>
  );
}
