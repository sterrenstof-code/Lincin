import { useEffect, useRef, type ReactNode } from "react";
import { Pressable, Text, TextInput, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { kaartjeTekst, letter, NAAD, tekst, useCat } from "./stijl";

/**
 * Kleine onderdelen die op meer schermen terugkomen: de band met een naad
 * erboven, de knoppen, en de invoerregel onderaan.
 */

/**
 * Een band over de volle breedte met een naad van 2 erboven. `hoogte` is de
 * hoogte ónder de naad, zoals in het ontwerp (daar komt de naad bovenop).
 */
export function Band({
  children,
  hoogte,
  style,
  onPress,
  onLongPress,
  label,
  testID = "band",
}: {
  children: ReactNode;
  hoogte?: number;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  label?: string;
  testID?: string;
}) {
  const c = useCat();
  const vorm: ViewStyle = { flexShrink: 0, borderTopWidth: NAAD, borderTopColor: c.naad, ...(hoogte ? { height: hoogte + NAAD } : null) };
  if (onPress) {
    return (
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} onLongPress={onLongPress} style={[vorm, style]}>
        {children}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[vorm, style]}>
      {children}
    </View>
  );
}

/** Een knop in kaartjesletter: gevuld (inkt), omlijnd, of als vlak. */
export function Knop({
  tekst: t,
  onPress,
  soort = "vol",
  hoogte = 44,
  breedte,
  pijl = false,
  label,
  style,
  uit = false,
}: {
  tekst: string;
  onPress?: () => void;
  soort?: "vol" | "lijn" | "vlak";
  hoogte?: number;
  breedte?: number | "100%";
  pijl?: boolean;
  label?: string;
  style?: StyleProp<ViewStyle>;
  uit?: boolean;
}) {
  const c = useCat();
  const vol = soort === "vol";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: uit }}
      disabled={uit}
      onPress={onPress}
      style={[
        {
          height: hoogte,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          columnGap: 10,
          backgroundColor: vol ? c.inkt : soort === "vlak" ? c.vlak : undefined,
          ...(soort === "lijn" ? { borderWidth: 1, borderColor: c.inkt } : null),
          ...(breedte !== undefined ? { width: breedte } : null),
          opacity: uit ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Text style={[kaartjeTekst, { color: vol ? c.tekstOpInkt : c.inkt }]}>{t}</Text>
      {pijl ? <Text style={[kaartjeTekst, { color: vol ? c.tekstOpInkt : c.inkt }]}>→</Text> : null}
    </Pressable>
  );
}

/** Een onderstreepte tekstknop in kaartjesletter. */
export function Onderstreept({ tekst: t, onPress, style, label }: { tekst: string; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string }) {
  const c = useCat();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={[{ height: 44, justifyContent: "center" }, style]}>
      <Text style={[kaartjeTekst, { color: c.inkt, textDecorationLine: "underline", textUnderlineOffset: 3 } as TextStyle]}>{t}</Text>
    </Pressable>
  );
}

/** Onderstreepte kaartjestekst zonder eigen raakvlak (in een regel die zelf de knop is). */
export function OnderstreeptTekst({ tekst: t }: { tekst: string }) {
  const c = useCat();
  return <Text style={[kaartjeTekst, { color: c.inkt, textDecorationLine: "underline", textUnderlineOffset: 3 } as TextStyle]}>{t}</Text>;
}

/** Het invoerveld: 44 hoog, kader van 1 inkt. */
export function Veld({
  waarde,
  onWaarde,
  plaatshouder,
  onStuur,
  style,
  autoFocus,
  focus,
}: {
  waarde: string;
  onWaarde: (v: string) => void;
  plaatshouder: string;
  onStuur?: () => void;
  style?: StyleProp<TextStyle>;
  autoFocus?: boolean;
  /** Verandert dit getal, dan krijgt het veld de focus (Antwoord, Reageer). */
  focus?: number;
}) {
  const c = useCat();
  const ref = useRef<TextInput>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);
  return (
    <TextInput
      ref={ref}
      value={waarde}
      onChangeText={onWaarde}
      placeholder={plaatshouder}
      placeholderTextColor={c.tekstTweede}
      accessibilityLabel={plaatshouder}
      onSubmitEditing={onStuur}
      autoFocus={autoFocus}
      style={[
        {
          flex: 1,
          minWidth: 0,
          height: 44,
          borderWidth: 1,
          borderColor: c.inkt,
          backgroundColor: c.kaart,
          paddingHorizontal: 12,
          paddingVertical: 0,
          color: c.inkt,
          ...tekst(15),
          outlineStyle: "none",
        } as unknown as TextStyle,
        style,
      ]}
    />
  );
}

/**
 * De invoerregel onderaan (reactie, bericht): 64 hoog op een kaartvlak, het
 * veld en "Stuur". `voor` staat links (+ in een gesprek).
 */
export function Invoer({
  waarde,
  onWaarde,
  plaatshouder,
  onStuur,
  voor,
  bezig = false,
  autoFocus,
  focus,
}: {
  waarde: string;
  onWaarde: (v: string) => void;
  plaatshouder: string;
  onStuur: () => void;
  voor?: ReactNode;
  bezig?: boolean;
  autoFocus?: boolean;
  focus?: number;
}) {
  const c = useCat();
  return (
    <View style={{ height: 64, flexShrink: 0, flexDirection: "row", alignItems: "center", columnGap: 8, paddingLeft: voor ? 0 : 12, paddingRight: 12, backgroundColor: c.kaart }}>
      {voor}
      <Veld waarde={waarde} onWaarde={onWaarde} plaatshouder={plaatshouder} onStuur={onStuur} autoFocus={autoFocus} focus={focus} />
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: bezig || !waarde.trim() }}
        onPress={bezig || !waarde.trim() ? undefined : onStuur}
        style={{ height: 44, paddingHorizontal: 14, backgroundColor: c.inkt, justifyContent: "center" }}
      >
        <Text style={[kaartjeTekst, { color: c.tekstOpInkt }]}>Stuur</Text>
      </Pressable>
    </View>
  );
}

/** Een schakelaar: 48 × 24, recht, binnen een raakvlak van 48 × 44. */
export function Schakelaar({ aan, onWissel, label }: { aan: boolean; onWissel: (v: boolean) => void; label: string }) {
  const c = useCat();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: aan }}
      accessibilityLabel={label}
      onPress={() => onWissel(!aan)}
      style={{ width: 48, height: 44, justifyContent: "center" }}
    >
      <View
        style={{
          width: 48,
          height: 24,
          padding: 3,
          flexDirection: "row",
          justifyContent: aan ? "flex-end" : "flex-start",
          ...(aan ? { backgroundColor: c.inkt } : { borderWidth: 1, borderColor: c.inkt }),
        }}
      >
        <View style={{ width: 18, height: 18, backgroundColor: aan ? c.kaart : c.inkt }} />
      </View>
    </Pressable>
  );
}

/** Tekst in de lopende maat met een vet stuk vooraan ("**Noor** nodigt je uit"). */
export function MetNaam({ naam, rest, style }: { naam: string; rest: string; style?: StyleProp<TextStyle> }) {
  const c = useCat();
  return (
    <Text style={[tekst(15, 400, 1.35), { color: c.inkt }, style]}>
      <Text style={{ ...letter(600) }}>{naam}</Text>
      {rest}
    </Text>
  );
}
