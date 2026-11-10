import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { Kaartje, type Regel } from "./Kaartje";
import { kaartjeTekst, letter, useCat } from "./stijl";

/**
 * De kop (ontwerp 3e): 56 px, links het kaartje van de pagina, rechts ✳
 * voor meldingen en + voor een nieuwe bijdrage. Een subpagina heeft links
 * een pijl terug (of een kruis), en rechts wat bij die pagina hoort.
 */
export function Kop({
  regels,
  links,
  onLinks,
  avatar,
  rechts,
  onMidden,
  middenLabel,
}: {
  regels: Regel[];
  /** `terug` (←) of `sluiten` (✕); zonder: een hoofdpagina met 12 px marge. */
  links?: "terug" | "sluiten";
  onLinks?: () => void;
  /** Een beeld van 36 tussen pijl en kaartje (een open gesprek). */
  avatar?: ReactNode;
  rechts?: ReactNode;
  /** Beeld en kaartje samen als één raakvlak (een open gesprek: naar de groep of het profiel). */
  onMidden?: () => void;
  middenLabel?: string;
}) {
  const c = useCat();
  const midden = (
    <>
      {avatar ? <View style={{ marginRight: 10 }}>{avatar}</View> : null}
      <Kaartje regels={regels} />
      <View style={{ flex: 1 }} />
    </>
  );
  return (
    <View testID="kop" style={{ height: 56, flexShrink: 0, flexDirection: "row", alignItems: "center", paddingLeft: links ? 0 : 12, backgroundColor: c.vlak }}>
      {links ? (
        <KopKnop label={links === "terug" ? "Terug" : "Sluiten"} onPress={onLinks}>
          <Text style={{ ...letter(400), fontSize: 22, color: c.inkt }}>{links === "terug" ? "←" : "✕"}</Text>
        </KopKnop>
      ) : null}
      {onMidden ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={middenLabel}
          onPress={onMidden}
          style={{ flex: 1, minWidth: 0, height: 56, flexDirection: "row", alignItems: "center" }}
        >
          {midden}
        </Pressable>
      ) : (
        midden
      )}
      {rechts}
    </View>
  );
}

/** Een vierkant raakvlak van 48 in de kop. */
export function KopKnop({ label, onPress, children }: { label: string; onPress?: () => void; children: ReactNode }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ width: 48, height: 48, flexShrink: 0, alignItems: "center", justifyContent: "center" }}
    >
      {children}
    </Pressable>
  );
}

/** ✳ voor meldingen, met een vierkantje in de accentkleur als er iets nieuws is. */
export function Meldingen({ nieuw, onPress }: { nieuw: number; onPress?: () => void }) {
  const c = useCat();
  return (
    <KopKnop label={nieuw > 0 ? `Meldingen, ${nieuw} nieuw` : "Meldingen"} onPress={onPress}>
      <Text style={{ ...letter(400), fontSize: 20, color: c.inkt }}>{"✳︎"}</Text>
      {nieuw > 0 ? <View style={{ position: "absolute", top: 11, right: 9, width: 7, height: 7, backgroundColor: c.accent }} /> : null}
    </KopKnop>
  );
}

/** + : een nieuwe bijdrage (26, licht), of iets toevoegen (22). */
export function Plus({ label = "Nieuwe bijdrage", klein = false, onPress }: { label?: string; klein?: boolean; onPress?: () => void }) {
  const c = useCat();
  return (
    <KopKnop label={label} onPress={onPress}>
      {/* Het + zit in Archivo 2 px onder het midden; zo staat het even hoog als ✳ ernaast. */}
      <Text style={{ ...letter(klein ? 400 : 200), fontSize: klein ? 22 : 26, color: c.inkt, transform: [{ translateY: -2 }] }}>+</Text>
    </KopKnop>
  );
}

/** ⋯ : het menu van de pagina. */
export function Meer({ onPress }: { onPress?: () => void }) {
  const c = useCat();
  return (
    <KopKnop label="Meer" onPress={onPress}>
      <Text style={{ ...letter(400), fontSize: 22, color: c.inkt }}>⋯</Text>
    </KopKnop>
  );
}

/** Een tekstknop van 44 hoog, onderstreept, in kaartjesletter ("Alles gelezen"). */
export function TekstKnop({ tekst, onPress, label }: { tekst: string; onPress?: () => void; label?: string }) {
  const c = useCat();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={{ height: 44, paddingHorizontal: 12, justifyContent: "center" }}>
      <Text style={[kaartjeTekst, { color: c.inkt, textDecorationLine: "underline", textUnderlineOffset: 3 } as object]}>{tekst}</Text>
    </Pressable>
  );
}
