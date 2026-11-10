import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { kaartjeTekst, tekst, useCat } from "./stijl";
import { Linc, type Beeld } from "./Voorwerp";

/**
 * Een blad dat van onderen over het scherm schuift, in de vorm van het menu
 * bij een bijdrage (ontwerp 16): een dimlaag, een kaart met bovenaan een
 * kaartjesregel, de regels met een naad van het vlak ertussen, en onderaan
 * Annuleer.
 */
export function Blad({ open, sluit, kop, children }: { open: boolean; sluit: () => void; kop: string; children: ReactNode }) {
  const c = useCat();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={sluit}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable accessibilityLabel="Sluiten" onPress={sluit} style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: c.dimlaag }} />
        <View accessibilityRole="menu" accessibilityLabel={kop} style={{ width: "100%", maxWidth: 520, maxHeight: "86%", alignSelf: "center", backgroundColor: c.kaart, paddingBottom: insets.bottom }}>
          <View style={{ height: 44, justifyContent: "center", paddingHorizontal: 16 }}>
            <Text style={[kaartjeTekst, { color: c.label }]}>{kop}</Text>
          </View>
          <ScrollView style={{ flexGrow: 0 }}>{children}</ScrollView>
          <Pressable accessibilityRole="button" onPress={sluit} style={{ height: 60 + 2, alignItems: "center", justifyContent: "center", borderTopWidth: 2, borderTopColor: c.vlak }}>
            <Text style={[kaartjeTekst, { color: c.inkt }]}>Annuleer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/** Een regel in een blad: een tekst, eventueel een tweede regel en een linc ervoor. */
export function BladRegel({
  label,
  sub,
  linc,
  gevaar = false,
  onPress,
  rechts,
}: {
  label: string;
  sub?: string;
  linc?: { beeld?: Beeld; kleur?: string | null; initiaal: string };
  gevaar?: boolean;
  onPress?: () => void;
  rechts?: ReactNode;
}) {
  const c = useCat();
  const inhoud = (
    <>
      {linc ? <Linc maat={36} letterMaat={12} {...linc} /> : null}
      <View style={{ flex: 1, minWidth: 0, rowGap: 2 }}>
        <Text numberOfLines={1} style={[tekst(16), { color: gevaar ? c.gevaar : c.inkt }]}>
          {label}
        </Text>
        {sub ? (
          <Text numberOfLines={1} style={[kaartjeTekst, { color: c.label }]}>
            {sub}
          </Text>
        ) : null}
      </View>
      {rechts}
    </>
  );
  const vorm = { minHeight: 56 + 1, flexDirection: "row" as const, alignItems: "center" as const, columnGap: 12, paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: c.vlak };
  return onPress ? (
    <Pressable accessibilityRole="menuitem" accessibilityLabel={sub ? `${label}, ${sub}` : label} onPress={onPress} style={vorm}>
      {inhoud}
    </Pressable>
  ) : (
    <View style={vorm}>{inhoud}</View>
  );
}

/** Lopende tekst in een blad: een uitleg onder de kop. */
export function BladTekst({ tekst: t }: { tekst: string }) {
  const c = useCat();
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      <Text style={[tekst(14, 400, 1.35), { color: c.tekstTweede }]}>{t}</Text>
    </View>
  );
}
