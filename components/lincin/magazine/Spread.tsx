import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { color, RASTER } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";

import { VerticalLabel } from "../ui";
import { Black } from "./Omslag";

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
  height: fixedH,
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
  /** Een vaste hoogte in plaats van die van de pagina (desktop: een rooster met gelijke rijen). */
  height?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const side = railSide(index);
  const height = fixedH ?? spreadHeight(page, index);

  const railCol = (
    <View style={{ flexShrink: 0, width: RASTER.rail }}>
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
 * Het prototype draait hem met `writing-mode: vertical-rl` plus een halve
 * slag; dat leest van onder naar boven. React Native kent geen
 * writing-mode, dus draait hier één regel tekst een kwartslag.
 *
 * Dat draaien moet wél om het midden van de strook gebeuren. Stond er
 * eerst een `<Text>` met `width: height` in een strook van 26 breed: die
 * legt zich uit tot ver buiten de strook, draait om zíjn eigen midden, en
 * valt daarmee naast het zichtbare vlak — er bleef een stukje "№" over.
 * `VerticalLabel` (components/lincin/ui.tsx) zet hem absoluut neer en
 * verschuift hem eerst zo dat zijn midden ín de strook valt; die doet het
 * al goed voor de metakolom van een kaart, dus hij doet het hier ook.
 */
function RailText({ text, ink, height }: { text: string; ink: string; height: number }) {
  return (
    <View style={{ width: RASTER.rail, height, overflow: "hidden" }}>
      <VerticalLabel
        text={text}
        width={RASTER.rail}
        height={height}
        color={ink}
        style={{
          ...sans(500),
          fontSize: 8,
          lineHeight: 11,
          letterSpacing: 1.92, // .24em
          textTransform: "uppercase",
        }}
      />
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
 * De paginakop van een magazine-pagina: het kolofonregeltje, de titel in
 * rood Archivo 900 (de omslag, handoff 24 sep), en een cursieve ondertitel.
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
        // De omslag: de paginatitel in rood Archivo 900 (50, .84, −.055em).
        <Black size={50} f={0.84} ls={-0.055}>
          {title}
        </Black>
      ) : (
        title
      )}
      {sub ? (
        <Text style={{ ...serif(true), fontSize: 17, lineHeight: 23, color: color("ink", "inkDim") }}>{sub}</Text>
      ) : null}
    </View>
  );
}
