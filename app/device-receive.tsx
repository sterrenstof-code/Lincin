/**
 * Nieuw toestel: ontvang de identity-sleutels via QR-scan of geplakte link.
 * Hiermee worden ook oude berichten (van vóór dit toestel zich registreerde)
 * leesbaar, doordat de private key van het brontoestel gekopieerd wordt.
 *
 * Toegangspaden:
 *   1. Profiel → Beveiliging → "Nieuw apparaat koppelen" → camera-scanner
 *   2. Deep link: lincin://device-receive?s=…&u=…  (automatisch verwerkt)
 *   3. Handmatig plakken (desktop-web: geen camera, of bij camerafout)
 */

import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { RequireSession } from "@/components/RequireSession";
import { FieldError } from "@/components/FormError";
import { useAuth } from "@/lib/auth/provider";
import { consumeTransferPackage } from "@/lib/crypto/transfer";
import {
  creamOnDark,
  desk,
  feed,
  FEED_BORDER,
  feedType,
  flame,
} from "@/lib/design/type";
import { safeBack } from "@/lib/nav";

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

  // ── Laadspinner tijdens verwerking ──────────────────────────────────────────
  if (processing) {
    return (
      <SafeAreaView className="flex-1 bg-desk items-center justify-center gap-4">
        <ActivityIndicator color={desk.ink} size="large" />
        <Text className="text-ink-soft text-sm">Sleutels worden overgedragen…</Text>
      </SafeAreaView>
    );
  }

  // ── Handmatige invoer (desktop web of camera geweigerd) ─────────────────────
  if (showManual) {
    return (
      <SafeAreaView className="flex-1 bg-desk px-6 justify-center">
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") setShowManual(false);
            else safeBack(router, "/(app)/profile");
          }}
          className="flex-row items-center mb-6"
        >
          <Ionicons name="arrow-back" color={feed.inkDim} size={18} />
          <Text className="text-ink-soft text-sm ml-1">Terug</Text>
        </Pressable>

        <View className="w-12 h-12 bg-brand/20 items-center justify-center mb-4">
          <Ionicons name="link-outline" color="#5B8DEF" size={22} />
        </View>
        <Text className="text-ink text-xl font-bold mb-2">
          Koppelingslink invoeren
        </Text>
        <Text className="text-ink-soft text-sm mb-5 leading-5">
          Kopieer de koppelingslink van je andere apparaat en plak hem hieronder.
        </Text>

        <TextInput
          value={manualInput}
          onChangeText={setManualInput}
          placeholder="lincin://device-receive?s=…&u=…"
          placeholderTextColor={feed.inkDim}
          autoCapitalize="none"
          autoCorrect={false}
          multiline={false}
          className="bg-paper-soft px-4 py-3.5 text-ink text-xs font-mono mb-3"
          style={{
            borderWidth: 1,
            borderColor: manualInput ? "#5B8DEF" : "transparent",
          }}
        />

        {error && (
          <FieldError tone="desk" style={{ marginBottom: 12 }}>{error}</FieldError>
        )}

        <Pressable
          onPress={onManualSubmit}
          disabled={!manualInput.trim()}
          className={` py-3.5 items-center mb-3 ${
            manualInput.trim() ? "bg-ink active:bg-ink-soft" : "bg-paper-warm"
          }`}
        >
          <Text
            className={`font-bold ${
              manualInput.trim() ? "text-cream" : "text-ink-muted"
            }`}
          >
            Koppel apparaat
          </Text>
        </Pressable>

        {Platform.OS !== "web" && (
          <Pressable
            onPress={() => setShowManual(false)}
            className="items-center py-2"
          >
            <Text className="text-ink-soft text-sm">
              Camera gebruiken
            </Text>
          </Pressable>
        )}
      </SafeAreaView>
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
    return <View className="flex-1 bg-desk" />;
  }

  // ── Camera toestemming vragen ────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-desk items-center justify-center px-6">
        <View className="w-14 h-14 bg-brand/20 items-center justify-center mb-4">
          <Ionicons name="camera-outline" color="#5B8DEF" size={26} />
        </View>
        <Text className="text-ink text-xl font-bold text-center mb-2">
          Camera nodig
        </Text>
        <Text className="text-ink-soft text-sm text-center mb-6 leading-5">
          Om de QR-code te scannen heeft Lincin toegang tot je camera nodig.
        </Text>

        {error && (
          <FieldError tone="desk" style={{ marginBottom: 16 }}>{error}</FieldError>
        )}

        <Pressable
          onPress={requestPermission}
          className="bg-ink active:bg-ink-soft px-6 py-3.5 mb-3 w-full max-w-xs items-center"
        >
          <Text className="text-cream font-bold">Geef cameratoegang</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowManual(true)}
          className="py-2"
        >
          <Text className="text-ink-soft text-sm">Link handmatig invoeren</Text>
        </Pressable>
        <Pressable onPress={() => safeBack(router, "/(app)/profile")} className="py-2 mt-1">
          <Text className="text-ink-muted text-sm">Annuleren</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── QR-scanner ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-desk">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Terug"
          onPress={() => safeBack(router, "/(app)/profile")}
          className="w-9 h-9 bg-paper-soft items-center justify-center"
        >
          <Ionicons name="arrow-back" color={feed.ink} size={20} />
        </Pressable>
        <Text className="text-ink text-lg font-bold ml-3">Scan QR-code</Text>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => setShowManual(true)} className="py-2 px-3">
          <Text className="text-brand text-sm font-semibold">Link invoeren</Text>
        </Pressable>
      </View>

      {/* Camera */}
      <View style={{ flex: 1, position: "relative" }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onBarcodeScanned}
        />

        {/* Scanner-overlay */}
        <View
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View
            style={{
              width: 240,
              height: 240,
              borderWidth: 2,
              borderColor: creamOnDark.DEFAULT,
              borderRadius: 16,
              backgroundColor: "transparent",
            }}
          />
          <Text
            style={{
              color: creamOnDark.DEFAULT,
              fontSize: 14,
              marginTop: 16,
              fontWeight: "500",
            }}
          >
            Richt je camera op de QR-code
          </Text>
        </View>
      </View>

      {/* Foutmelding onderaan */}
      {error ? (
        <View className="px-6 pb-4">
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              padding: 12,
              borderWidth: FEED_BORDER,
              borderColor: flame,
            }}
          >
            <Ionicons name="warning-outline" color={flame} size={16} />
            <Text style={[feedType.body, { color: desk.ink, flex: 1 }]}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Waarschuwing sluiten"
              onPress={() => setError(null)}>
              <Ionicons name="close" color={desk.muted} size={16} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/**
 * Dit scherm leest `session!.user.id` en staat in de wortelstack, die niets
 * bewaakt — zie components/RequireSession.tsx voor waarom dat een wit scherm
 * opleverde in plaats van een inlogpagina.
 */
export default function DeviceReceiveScreen() {
  return (
    <RequireSession>
      <DeviceReceiveScreenBody />
    </RequireSession>
  );
}
