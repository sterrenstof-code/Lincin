import { Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { color, RASTER } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";

import { NAV_CLEARANCE, vfade } from "../Chrome";

/**
 * Het bento-rooster van modern (WIJZIGINGEN-2.2 §1).
 *
 * Modern is rasterbased en niet kaartbased: twee kolommen, een naad van
 * 6 px, een buitenmarge van 6 px, tegels met een ronding van 18 px en een
 * binnenpadding van 18 tot 22. Een tegel vult één of twee kolommen.
 *
 * Elke pagina opent met een TITELTEGEL over twee kolommen: de kop in
 * Archivo op 30 px met strakke spatiëring, en rechts een teller in mono
 * van 9 px op `.16em`, kapitaal.
 *
 * Scheidingen bínnen een tegel zijn GESTIPPELD — nooit een harde rand.
 * Dat is wat modern van kleur onderscheidt: er staan geen kaders omheen,
 * alleen vlakken naast elkaar.
 *
 * Alle maten komen uit `RASTER` in `lib/design/theme.ts`, zodat een tegel
 * in de feed en een tegel in Instellingen dezelfde maat houden.
 */

/** De ruimte tussen twee tegels, en de marge om het hele rooster. */
export const SEAM = RASTER.seam;

/**
 * Het rooster zelf: een scroller met twee kolommen.
 *
 * De kolommen worden met `flexWrap` gelegd en niet met een echt
 * grid — react-native kent er geen. Een tegel geeft zelf aan of hij één of
 * twee kolommen vult (`span`), en `Tile` rekent dat om naar een breedte.
 *
 * Onderaan blijft `NAV_CLEARANCE` vrij: de zwevende pil van modern ligt
 * over de scroller heen.
 */
export function Bento({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={[{ flex: 1 }, vfade()]}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        padding: SEAM,
        paddingBottom: NAV_CLEARANCE,
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "flex-start",
        gap: SEAM,
      }}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Eén tegel. `span` is 1 (een halve kolom) of 2 (de volle breedte).
 *
 * Een halve tegel krijgt een basis van 46% met `flexGrow: 1`, zodat er
 * precies twee op een rij passen en de derde wrapt; een hele tegel staat
 * op `100%`. Zie de noot bij `base` hieronder.
 */
export function Tile({
  span = 1,
  pad = RASTER.tilePad,
  onPress,
  menu,
  accessibilityLabel,
  style,
  children,
}: {
  span?: 1 | 2;
  /** De binnenpadding. 18 gewoon, 22 voor een titeltegel; 0 om zelf te vullen. */
  pad?: number;
  onPress?: () => void;
  /** Lang drukken / rechtsklikken (zie ChatReadMenu). */
  menu?: object;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const base: ViewStyle = {
    /**
     * Twee halve tegels naast elkaar, samen 100% min de naad ertussen.
     *
     * De basis is 46% en niet 0: met `flexBasis: 0` heeft een tegel géén
     * breedte om op te wrappen, en dan komt élke halve tegel op dezelfde
     * regel te staan in plaats van twee per rij. Met 46% passen er precies
     * twee (2 × 46% + naad < 100%) en valt de derde naar de volgende regel;
     * `flexGrow` vult daarna de rest van de rij netjes op.
     */
    width: span === 2 ? "100%" : undefined,
    flexGrow: span === 2 ? 0 : 1,
    flexBasis: span === 2 ? undefined : "46%",
    minWidth: 0,
    borderRadius: RASTER.tileRadius,
    backgroundColor: color("tile", "tileFill"),
    padding: pad,
    overflow: "hidden",
  };
  if (!onPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      {...menu}
      style={({ pressed }) => [base, { opacity: pressed ? 0.82 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}

/**
 * De titeltegel waar elke modern-pagina mee opent: twee kolommen breed,
 * de kop links op 30 px, de teller rechts in mono.
 *
 * De feed gebruikt hem met een grotere kop (34) en twee regels teller;
 * vandaar dat `size` en `meta` mee kunnen.
 */
export function TitleTile({
  title,
  meta,
  size = 30,
  align = "flex-end",
  children,
}: {
  title: React.ReactNode;
  /** Rechts, mono 9px kapitaal. Eén of meer regels. */
  meta?: React.ReactNode;
  size?: number;
  align?: "flex-end" | "center";
  /** In plaats van de teller: iets anders rechts, zoals een avatar. */
  children?: React.ReactNode;
}) {
  return (
    <Tile span={2} pad={0} style={{ paddingTop: 22, paddingHorizontal: 20, paddingBottom: 26 }}>
      <View style={{ flexDirection: "row", alignItems: align, justifyContent: "space-between", gap: 16 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          {typeof title === "string" ? (
            <Text style={{ ...sans(400), fontSize: size, lineHeight: size * 1.02, letterSpacing: -size * 0.03, color: color("ink") }}>
              {title}
            </Text>
          ) : (
            title
          )}
        </View>
        {children ??
          (meta ? (
            <View style={{ flexShrink: 0, alignItems: "flex-end" }}>
              {typeof meta === "string" ? <Counter>{meta}</Counter> : meta}
            </View>
          ) : null)}
      </View>
    </Tile>
  );
}

/** De teller rechts in een titeltegel: mono 9px, `.16em`, kapitaal, gedempt. */
export function Counter({ children, align = "right" }: { children: React.ReactNode; align?: "right" | "left" }) {
  return (
    <Text
      style={{
        ...mono(500),
        fontSize: 9,
        lineHeight: 14,
        letterSpacing: 1.44, // .16em
        textTransform: "uppercase",
        color: color("ink", "inkDim"),
        textAlign: align,
      }}
    >
      {children}
    </Text>
  );
}

/** Het kleine mono-label bínnen een tegel: 8,5px op `.16em`. */
export function TileMeta({ children, numberOfLines }: { children: React.ReactNode; numberOfLines?: number }) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={{
        ...mono(500),
        fontSize: 8.5,
        lineHeight: 12,
        letterSpacing: 1.36, // .16em
        textTransform: "uppercase",
        color: color("ink", "inkDim"),
      }}
    >
      {children}
    </Text>
  );
}

/** De kop bínnen een tegel: Archivo 500, strak gespatieerd. */
export function TileTitle({
  children,
  size = 14,
  numberOfLines = 2,
}: {
  children: React.ReactNode;
  size?: number;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={{
        ...sans(500),
        fontSize: size,
        lineHeight: size * 1.2,
        letterSpacing: -size * 0.01,
        color: color("ink"),
      }}
    >
      {children}
    </Text>
  );
}

/**
 * Een gestippelde scheiding bínnen een tegel — nooit een harde rand
 * (2.2 §1). In het prototype:
 *
 *   border-top: 1px dashed color-mix(in oklch, var(--i) 26%, transparent)
 */
export function DashRule({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        {
          borderTopWidth: 1,
          borderStyle: "dashed",
          borderTopColor: color("ink", "dash"),
        },
        style,
      ]}
    />
  );
}

/**
 * Een rij over de volle breedte: een gekleurd vierkantje met een initiaal,
 * dan titel en meta, en rechts een pijl of een teller. Gesprekken,
 * meldingen en de langere feed-items delen hem.
 */
export function BentoRow({
  fill,
  ink,
  initial,
  title,
  meta,
  right,
  onPress,
  accessibilityLabel,
  minHeight = 76,
}: {
  /** Het vlakje links; laat weg voor een rij zonder. */
  fill?: string;
  ink?: string;
  initial?: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  minHeight?: number;
}) {
  return (
    <Tile
      span={2}
      pad={14}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      style={{ flexDirection: "row", alignItems: "center", gap: 16, minHeight }}
    >
      {fill ? (
        <View
          style={{
            flexShrink: 0,
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: fill,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ ...sans(500), fontSize: 17, lineHeight: 20, color: ink ?? color("paper") }}>{initial}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
        {title}
        {meta}
      </View>
      {right}
    </Tile>
  );
}

/**
 * De gestippelde tegel onderaan een lijst: "plan iets nieuws →",
 * "nieuwe groep →". Geen vulling, alleen een gestippelde rand — net als de
 * scheidingen bínnen een tegel is een harde rand hier verkeerd.
 */
export function DashedTile({
  label,
  onPress,
  span = 2,
}: {
  label: string;
  onPress: () => void;
  span?: 1 | 2;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: span === 2 ? "100%" : undefined,
        flexGrow: span === 2 ? 0 : 1,
        flexBasis: span === 2 ? undefined : "46%",
        minWidth: 0,
        minHeight: 44,
        borderRadius: RASTER.tileRadius,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: color("ink", "dash"),
        paddingVertical: 22,
        paddingHorizontal: 20,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          ...mono(500),
          fontSize: 10,
          lineHeight: 13,
          letterSpacing: 1.6,
          textTransform: "uppercase",
          color: color("ink", "inkDim"),
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
