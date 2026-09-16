import type { ReactNode } from "react";
import {
  Pressable,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { color, line, subscribeTheme, themeSpec } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";

/**
 * De bouwstenen van v2 (README §Shape):
 *
 *   - kaders 1.5px inkt, overal; geen ronding behalve avatars en
 *     afspeelknoppen; geen schaduw
 *   - zijmarge 18, tussen kaarten 12, aanraakvlak ≥ 44
 *
 * Kleuren komen uit `color()` op het moment van tekenen: op web is dat
 * een variabele die met de stand meeschuift, op native de waarde van nu.
 *
 * De thema's (HANDOFF.md §Themes) zetten hier aan: magazine en modern
 * tekenen haarlijnen van 1px, modern rondt kaarten en tabs af op 10 en
 * zet de kaderlijn op papier-18%. `BORDER` en `RADIUS` zijn daarom een
 * `let`: een import is een levende verwijzing, en bij een wissel
 * hertekent elk scherm (zie `app/_layout.tsx`).
 */

export let BORDER = themeSpec().border;
/** Ronding op kaarten en de tabbalk. 0, behalve modern (10). */
export let RADIUS = themeSpec().radius;
export const GUTTER = 18;
export const GAP = 12;
export const CONTROL = 44;

subscribeTheme(() => {
  BORDER = themeSpec().border;
  RADIUS = themeSpec().radius;
});

/** De kaderlijn: inkt, of papier-18% in modern. Zie `line()` in theme.ts. */
export { line };

// ---------------------------------------------------------------
// Vlakken
// ---------------------------------------------------------------

export function Box({
  children,
  style,
  dashed = false,
  fill = "paper",
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  dashed?: boolean;
  /** `none` laat het blad erdoorheen; `ink` is het gevulde vlak. */
  fill?: "paper" | "paper2" | "ink" | "acid" | "none";
}) {
  return (
    <View
      style={[
        {
          borderWidth: dashed ? 1.5 : BORDER,
          borderColor: dashed ? color("ink") : line(),
          borderStyle: dashed ? "dashed" : "solid",
          backgroundColor:
            fill === "none" ? "transparent" : fill === "ink" ? color("ink") : fill === "acid" ? color("acid") : color(fill),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Een haarlijn: inkt op 20%. */
export const RULE = () => color("ink", "postRule");

// ---------------------------------------------------------------
// Letters
// ---------------------------------------------------------------

type Tone = "ink" | "dim" | "paper" | "red" | "inherit";

function toneColor(tone: Tone | undefined, explicit?: string): string | undefined {
  if (explicit) return explicit;
  switch (tone) {
    case "dim":
      return color("ink", "inkDim");
    case "paper":
      return color("paper");
    case "red":
      return color("red");
    case "inherit":
      return undefined;
    default:
      return color("ink");
  }
}

type TextProps = {
  children?: ReactNode;
  style?: StyleProp<TextStyle>;
  tone?: Tone;
  color?: string;
  numberOfLines?: number;
  onPress?: () => void;
  selectable?: boolean;
};

/** IBM Plex Mono — meta, labels, knoppen. */
export function Mono({
  variant = "meta",
  children,
  style,
  tone,
  color: c,
  ...rest
}: TextProps & { variant?: "meta" | "micro" | "tiny" | "action" | "monoBody" }) {
  return (
    <Text {...rest} style={[lincinType[variant], { color: toneColor(tone, c) }, style]}>
      {children}
    </Text>
  );
}

/** Instrument Serif. */
export function Serif({
  variant = "caption",
  children,
  style,
  tone,
  color: c,
  ...rest
}: TextProps & {
  variant?:
    | "caption"
    | "captionLarge"
    | "quote"
    | "quoteLarge"
    | "aside"
    | "asideSmall"
    | "row"
    | "name"
    | "eventTitle"
    | "pageTitle"
    | "pageTitleItalic"
    | "pageTitleLarge"
    | "ownName"
    | "ownNameItalic";
}) {
  return (
    <Text {...rest} style={[lincinType[variant], { color: toneColor(tone, c) }, style]}>
      {children}
    </Text>
  );
}

/** Archivo 900 smal, kapitaal. */
export function Head({
  variant = "cardTitle",
  children,
  style,
  tone,
  color: c,
  ...rest
}: TextProps & {
  variant?:
    | "cardTitle"
    | "band"
    | "bandSmall"
    | "postTitle"
    | "profileName"
    | "emptyTitle"
    | "numeral"
    | "numeralSmall"
    | "numeralTiny"
    | "track"
    | "mini"
    | "endTitle"
    | "masthead";
}) {
  return (
    <Text {...rest} style={[lincinType[variant], { color: toneColor(tone, c) }, style]}>
      {children}
    </Text>
  );
}

/** Archivo op leesmaat. */
export function Body({
  small = false,
  children,
  style,
  tone,
  color: c,
  ...rest
}: TextProps & { small?: boolean }) {
  return (
    <Text
      {...rest}
      style={[small ? lincinType.bodySmall : lincinType.body, { color: toneColor(tone, c) }, style]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------
// Knoppen
// ---------------------------------------------------------------

/**
 * De knop: Archivo 700 10px kapitaal. Gevuld is inkt met papier erop;
 * anders een kader op het blad.
 */
export function Btn({
  label,
  onPress,
  fill = false,
  height = CONTROL,
  style,
  bg,
  fg,
  flex,
  disabled,
  accessibilityLabel,
}: {
  label: string;
  onPress?: () => void;
  fill?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
  /** Eigen vlak en tekst, bv. inkt met zuur erop. */
  bg?: string;
  fg?: string;
  flex?: number;
  disabled?: boolean;
  accessibilityLabel?: string;
}) {
  const background = bg ?? (fill ? color("ink") : "transparent");
  const foreground = fg ?? (fill ? color("paper") : color("ink"));
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          height,
          paddingHorizontal: 12,
          borderWidth: BORDER,
          borderColor: bg ?? (fill ? color("ink") : line()),
          backgroundColor: background,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.8 : disabled ? 0.5 : 1,
          flex,
        },
        style,
      ]}
    >
      <Text style={[lincinType.button, { color: foreground }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Een vierkante knop met één teken erin: ◉, +, ☺, ↑, ×. */
export function SquareBtn({
  glyph,
  onPress,
  size = 32,
  fill = false,
  fontSize,
  badge = false,
  style,
  accessibilityLabel,
  borderless = false,
}: {
  glyph: string;
  onPress?: () => void;
  size?: number;
  fill?: boolean;
  fontSize?: number;
  /** Het rode vierkantje rechtsboven: er ligt iets. */
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  borderless?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderWidth: borderless ? 0 : BORDER,
          borderColor: fill ? color("ink") : line(),
          backgroundColor: fill ? color("ink") : "transparent",
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      <Text
        style={{
          ...lincinType.meta,
          fontSize: fontSize ?? Math.round(size * 0.45),
          lineHeight: fontSize ? fontSize + 2 : Math.round(size * 0.55),
          letterSpacing: 0,
          textTransform: "none",
          color: fill ? color("paper") : color("ink"),
        }}
      >
        {glyph}
      </Text>
      {badge ? (
        <View
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 9,
            height: 9,
            backgroundColor: color("red"),
            borderWidth: BORDER,
            borderColor: color("paper"),
          }}
        />
      ) : null}
    </Pressable>
  );
}

/** `← Terug`: de kleine gekaderde chip bovenaan een blad. */
export function BackChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        borderWidth: BORDER,
        borderColor: line(),
        paddingVertical: 6,
        paddingHorizontal: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text style={[lincinType.meta, { textTransform: "none", color: color("ink") }]}>{label}</Text>
    </Pressable>
  );
}

/** Een klein etiket: `GROEP`, `3 NIEUW`, `GELEZEN`. */
export function Chip({
  label,
  tone = "outline",
  inkColor,
}: {
  label: string;
  tone?: "outline" | "red" | "ink" | "acid" | "plain";
  /** Voor `outline`/`plain` op een gekleurde band: de inkt op die kleur. */
  inkColor?: string;
}) {
  const fg =
    tone === "red" ? "#F5F1E8" : tone === "ink" ? color("paper") : tone === "acid" ? "#141414" : inkColor ?? color("ink");
  const bg = tone === "red" ? color("red") : tone === "ink" ? color("ink") : tone === "acid" ? color("acid") : "transparent";
  return (
    <View
      style={{
        backgroundColor: bg,
        borderWidth: tone === "outline" ? BORDER : 0,
        borderColor: fg,
        paddingHorizontal: tone === "plain" ? 0 : 5,
        paddingVertical: 2,
        opacity: tone === "plain" ? 0.7 : 1,
      }}
    >
      <Text
        style={[
          tone === "red" ? lincinType.action : lincinType.tiny,
          { color: fg, letterSpacing: tone === "red" ? 0 : 0.54 },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

/** De gestreepte kaart met een cursieve zin: "Zeg iets tegen …", "Plan iets nieuws →". */
export function DashedCard({
  children,
  onPress,
  style,
  width,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  width?: number;
}) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width,
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: color("ink"),
          padding: 12,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Text style={[lincinType.aside, { color: color("ink", "inkDim"), textAlign: "center" }]}>{children}</Text>
    </Pressable>
  );
}

/** Een rond of vierkant vlak met een initiaal. */
export function Initial({
  letter,
  size = 30,
  bg,
  fg,
  round = true,
  border = true,
  fontSize,
  style,
}: {
  letter: string;
  size?: number;
  bg: string;
  fg: string;
  round?: boolean;
  border?: boolean;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: round ? size / 2 : 0,
          backgroundColor: bg,
          borderWidth: border ? BORDER : 0,
          borderColor: line(),
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={[
          lincinType.initial,
          { color: fg, fontSize: fontSize ?? Math.round(size * 0.43), lineHeight: (fontSize ?? Math.round(size * 0.43)) + 3 },
        ]}
      >
        {letter}
      </Text>
    </View>
  );
}

/** Eén cel van een keuzerij: `Per vriend | Op tijd`, `NL | EN | DE`. */
export function Segment<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ flexDirection: "row", borderWidth: BORDER, borderColor: line() }, style]}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              paddingVertical: 7,
              paddingHorizontal: 9,
              backgroundColor: on ? color("ink") : "transparent",
              borderLeftWidth: i ? BORDER : 0,
              borderLeftColor: line(),
            }}
          >
            <Text style={[lincinType.action, { color: on ? color("paper") : color("ink") }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Voor wie een Pressable met de kaderstijl nodig heeft. */
export type PressProps = PressableProps;

/**
 * Een regel die van onder naar boven leest, in een smalle kolom van
 * bekende hoogte: de kleurstrook naast het beeld op de bladzijde, de
 * "VERMELD"-strook in een gesprek.
 *
 * RN kent geen writing-mode; een View van `height` breed wordt 90°
 * gedraaid en in de kolom van `width` gelegd. De Text erin knipt af —
 * niet andersom, want react-native-web geeft een Text met numberOfLines
 * een maxWidth van 100% van zijn ouder.
 */
export function VerticalLabel({
  text,
  width,
  height,
  color: c,
  style,
}: {
  text: string;
  width: number;
  height: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const w = Math.max(0, height - 16);
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        width: w,
        height: 14,
        left: width / 2 - w / 2,
        top: height / 2 - 7,
        transform: [{ rotate: "-90deg" }],
      }}
    >
      <Text numberOfLines={1} style={[lincinType.micro, { lineHeight: 14, color: c ?? color("ink") }, style]}>
        {text}
      </Text>
    </View>
  );
}
