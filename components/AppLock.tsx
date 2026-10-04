import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/lincin/SubPage";
import { authenticate, clearAppLock, useAppLock } from "@/lib/app-lock";
import { useAuth } from "@/lib/auth/provider";
import { color, useThemeSpec } from "@/lib/design/theme";
import { mono, sans, serif } from "@/lib/design/type";

/** Zo lang mag je weg zijn voor je opnieuw moet ontgrendelen. */
const GRACE_MS = 60_000;

/**
 * Het slot vóór de app (lib/app-lock.ts). Ligt over alles heen zolang je
 * niet ontgrendelde: bij het openen, en als je langer dan een minuut weg
 * was. Zolang de app op de achtergrond staat ligt er een blad over, zodat
 * de schermafdruk in de appkiezer geen gesprek toont.
 *
 * Alleen `background` telt als weg: de Face ID-vraag zelf maakt de app
 * even `inactive`, en daar mag het slot niet opnieuw op vallen.
 */
export function AppLock() {
  const { session, signOut } = useAuth();
  const { enabled, biometry } = useAppLock();
  const [locked, setLocked] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const awayAt = useRef<number | null>(null);
  const insets = useSafeAreaInsets();
  const modern = useThemeSpec().id === "modern";

  const unlock = useCallback(async () => {
    setBusy(true);
    const ok = await authenticate("Ontgrendel Lincin");
    setBusy(false);
    if (ok) setLocked(false);
  }, []);

  // Uit (of nog niet ingelogd): niets op slot. Aan: op slot tot ontgrendeld.
  useEffect(() => {
    if (enabled === false || !session) setLocked(false);
  }, [enabled, session]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "background") {
        awayAt.current = Date.now();
        setHidden(true);
      } else if (s === "active") {
        setHidden(false);
        if (awayAt.current && Date.now() - awayAt.current > GRACE_MS) setLocked(true);
        awayAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);

  const showLock = !!session && enabled === true && locked;

  // Meteen vragen zodra het slot verschijnt (en de app vooraan staat).
  useEffect(() => {
    if (showLock && !hidden && AppState.currentState === "active") void unlock();
  }, [showLock, hidden, unlock]);

  if (!session || enabled === false) return null;
  // Nog niet gelezen of op de achtergrond: alleen een leeg blad.
  if (enabled === null || (hidden && !showLock)) return <View style={[StyleSheet.absoluteFill, { backgroundColor: color("paper") }]} />;
  if (!showLock) return null;

  const label = biometry?.label ?? "ontgrendeling";
  return (
    <View
      accessibilityViewIsModal
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: color("paper"), paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: 28, justifyContent: "space-between" },
      ]}
    >
      <Text style={[mono(600), { fontSize: 11, letterSpacing: 2.2, textTransform: "uppercase", color: color("ink") }]}>Lincin</Text>
      <View style={{ gap: 14 }}>
        <Text accessibilityRole="header" style={[modern ? sans(400) : serif(), { fontSize: modern ? 40 : 52, lineHeight: modern ? 44 : 52, letterSpacing: modern ? -1.4 : -0.5, color: color("ink") }]}>
          Vergrendeld
        </Text>
        <Text style={[serif(true), { fontSize: 19, lineHeight: 24, color: color("ink", "inkDim") }]}>
          {`Ontgrendel met ${label} om verder te gaan.`}
        </Text>
      </View>
      <View style={{ gap: 14 }}>
        <Button label={`Ontgrendel met ${label}`} tone="primary" icon="lock-open-outline" busy={busy} onPress={unlock} />
        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            await clearAppLock();
            await signOut();
          }}
          hitSlop={8}
          style={{ alignSelf: "center", paddingVertical: 8 }}
        >
          <Text style={[mono(500), { fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", textDecorationLine: "underline", color: color("ink", "inkDim") }]}>
            Uitloggen
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
