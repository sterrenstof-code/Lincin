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

import { useAuth } from "@/lib/auth/provider";
import { consumeTransferPackage } from "@/lib/crypto/transfer";

export default function DeviceReceiveScreen() {
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
      <SafeAreaView className="flex-1 bg-shell items-center justify-center gap-4">
        <ActivityIndicator color="#F5E8D3" size="large" />
        <Text className="text-ink-soft text-sm">Sleutels worden overgedragen…</Text>
      </SafeAreaView>
    );
  }

  // ── Handmatige invoer (desktop web of camera geweigerd) ─────────────────────
  if (showManual) {
    return (
      <SafeAreaView className="flex-1 bg-shell px-6 justify-center">
        <Pressable
          onPress={() => {
            if (Platform.OS !== "web") setShowManual(false);
            else router.back();
          }}
          className="flex-row items-center mb-6"
        >
          <Ionicons name="arrow-back" color="#8A7E6C" size={18} />
          <Text className="text-ink-soft text-sm ml-1">Terug</Text>
        </Pressable>

        <View className="w-12 h-12 rounded-full bg-brand/20 items-center justify-center mb-4">
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
          placeholderTextColor="#8A7E6C"
          autoCapitalize="none"
          autoCorrect={false}
          multiline={false}
          className="bg-paper-soft rounded-2xl px-4 py-3.5 text-ink text-xs font-mono mb-3"
          style={{
            borderWidth: 1,
            borderColor: manualInput ? "#5B8DEF" : "transparent",
          }}
        />

        {error && (
          <Text className="text-red-400 text-sm mb-3">{error}</Text>
        )}

        <Pressable
          onPress={onManualSubmit}
          disabled={!manualInput.trim()}
          className={`rounded-2xl py-3.5 items-center mb-3 ${
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

  // ── Camera toestemming vragen ────────────────────────────────────────────────
  if (!permission?.granted) {
    return (
      <SafeAreaView className="flex-1 bg-shell items-center justify-center px-6">
        <View className="w-14 h-14 rounded-full bg-brand/20 items-center justify-center mb-4">
          <Ionicons name="camera-outline" color="#5B8DEF" size={26} />
        </View>
        <Text className="text-ink text-xl font-bold text-center mb-2">
          Camera nodig
        </Text>
        <Text className="text-ink-soft text-sm text-center mb-6 leading-5">
          Om de QR-code te scannen heeft Lincin toegang tot je camera nodig.
        </Text>

        {error && (
          <Text className="text-red-400 text-sm mb-4 text-center">{error}</Text>
        )}

        <Pressable
          onPress={requestPermission}
          className="bg-ink active:bg-ink-soft rounded-2xl px-6 py-3.5 mb-3 w-full max-w-xs items-center"
        >
          <Text className="text-cream font-bold">Geef cameratoegang</Text>
        </Pressable>
        <Pressable
          onPress={() => setShowManual(true)}
          className="py-2"
        >
          <Text className="text-ink-soft text-sm">Link handmatig invoeren</Text>
        </Pressable>
        <Pressable onPress={() => router.back()} className="py-2 mt-1">
          <Text className="text-ink-muted text-sm">Annuleren</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // ── QR-scanner ──────────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-shell">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
        >
          <Ionicons name="arrow-back" color="#1A1714" size={20} />
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
              borderColor: "#F5E8D3",
              borderRadius: 16,
              backgroundColor: "transparent",
            }}
          />
          <Text
            style={{
              color: "#F5E8D3",
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
          <View className="bg-red-500/20 border border-red-500/40 rounded-2xl p-3 flex-row items-center gap-2">
            <Ionicons name="warning-outline" color="#FCA5A5" size={16} />
            <Text className="text-red-300 text-sm flex-1">{error}</Text>
            <Pressable onPress={() => setError(null)}>
              <Ionicons name="close" color="#FCA5A5" size={16} />
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
