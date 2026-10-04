import { forwardRef, type ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";

import { color, friendColor, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";

/**
 * De bouwstenen van aanmelden en de stappen erna (Login Voorbeeld 1a–1d).
 *
 * Magazine is het eindbeeld: papier, inkt, één rood vlak per scherm,
 * gelinieerde velden, geen afronding. Modern gebruikt dezelfde bouw met
 * zijn eigen tokens: pillen in plaats van rechte vlakken, koppen in Archivo
 * in plaats van Instrument Serif. Kleuren komen uit `color()`, dus licht en
 * donker volgen vanzelf.
 */

const isWeb = Platform.OS === "web";
const pointer = isWeb ? ({ cursor: "pointer" } as ViewStyle) : null;
/** Het label op het rode vlak: papier, ook in de donkere stand. */
const ON_RED = "#F7F4EE";
/** De kolom op een breed scherm: zo breed als het prototype (402) plus wat lucht. */
const COLUMN = 440;

function useAuthTokens() {
  const spec = useThemeSpec();
  const modern = spec.id === "modern";
  return {
    modern,
    ink: color("ink"),
    paper: color("paper"),
    dim: color("ink", "inkDim"),
    hair: color("ink", "postRule"),
    red: color("red"),
    radius: modern ? 999 : 0,
  };
}

// ---------------------------------------------------------------
// Pagina
// ---------------------------------------------------------------

/**
 * Een aanmeldscherm: papier van boven tot onder, op een breed scherm een
 * kolom van 440 in het midden. `fill` laat de inhoud de hoogte vullen (het
 * welkomscherm met zijn cover); anders scrolt hij.
 */
export function AuthPage({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  const insets = useSafeAreaInsets();
  const t = useAuthTokens();
  const column: ViewStyle = { width: "100%", maxWidth: COLUMN, alignSelf: "center", flexGrow: 1 };
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: t.paper }}
    >
      {fill ? (
        <View style={[column, { flex: 1, paddingTop: insets.top + 16, paddingBottom: insets.bottom }]}>{children}</View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom }}
        >
          <View style={column}>{children}</View>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

/** Bovenaan: een ronde terugknop van 34 in inkt, rechts het label van het scherm. */
export function AuthTop({ label, onBack }: { label: string; onBack?: () => void }) {
  const t = useAuthTokens();
  return (
    <View style={{ paddingTop: 8, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 44 }}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Terug"
          onPress={onBack}
          hitSlop={5}
          style={[{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.ink, alignItems: "center", justifyContent: "center" }, pointer]}
        >
          <Svg width={14} height={14} viewBox="0 0 16 16" fill="none">
            <Path d="M9.6 3.4 5 8l4.6 4.6" stroke={t.paper} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      ) : (
        <View />
      )}
      <Text style={[sans(500), { fontSize: 9, lineHeight: 12, letterSpacing: 9 * 0.22, textTransform: "uppercase", color: t.dim }]}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------
// Letters
// ---------------------------------------------------------------

/** LINCIN in Archivo 900, rood. */
export function AuthWordmark({ size }: { size: number }) {
  const t = useAuthTokens();
  return (
    <Text
      accessibilityRole="header"
      style={[
        sans(900),
        {
          fontSize: size,
          lineHeight: Math.round(size * (isWeb ? 0.8 : 0.96)),
          letterSpacing: size * (size > 60 ? -0.055 : -0.05),
          color: t.red,
        },
        isWeb ? ({ whiteSpace: "nowrap" } as TextStyle) : null,
      ]}
    >
      LINCIN
    </Text>
  );
}

/** Een kop: Instrument Serif italic in magazine, Archivo 400 in modern. */
export function AuthTitle({ children, size = 40, color: c, style }: { children: ReactNode; size?: number; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useAuthTokens();
  const s = t.modern ? Math.round(size * 0.85) : size;
  return (
    <Text
      accessibilityRole="header"
      style={[
        t.modern ? sans(400) : serif(true),
        { fontSize: s, lineHeight: Math.round(s * (t.modern ? 1.02 : 0.98)), letterSpacing: s * (t.modern ? -0.04 : -0.01), color: c ?? t.ink },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** De regel onder een kop: serif 17, gedimd. */
export function AuthSub({ children, color: c, style }: { children: ReactNode; color?: string; style?: StyleProp<TextStyle> }) {
  const t = useAuthTokens();
  return (
    <Text style={[t.modern ? sans(400) : serif(false), { fontSize: t.modern ? 15 : 17, lineHeight: t.modern ? 21 : 22, color: c ?? t.dim }, style]}>
      {children}
    </Text>
  );
}

/** Het kleine label: Archivo 500 of 700, kapitaal. */
export function AuthLabel({
  children,
  size = 10,
  weight = 500,
  ls = 0.1,
  color: c,
  underline = false,
  style,
}: {
  children: ReactNode;
  size?: number;
  weight?: 500 | 700;
  ls?: number;
  color?: string;
  underline?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  const t = useAuthTokens();
  return (
    <Text
      style={[
        sans(weight),
        { fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: size * ls, textTransform: "uppercase", color: c ?? t.dim },
        underline ? ({ textDecorationLine: "underline", textUnderlineOffset: 3 } as TextStyle) : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/** Een melding onder een formulier: rood bij een fout, anders inkt. */
export function AuthNotice({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "error" }) {
  const t = useAuthTokens();
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[t.modern ? sans(400) : serif(false), { fontSize: 16, lineHeight: 21, color: tone === "error" ? t.red : t.ink }]}
    >
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------
// Velden
// ---------------------------------------------------------------

/**
 * Een gelinieerd veld: label erboven, de waarde in serif 22, een lijn van
 * 1 inkt eronder. Geen kader.
 */
export const LinedField = forwardRef<TextInput, TextInputProps & { label: string; hint?: string }>(function LinedField(
  { label, hint, style, ...input },
  ref,
) {
  const t = useAuthTokens();
  return (
    <View style={{ gap: 6, borderBottomWidth: 1, borderBottomColor: t.ink, paddingBottom: 10 }}>
      <AuthLabel>{label}</AuthLabel>
      <TextInput
        ref={ref}
        placeholderTextColor={t.dim}
        accessibilityLabel={label}
        {...input}
        style={[
          t.modern ? sans(400) : serif(false),
          {
            fontSize: t.modern ? 19 : 22,
            lineHeight: t.modern ? 24 : 26,
            minHeight: 30,
            paddingVertical: 2,
            color: t.ink,
          },
          isWeb ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null,
          style,
        ]}
      />
      {hint ? <AuthLabel style={{ textTransform: "none", letterSpacing: 0.4 }}>{hint}</AuthLabel> : null}
    </View>
  );
});

// ---------------------------------------------------------------
// Knoppen
// ---------------------------------------------------------------

/** De primaire actie: een rood vlak van 52, label links, pijl rechts. */
export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  busy = false,
  height = 52,
  glyph = "→",
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  height?: number;
  glyph?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useAuthTokens();
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: off, busy }}
      onPress={onPress}
      disabled={off}
      style={(s) => [
        {
          height,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: t.red,
          borderRadius: t.radius,
          opacity: off ? 0.55 : s.pressed || (s as { hovered?: boolean }).hovered ? 0.88 : 1,
        },
        pointer,
        style,
      ]}
    >
      <Text style={[sans(700), { fontSize: 11, lineHeight: 15, letterSpacing: 11 * 0.12, textTransform: "uppercase", color: ON_RED }]}>{label}</Text>
      <Text style={[sans(400), { fontSize: 16, lineHeight: 20, color: ON_RED }]}>{busy ? "…" : glyph}</Text>
    </Pressable>
  );
}

/** De tweede actie: hetzelfde vlak, met alleen een lijn van 1 inkt. */
export function OutlineButton({ label, onPress, style }: { label: string; onPress: () => void; style?: StyleProp<ViewStyle> }) {
  const t = useAuthTokens();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(s) => [
        {
          height: 52,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          borderWidth: 1,
          borderColor: t.ink,
          borderRadius: t.radius,
          opacity: s.pressed ? 0.7 : 1,
        },
        pointer,
        style,
      ]}
    >
      <Text style={[sans(700), { fontSize: 11, lineHeight: 15, letterSpacing: 11 * 0.12, textTransform: "uppercase", color: t.ink }]}>{label}</Text>
      <Text style={[sans(400), { fontSize: 16, lineHeight: 20, color: t.ink }]}>→</Text>
    </Pressable>
  );
}

/** "of", tussen twee haarlijnen. */
export function OrRule({ label }: { label: string }) {
  const t = useAuthTokens();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: t.hair }} />
      <AuthLabel>{label}</AuthLabel>
      <View style={{ flex: 1, height: 1, backgroundColor: t.hair }} />
    </View>
  );
}

export type CellAction = { key: string; glyph: ReactNode; label: string; onPress: () => void };

/**
 * Een rij van 72 met een lijn van 1 inkt eromheen en gelijke cellen, elk
 * een teken en een label (Apple · Google · Magic link; Deel link · Scan
 * code · Contacten).
 */
export function CellRow({ cells, inverted = false }: { cells: CellAction[]; inverted?: boolean }) {
  const t = useAuthTokens();
  const fg = inverted ? t.paper : t.ink;
  const sub = inverted ? color("paper", "inkDim") : t.dim;
  return (
    <View style={{ flexDirection: "row", height: 72, borderWidth: 1, borderColor: inverted ? t.paper : t.ink, borderRadius: t.modern ? 18 : 0, overflow: "hidden" }}>
      {cells.map((c, i) => (
        <Pressable
          key={c.key}
          accessibilityRole="button"
          accessibilityLabel={c.label}
          onPress={c.onPress}
          style={(s) => [
            {
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderLeftWidth: i ? 1 : 0,
              borderLeftColor: inverted ? color("paper", "postRule") : t.hair,
              opacity: s.pressed ? 0.6 : 1,
            },
            pointer,
          ]}
        >
          {typeof c.glyph === "string" ? <Text style={[sans(400), { fontSize: 18, lineHeight: 20, color: fg }]}>{c.glyph}</Text> : c.glyph}
          <AuthLabel size={8} weight={700} ls={0.16} color={sub}>
            {c.label}
          </AuthLabel>
        </Pressable>
      ))}
    </View>
  );
}

/** Onderaan: een lijn van 2 inkt, links een serifregel, rechts een onderstreepte actie. */
export function FooterBar({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const t = useAuthTokens();
  return (
    <View style={{ borderTopWidth: 2, borderTopColor: t.ink, paddingTop: 18, paddingHorizontal: 24, paddingBottom: 30, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <AuthSub>{text}</AuthSub>
      <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10} style={pointer}>
        <Text style={[sans(700), { fontSize: 11, lineHeight: 15, letterSpacing: 11 * 0.12, textTransform: "uppercase", color: t.ink, textDecorationLine: "underline" }, { textUnderlineOffset: 4 } as TextStyle]}>
          {action}
        </Text>
      </Pressable>
    </View>
  );
}

/** Drie balkjes van 3: gedaan in inkt, nog te gaan als haarlijn. */
export function StepBars({ step, of = 3 }: { step: number; of?: number }) {
  const t = useAuthTokens();
  return (
    <View accessibilityLabel={`Stap ${step} van ${of}`} style={{ flexDirection: "row", gap: 6 }}>
      {Array.from({ length: of }, (_, i) => (
        <View key={i} style={{ flex: 1, height: 3, borderRadius: t.modern ? 2 : 0, backgroundColor: i < step ? t.ink : t.hair }} />
      ))}
    </View>
  );
}

/** De vijf vriendkleuren, voor "Jouw kleur". */
export const SIGNUP_HUES: Hue[] = ["orange", "blue", "ochre", "green", "red"];

/**
 * "Jouw kleur": een strook van 56 met vijf vlakken, gescheiden door een
 * lijn van 1 inkt. De gekozen kleur krijgt een papierrand van 2, 6 naar
 * binnen.
 */
export function HueStrip({ value, onChange, labels }: { value: Hue; onChange: (h: Hue) => void; labels: Record<Hue, string> }) {
  const t = useAuthTokens();
  const scheme = useScheme();
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", height: 56, borderWidth: 1, borderColor: t.ink, borderRadius: t.modern ? 18 : 0, overflow: "hidden" }}>
      {SIGNUP_HUES.map((h, i) => {
        const on = h === value;
        return (
          <Pressable
            key={h}
            accessibilityRole="radio"
            accessibilityLabel={labels[h]}
            accessibilityState={{ checked: on }}
            onPress={() => onChange(h)}
            style={[{ flex: 1, backgroundColor: friendColor(h, scheme).fill, borderLeftWidth: i ? 1 : 0, borderLeftColor: t.ink }, pointer]}
          >
            {on ? (
              <View
                style={{ position: "absolute", top: 6, left: 6, right: 6, bottom: 6, borderWidth: 2, borderColor: ON_RED, borderRadius: t.modern ? 12 : 0 }}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
