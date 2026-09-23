import { useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { OMSLAG, color, pageTint, useScheme } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";

/**
 * De bouwstenen van de OMSLAG (handoff 24 sep, magazine-overzicht.dc.html).
 *
 * Magazine is sinds deze handoff op élke pagina een tijdschriftcover: het
 * rode woordmerk, rode titels in Archivo 900 naast Instrument Serif
 * cursief, labels in Archivo 700 kapitaal, lijnen van 2 tussen secties,
 * naden van 6 tussen blokken en een rug van 5 in de vriendkleur. Mobiel en
 * desktop lezen allebei deze onderdelen; alleen de maten verschillen.
 *
 * Kleuren komen uit het thema (`color("red")` is in magazine het rood van
 * de omslag), de vorm uit `OMSLAG` in `lib/design/theme.ts`.
 */

const isWeb = Platform.OS === "web";
const pointer = isWeb ? ({ cursor: "pointer" } as ViewStyle) : null;

/**
 * Een regelhoogte onder 1. Het prototype zet de grote Archivo op .76–.84;
 * op web kan dat, op native snijdt een regel onder de lettermaat de
 * bovenkant af. Daar houden we minstens .96 aan.
 */
export function lh(size: number, f: number): number {
  return Math.round(size * (isWeb ? f : Math.max(f, 0.96)));
}

/** De kleuren van de omslag, in de stand van nu. */
export function useOmslag() {
  const scheme = useScheme();
  return {
    scheme,
    red: color("red"),
    redPressed: OMSLAG.redPressed[scheme],
    ink: color("ink"),
    /** `--i2`: inkt op 80%. */
    soft: color("inkSoft"),
    /** `--dim`: inkt op 62%. */
    dim: color("ink", "inkDim"),
    /** `--rule`: de haarlijn bínnen een blok. */
    hair: color("ink", "postRule"),
    paper: color("paper"),
    paper2: color("paper2"),
    /** Een vriendblok met iets nieuws: zijn kleur op 12% over papier. */
    tint: (fill: string) => pageTint(fill, scheme, { light: OMSLAG.tintNew, dark: OMSLAG.tintNew }),
  };
}

// ---------------------------------------------------------------
// Letters
// ---------------------------------------------------------------

/** Archivo 900 op volle breedte: het woordmerk, titels, nummers, datums. */
export function Black({
  children,
  size,
  color: c,
  f = 0.78,
  ls = -0.05,
  upper = false,
  numberOfLines,
  style,
}: {
  children: ReactNode;
  size: number;
  color?: string;
  /** Regelhoogte als factor van de maat. */
  f?: number;
  /** Letterspatie in em. */
  ls?: number;
  upper?: boolean;
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        sans(900),
        { fontSize: size, lineHeight: lh(size, f), letterSpacing: size * ls, color: c ?? color("red") },
        upper ? { textTransform: "uppercase" } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** LINCIN, rood. */
export function Wordmark({ size, color: c, style }: { size: number; color?: string; style?: StyleProp<TextStyle> }) {
  return (
    // Geen `numberOfLines`: een groot woordmerk mag over de rand lopen (de
    // cover snijdt het af), zoals in het prototype — geen "LIN…".
    <Black size={size} color={c} f={0.78} ls={size > 60 ? -0.055 : -0.05} style={[{ flexShrink: 0 }, isWeb ? ({ whiteSpace: "nowrap" } as TextStyle) : null, style]}>
      LINCIN
    </Black>
  );
}

/** Het label: Archivo 700, kapitaal, .08–.1em. */
export function Label({
  children,
  size = 11,
  weight = 700,
  ls = 0.1,
  color: c,
  numberOfLines = 1,
  underline = false,
  style,
}: {
  children: ReactNode;
  size?: number;
  weight?: 400 | 500 | 600 | 700 | 800;
  ls?: number;
  color?: string;
  numberOfLines?: number;
  underline?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        sans(weight),
        { fontSize: size, lineHeight: Math.round(size * 1.3), letterSpacing: size * ls, textTransform: "uppercase", color: c ?? color("ink") },
        underline ? ({ textDecorationLine: "underline", textUnderlineOffset: 4 } as TextStyle) : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Instrument Serif, rechtop of cursief. */
export function Ser({
  children,
  size,
  italic = false,
  color: c,
  f = 1.15,
  ls = 0,
  numberOfLines,
  underline = false,
  style,
}: {
  children: ReactNode;
  size: number;
  italic?: boolean;
  color?: string;
  f?: number;
  /** Letterspatie in em. */
  ls?: number;
  numberOfLines?: number;
  underline?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        serif(italic),
        { fontSize: size, lineHeight: lh(size, f), letterSpacing: size * ls, color: c ?? color("ink") },
        underline ? ({ textDecorationLine: "underline", textUnderlineOffset: 5 } as TextStyle) : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * De paginatitel: een rood woord in Archivo 900 en een tweede in serif
 * cursief, op één basislijn — **Per** *vriend*, **Op** *tijd*.
 */
export function PageTitle({ a, b, size, serifSize, gap = 20 }: { a: string; b?: string; size: number; serifSize?: number; gap?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", gap, flexWrap: "wrap" }}>
      <Black size={size} f={0.76} numberOfLines={1}>
        {a}
      </Black>
      {b ? (
        <Ser size={serifSize ?? size * 0.74} italic f={0.8} numberOfLines={1}>
          {b}
        </Ser>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------
// Knoppen
// ---------------------------------------------------------------

/** De primaire actie: een rood vlak met een wit label. Nooit afgerond. */
export function RedButton({
  label,
  glyph = "+",
  onPress,
  height = 44,
  size = 12,
  weight = 700,
  gap = 22,
  accessibilityLabel,
  style,
}: {
  label?: string;
  glyph?: string | null;
  onPress: () => void;
  height?: number;
  size?: number;
  weight?: 700 | 800;
  gap?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const o = useOmslag();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={(s) => [
        {
          height,
          minWidth: height,
          paddingHorizontal: label ? 16 : 0,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: label ? "space-between" : "center",
          gap,
          backgroundColor: s.pressed || (s as { hovered?: boolean }).hovered ? o.redPressed : o.red,
        },
        pointer,
        style,
      ]}
    >
      {label ? (
        <Text numberOfLines={1} style={[sans(weight), { fontSize: size, lineHeight: size * 1.3, letterSpacing: size * 0.08, textTransform: "uppercase", color: OMSLAG.onImage }]}>
          {label}
        </Text>
      ) : null}
      {glyph ? <Text style={[sans(400), { fontSize: label ? 20 : 18, lineHeight: 22, color: OMSLAG.onImage }]}>{glyph}</Text> : null}
    </Pressable>
  );
}

/**
 * Het enige ronde: een kleine icoonknop met een lijn van 1 en een
 * serifglyph (✳, +). Raakvlak minstens 44.
 */
export function RoundGlyph({
  glyph,
  size = 36,
  fontSize,
  onPress,
  label,
  badge = false,
  tone,
  ringBg,
  rotate,
}: {
  glyph: string;
  size?: number;
  fontSize?: number;
  onPress: () => void;
  label: string;
  badge?: boolean;
  tone?: string;
  /** De ring om de rode stip: het vlak eronder. */
  ringBg?: string;
  /** Een draaiing in graden: de + van een ingeklapte vriend wordt × als hij open is. */
  rotate?: number;
}) {
  const o = useOmslag();
  const fg = tone ?? o.ink;
  const slop = Math.max(0, (44 - size) / 2);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={slop}
      style={({ pressed }) => [{ width: size, height: size, opacity: pressed ? 0.7 : 1 }, pointer]}
    >
      <View
        style={[
          { width: size, height: size, borderRadius: size / 2, borderWidth: 1, borderColor: fg, alignItems: "center", justifyContent: "center" },
          rotate !== undefined
            ? ({ transform: [{ rotate: `${rotate}deg` }], ...(isWeb ? { transitionProperty: "transform", transitionDuration: "300ms" } : null) } as ViewStyle)
            : null,
        ]}
      >
        <Text style={[serif(), { fontSize: fontSize ?? Math.round(size * 0.47), lineHeight: Math.round((fontSize ?? size * 0.47) * 1.15), color: fg }]}>{glyph}</Text>
      </View>
      {badge ? (
        <View
          style={{
            position: "absolute",
            top: 1,
            right: 1,
            width: 9,
            height: 9,
            borderRadius: 4.5,
            backgroundColor: o.red,
            borderWidth: 2,
            borderColor: ringBg ?? o.paper,
          }}
        />
      ) : null}
    </Pressable>
  );
}

/** Een tekstlink in serif, onderstreept: "Privé aan Noor", "Profiel →". */
export function SerifLink({
  children,
  onPress,
  size = 21,
  italic = false,
  color: c,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  size?: number;
  italic?: boolean;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={10} style={[pointer, style]}>
      <Ser size={size} italic={italic} underline color={c} numberOfLines={1}>
        {children}
      </Ser>
    </Pressable>
  );
}

/** Een label als link: "MARKEER ALS GELEZEN", onderstreept. */
export function LabelLink({ children, onPress, size = 11, color: c }: { children: ReactNode; onPress: () => void; size?: number; color?: string }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12} style={pointer}>
      <Label size={size} underline color={c}>
        {children}
      </Label>
    </Pressable>
  );
}

// ---------------------------------------------------------------
// Vorm
// ---------------------------------------------------------------

/** De lijn tussen twee secties: 2 px inkt. */
export function SectionRule({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: OMSLAG.rule, backgroundColor: color("ink") }, style]} />;
}

/** Het rode blokje "NIEUW". */
export function NewTag({ label, size = 10 }: { label: string; size?: number }) {
  return (
    <View style={{ backgroundColor: color("red"), paddingHorizontal: 6, paddingVertical: 3 }}>
      <Text style={[sans(700), { fontSize: size, lineHeight: size * 1.2, letterSpacing: size * 0.14, textTransform: "uppercase", color: OMSLAG.onImage }]}>
        {label}
      </Text>
    </View>
  );
}

/** De rode stip: iets is nieuw of ongelezen. */
export function RedDot({ size = 7 }: { size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color("red") }} />;
}

/**
 * De verticale rugtekst van een spread: `№ 04 · Lotte · 07:55`, van onder
 * naar boven. Meet zijn eigen hoogte, zodat hij ook werkt in een blok dat
 * met zijn inhoud meegroeit.
 */
export function Rail({
  text,
  color: c,
  width = 30,
  size = 9,
  weight = 600,
  ls = 0.24,
}: {
  text: string;
  color: string;
  width?: number;
  size?: number;
  weight?: 500 | 600;
  ls?: number;
}) {
  const [h, setH] = useState(0);
  const w = Math.max(0, h - 16);
  return (
    <View style={{ width, alignSelf: "stretch", overflow: "hidden" }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      {h ? (
        <View
          style={{
            pointerEvents: "none",
            position: "absolute",
            width: w,
            height: size + 6,
            left: width / 2 - w / 2,
            top: h / 2 - (size + 6) / 2,
            transform: [{ rotate: "-90deg" }],
            alignItems: "center",
          }}
        >
          <Text
            numberOfLines={1}
            style={[sans(weight), { fontSize: size, lineHeight: size + 6, letterSpacing: size * ls, textTransform: "uppercase", color: c }]}
          >
            {text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** De naad tussen blokken, als ruimte. */
export const SEAM = OMSLAG.seam;
/** De rug van een vriend. */
export const SPINE = OMSLAG.spine;

/**
 * Verticale tekst met een vaste lengte: "& VRIENDEN" naast het woordmerk
 * (`down`, van boven naar onder) en de rugtekst van de cover (`up`). Web
 * gebruikt `writing-mode` zoals het prototype; native draait één regel.
 */
export function VText({
  children,
  length,
  thickness,
  dir = "up",
  style,
}: {
  children: string;
  length: number;
  /** De breedte van de strook: de regelhoogte van de tekst. */
  thickness: number;
  dir?: "up" | "down";
  style: StyleProp<TextStyle>;
}) {
  if (isWeb) {
    return (
      <Text
        numberOfLines={1}
        style={[
          style,
          { maxHeight: length, overflow: "hidden", writingMode: "vertical-rl", transform: dir === "up" ? [{ rotate: "180deg" }] : undefined } as TextStyle,
        ]}
      >
        {children}
      </Text>
    );
  }
  return (
    <View style={{ width: thickness, height: length }}>
      <View
        style={{
          position: "absolute",
          width: length,
          height: thickness,
          left: thickness / 2 - length / 2,
          top: length / 2 - thickness / 2,
          transform: [{ rotate: dir === "up" ? "-90deg" : "90deg" }],
        }}
      >
        <Text numberOfLines={1} style={[style, { lineHeight: thickness }]}>
          {children}
        </Text>
      </View>
    </View>
  );
}

/** Een verloop over een foto; alleen op web, native legt een vlakke sluier. */
export function Scrim({ css, style }: { css: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { pointerEvents: "none", position: "absolute" },
        isWeb ? ({ backgroundImage: css } as ViewStyle) : { backgroundColor: "rgba(16,16,12,.28)" },
        style,
      ]}
    />
  );
}
