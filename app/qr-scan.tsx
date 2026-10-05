import Ionicons from "@expo/vector-icons/Ionicons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useRef, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, labelStyle, Note, Section, SubPage } from "@/components/lincin/SubPage";
import { looksLikeFriendCode, looksLikeFriendToken, normalizeFriendCode } from "@/lib/api/friend-codes";
import { color, ON_DARK, ON_LIGHT, useThemeSpec } from "@/lib/design/theme";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";

/**
 * QR-scanner: scan de code van een andere gebruiker om naar diens profiel te gaan.
 * Verwacht een URL in het formaat: https://lincin.app/user/{username}
 * of de deep-link variant lincin://user/{username}.
 *
 * De vraag om cameratoegang staat op een subpagina van het thema; de
 * camera zelf vult het scherm, met ronde knoppen en een rond kader (in
 * magazine en modern gelijk) en in de vaste kleuren voor op beeld (ON_DARK op een donkere sluier).
 */
export default function QRScanScreen() {
  usePageTitle("Scan een linc");
  const router = useRouter();
  const th = useThemeSpec().id;
  const [permission, requestPermission] = useCameraPermissions();
  const [scanError, setScanError] = useState<string | null>(null);
  const scannedRef = useRef(false); // voorkom dubbele navigatie

  function handleBarcodeScanned({ data }: { data: string }) {
    if (scannedRef.current) return;

    // Een vriendcode (0082): via het scherm dat hem inwisselt.
    const friendCode = extractFriendCode(data);
    if (friendCode) {
      scannedRef.current = true;
      router.replace(`/c/${encodeURIComponent(friendCode)}`);
      return;
    }

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
    return <View style={{ flex: 1, backgroundColor: color("paper") }} />;
  }

  // ── Permissie geweigerd ──────────────────────────────────────────────────
  if (!permission.granted) {
    return (
      <SubPage
        title="Camera-toegang vereist"
        kicker="QR-code scannen"
        back="/(app)/friends"
        tab="you"
        hue="blue"
      >
        <Section pad>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Ionicons name="camera-outline" color={color("ink")} size={32} />
            <View style={{ flex: 1 }}>
              <Note tone="ink">Lincin heeft toegang tot je camera nodig om QR-codes te scannen.</Note>
            </View>
          </View>
          <Button label="Geef toegang" tone="primary" icon="camera-outline" onPress={requestPermission} />
        </Section>
      </SubPage>
    );
  }

  // ── Camera actief ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: ON_LIGHT }} edges={["top", "left", "right"]}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Richtlijn-overlay: het kader waarin de code hoort */}
      <View style={{ pointerEvents: "none", position: "absolute", left: 0, top: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: 240,
            height: 240,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: ON_DARK,
          }}
        />
      </View>

      {/* Sluitknop over de camera */}
      <View style={{ position: "absolute", top: 56, left: 16, zIndex: 10 }}>
        <Pressable
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel="Scanner sluiten"
          onPress={() => safeBack(router, "/(app)/friends")}
          style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 22, overflow: "hidden", alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}
        >
          <Veil />
          <Ionicons name="close" color={ON_DARK} size={22} />
        </Pressable>
      </View>

      {/* Label onderaan */}
      <View style={{ position: "absolute", bottom: 48, left: 0, right: 0, alignItems: "center", paddingHorizontal: 24 }}>
        {scanError ? (
          <Chip fill={color("red")}>
            <Text style={labelStyle(th, 10, ON_DARK)}>{scanError}</Text>
          </Chip>
        ) : (
          <Chip>
            <Text style={labelStyle(th, 10, ON_DARK)}>Richt op de QR-code van een vriend</Text>
          </Chip>
        )}
      </View>
    </SafeAreaView>
  );
}

/** Een donkere sluier onder een knop of label op het camerabeeld. */
function Veil() {
  return <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: ON_LIGHT, opacity: 0.55 }} />;
}

/** Een label op het camerabeeld: op de sluier, of op een eigen vlak (de fout). */
function Chip({ fill, children }: { fill?: string; children: ReactNode }) {
  return (
    <View style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, overflow: "hidden", backgroundColor: fill }}>
      {fill ? null : <Veil />}
      {children}
    </View>
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

/** https://lincin.app/c/<token of jv-4821>, lincin://c/…, of de code zelf. */
function extractFriendCode(raw: string): string | null {
  const text = raw.trim();
  if (looksLikeFriendCode(text) || looksLikeFriendToken(text)) return normalizeFriendCode(text);
  const match = text.match(/(?:^lincin:\/\/|\/)c\/([a-z]{2}-\d{4}|[0-9a-f]{32})(?:[/?#]|$)/i);
  return match ? normalizeFriendCode(match[1]) : null;
}
