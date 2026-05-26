/**
 * InstallBanner — web implementatie.
 *
 * Toont één keer een bottom sheet op iOS Safari wanneer de app nog NIET
 * als PWA is geïnstalleerd. Uitleg: tik op het deelknopje en kies
 * "Zet op beginscherm".
 *
 * Detectie:
 *   - iOS: userAgent bevat iPhone/iPad/iPod
 *   - Niet standalone: display-mode is NIET standalone EN navigator.standalone is falsy
 *
 * Eenmalig: na sluiten schrijven we een vlag naar localStorage zodat de
 * banner niet bij elke reload terugkomt.
 */
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

const STORAGE_KEY = "lincin_install_banner_dismissed";

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  // Chrome en Firefox op iOS identificeren zich ook als Safari-achtig maar
  // hebben hun eigen install-mechanismen. We checken of het puur Safari is
  // door de afwezigheid van "CriOS" en "FxiOS".
  const isPureSafari = !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
  return isIOS && isPureSafari;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    !!(window.navigator as any).standalone
  );
}

export function InstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Enkel tonen als: iOS Safari + niet al PWA + nog niet eerder gesloten
    if (!isIosSafari()) return;
    if (isStandalone()) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      /* private browsing blokkeert localStorage — skip */
      return;
    }
    // Kleine vertraging zodat de app eerst geladen is
    const t = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {}
  }

  if (!visible) return null;

  return (
    <View
      style={{
        position: "fixed" as any,
        bottom: 80, // boven de tab bar
        left: 12,
        right: 12,
        zIndex: 999,
      }}
    >
      <View
        className="bg-paper rounded-3xl px-5 py-4 shadow-xl"
        style={{ shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 16 }}
      >
        {/* Sluit-knop */}
        <Pressable
          onPress={dismiss}
          style={{ position: "absolute", top: 12, right: 14 }}
          hitSlop={8}
        >
          <Text className="text-ink-muted text-lg">✕</Text>
        </Pressable>

        {/* Titel */}
        <Text className="text-ink font-bold text-base mb-1 pr-6">
          Installeer Lincin
        </Text>

        {/* Uitleg */}
        <Text className="text-ink-soft text-sm leading-5 mb-3">
          Zet de app op je beginscherm voor de beste ervaring — inclusief
          meldingen.
        </Text>

        {/* Stap-voor-stap */}
        <View className="flex-row items-center mb-1">
          <Text className="text-base mr-2">1.</Text>
          <Text className="text-ink text-sm">
            Tik op{" "}
            <Text className="font-semibold">
              {/* iOS Share icon via Unicode */}
              ⎙ Delen
            </Text>{" "}
            onderin Safari
          </Text>
        </View>
        <View className="flex-row items-center">
          <Text className="text-base mr-2">2.</Text>
          <Text className="text-ink text-sm">
            Kies{" "}
            <Text className="font-semibold">'Zet op beginscherm'</Text>
          </Text>
        </View>
      </View>

      {/* Pijl naar beneden — wijst naar de Safari toolbar */}
      <View className="items-center mt-1">
        <Text style={{ fontSize: 20, color: "#C8B89A" }}>▼</Text>
      </View>
    </View>
  );
}
