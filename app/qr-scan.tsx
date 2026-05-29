import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenContainer } from "@/components/ScreenContainer";

/**
 * QR-scanner: scan de code van een andere gebruiker om naar diens profiel te gaan.
 * Verwacht een URL in het formaat: https://lincin.app/user/{username}
 * of de deep-link variant lincin://user/{username}.
 */
export default function QRScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanError, setScanError] = useState<string | null>(null);
  const scannedRef = useRef(false); // voorkom dubbele navigatie

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scannedRef.current) return;

    const username = extractUsername(data);
    if (!username) {
      setScanError("Geen geldige Lincin-code.");
      setTimeout(() => setScanError(null), 2000);
      return;
    }

    scannedRef.current = true;
    // Navigeer naar het gebruikersprofiel — daarvandaan kan je toevoegen.
    router.replace(`/user/${username}`);
  }

  // ── Permissie nog niet gevraagd ──────────────────────────────────────────
  if (!permission) {
    return <View className="flex-1 bg-shell" />;
  }

  // ── Permissie geweigerd ──────────────────────────────────────────────────
  if (!permission.granted) {
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
              QR-code scannen
            </Text>
          </View>
          <View className="flex-1 items-center justify-center px-8 gap-4">
            <Ionicons name="camera-outline" color="#F5E8D3" size={48} />
            <Text className="text-cream text-xl font-bold text-center">
              Camera-toegang vereist
            </Text>
            <Text className="text-cream-soft text-sm text-center leading-5">
              Lincin heeft toegang tot je camera nodig om QR-codes te scannen.
            </Text>
            <Pressable
              onPress={requestPermission}
              className="mt-2 bg-cream rounded-full px-6 py-3"
            >
              <Text className="text-ink font-semibold">Geef toegang</Text>
            </Pressable>
          </View>
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  // ── Camera actief ────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-black" edges={["top", "left", "right"]}>
      {/* Sluitknop over de camera */}
      <View className="absolute top-14 left-4 z-10">
        <Pressable
          onPress={() => router.back()}
          className="w-10 h-10 rounded-full bg-black/50 items-center justify-center"
        >
          <Ionicons name="close" color="#F5E8D3" size={22} />
        </Pressable>
      </View>

      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Richtlijn-overlay */}
      <View className="absolute inset-0 items-center justify-center pointer-events-none">
        {/* Verduisterd kader rondom de scanzone */}
        <View
          style={{
            width: 240,
            height: 240,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: "#F5E8D3",
            backgroundColor: "transparent",
          }}
        />
      </View>

      {/* Label onderaan */}
      <View className="absolute bottom-12 left-0 right-0 items-center px-6">
        {scanError ? (
          <View className="bg-red-800/90 rounded-full px-5 py-2">
            <Text className="text-white font-medium text-sm">{scanError}</Text>
          </View>
        ) : (
          <View className="bg-black/50 rounded-full px-5 py-2">
            <Text className="text-cream text-sm">
              Richt op de QR-code van een vriend
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

/** Haal de username op uit een lincin.app of deep-link URL. */
function extractUsername(raw: string): string | null {
  try {
    // https://lincin.app/user/janedoe  of  https://lincin.app/add/janedoe
    const url = new URL(raw);
    const parts = url.pathname.replace(/^\/+/, "").split("/");
    if ((parts[0] === "user" || parts[0] === "add") && parts[1]) {
      return decodeURIComponent(parts[1]).toLowerCase();
    }
  } catch {
    // deep-link: lincin://user/janedoe
    const match = raw.match(/^lincin:\/\/(?:user|add)\/([^/?#]+)/i);
    if (match) return decodeURIComponent(match[1]).toLowerCase();
  }
  return null;
}
