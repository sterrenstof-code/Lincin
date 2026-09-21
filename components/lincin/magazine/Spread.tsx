import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { color, RASTER } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";

/**
 * De poster-spread van magazine (WIJZIGINGEN-2.2 §2).
 *
 * Onder de omslag en het hero volgen alle pagina's één model: per item een
 * VOLVLAKS KLEURVLAK van de vriend, met een naad van 6 px eromheen en geen
 * ronding. Daarop:
 *
 *   - een verticale METARAIL van 26 px, Archivo 8 px op `.24em`, kapitaal,
 *     met `№ · auteur · tijd`. De rail wisselt per item van kant, zodat de
 *     bladspiegel ademt in plaats van een lijst te worden;
 *   - een SERIF-KOP op .98 regelafstand;
 *   - een CURSIEF ONDERSCHRIFT.
 *
 * De hoogte wisselt ook: elk derde item is het hoge. Per pagina andere
 * maten — zie `SPREAD_H`.
 *
 * DE INKT OP EEN KLEURVLAK is altijd de inkt die bíj die vriendkleur
 * hoort, nooit de globale inkt (2.2 §5, contrast). `friendColor()` geeft
 * ze als paar terug; geef `ink` altijd mee.
 */

/**
 * De twee hoogtes per pagina: de gewone en de hoge. Elk derde item krijgt
 * de hoge (`isTall`).
 */
export const SPREAD_H = {
  feed: [228, 300],
  events: [212, 258],
  chats: [146, 182],
  notes: [126, 158],
} as const;

/** Elk derde item is het hoge (index 2, 5, 8 …). */
export function isTall(index: number): boolean {
  return index % 3 === 2;
}

/** De richting wisselt per item: de rail staat links, dan rechts. */
export function railSide(index: number): "left" | "right" {
  return index % 2 ? "right" : "left";
}

/** De hoogte van een spread op een pagina, gegeven zijn plaats. */
export function spreadHeight(page: keyof typeof SPREAD_H, index: number): number {
  const [normal, tall] = SPREAD_H[page];
  return isTall(index) ? tall : normal;
}

/**
 * Eén spread.
 *
 * `index` bepaalt de kant van de rail en de hoogte; geef de echte plaats in
 * de lijst mee, niet een gefilterde. `media` is de beeldkolom rechts (de
 * feed, 138 px breed); laat hem weg op een pagina zonder beeld.
 */
export function Spread({
  index,
  page,
  fill,
  ink,
  rail,
  children,
  media,
  mediaWidth = 138,
  onPress,
  accessibilityLabel,
  style,
}: {
  index: number;
  page: keyof typeof SPREAD_H;
  /** Het kleurvlak van de vriend. */
  fill: string;
  /** De inkt die bij dat vlak hoort — nooit de globale inkt. */
  ink: string;
  /** Wat er in de verticale rail staat: `№ 07 · Noor · 22:41`. */
  rail: string;
  children: React.ReactNode;
  /** De beeldkolom; in de feed 138 px breed. */
  media?: React.ReactNode;
  mediaWidth?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const side = railSide(index);
  const height = spreadHeight(page, index);

  const railCol = (
    <View style={{ flexShrink: 0, width: RASTER.rail, alignItems: "center", justifyContent: "center" }}>
      <RailText text={rail} ink={ink} height={height} />
    </View>
  );
  const body = (
    <View style={{ flex: 1, minWidth: 0, paddingVertical: 18, paddingHorizontal: 14, justifyContent: "space-between", gap: 12 }}>
      {children}
    </View>
  );
  const mediaCol = media ? (
    <View style={{ flexShrink: 0, width: mediaWidth, overflow: "hidden" }}>{media}</View>
  ) : null;

  const inner = (
    <View style={{ flex: 1, flexDirection: "row" }}>
      {side === "left" ? (
        <>
          {railCol}
          {body}
          {mediaCol}
        </>
      ) : (
        <>
          {mediaCol}
          {body}
          {railCol}
        </>
      )}
    </View>
  );

  const base: ViewStyle = {
    marginHorizontal: RASTER.seam,
    marginBottom: RASTER.seam,
    minHeight: height,
    backgroundColor: fill,
  };

  if (!onPress) return <View style={[base, style]}>{inner}</View>;
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [base, { opacity: pressed ? 0.82 : 1 }, style]}
    >
      {inner}
    </Pressable>
  );
}

/**
 * De verticale rail.
 *
 * Op web draait `writing-mode: vertical-rl` met een halve slag, precies als
 * in het prototype. Native kent geen writing-mode; daar draait één regel
 * tekst 90° met een `rotate`, wat visueel hetzelfde oplevert.
 */
function RailText({ text, ink, height }: { text: string; ink: string; height: number }) {
  const type = {
    ...sans(500),
    fontSize: 8,
    lineHeight: 11,
    letterSpacing: 1.92, // .24em
    textTransform: "uppercase" as const,
    color: ink,
  };
  return (
    <View style={{ width: RASTER.rail, height, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <Text
        numberOfLines={1}
        style={[
          type,
          {
            width: height,
            textAlign: "center",
            transform: [{ rotate: "90deg" }],
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

/** De kop van een spread: Instrument Serif op .98 regelafstand. */
export function SpreadTitle({
  children,
  ink,
  size = 30,
  numberOfLines = 3,
}: {
  children: React.ReactNode;
  ink: string;
  size?: number;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={{ ...serif(), fontSize: size, lineHeight: size * 0.98, letterSpacing: -size * 0.02, color: ink }}
    >
      {children}
    </Text>
  );
}

/** Het onderschrift: cursieve serif op 14–15 px. */
export function SpreadCaption({
  children,
  ink,
  size = 14,
  numberOfLines = 3,
}: {
  children: React.ReactNode;
  ink: string;
  size?: number;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={{ ...serif(true), fontSize: size, lineHeight: size * 1.3, color: ink, opacity: 0.86 }}
    >
      {children}
    </Text>
  );
}

/** Het kleine kapitaal bovenin een spread: de soort, de afzender. */
export function SpreadKicker({ children, ink }: { children: React.ReactNode; ink: string }) {
  return (
    <Text
      numberOfLines={1}
      style={{
        ...sans(500),
        fontSize: 8,
        lineHeight: 11,
        letterSpacing: 1.92,
        textTransform: "uppercase",
        color: ink,
        opacity: 0.78,
      }}
    >
      {children}
    </Text>
  );
}

/**
 * De paginakop van een magazine-subpagina: het kolofonregeltje, de naam in
 * grote serif, en een cursieve ondertitel.
 */
export function MagazineHead({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: React.ReactNode;
  sub?: string;
}) {
  return (
    <View style={{ paddingTop: 14, paddingHorizontal: 24, paddingBottom: 20, gap: 8 }}>
      <Text
        style={{
          ...sans(500),
          fontSize: 8.5,
          lineHeight: 11,
          letterSpacing: 1.7, // .2em
          textTransform: "uppercase",
          color: color("ink", "inkDim"),
        }}
      >
        {kicker}
      </Text>
      {typeof title === "string" ? (
        <Text style={{ ...serif(), fontSize: 52, lineHeight: 46.8, letterSpacing: -1.56, color: color("ink") }}>
          {title}
        </Text>
      ) : (
        title
      )}
      {sub ? (
        <Text style={{ ...serif(true), fontSize: 17, lineHeight: 23, color: color("ink", "inkDim") }}>{sub}</Text>
      ) : null}
    </View>
  );
}
