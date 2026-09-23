import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { createContext, useContext, type ReactNode } from "react";
import {
  ActivityIndicator,
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

import { LincinScreen, vfade, type Tab } from "@/components/lincin/Chrome";
import { MonoLink } from "@/components/lincin/desktop/Shell";
import { VerticalLabel } from "@/components/lincin/ui";
import { color, friendColor, ON_LIGHT, RASTER, useScheme, useThemeSpec, type Hue, type LincinTheme } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { useBackTarget } from "@/lib/nav";

/**
 * De bouwstenen van een subpagina — groep, nieuw event, QR, wachtwoord,
 * profiel bewerken — in de vorm van het thema (HANDOFF.md §Thema's).
 *
 * Die schermen stonden nog op `ScreenContainer` + `bg-desk`: het patroon
 * van vóór de drie thema's, met een eigen kop, eigen knoppen en eigen
 * letters. Je stapte uit een Lincin-scherm in een ander ontwerp. Deze
 * onderdelen tekenen hetzelfde in élk thema, alleen vorm en letter wisselen:
 *
 *   kleur     papier, kaders van 1.5 inkt, geen ronding; koppen in Archivo
 *             900 smal kapitaal, labels in Plex Mono; de hoofdknop zuurgeel.
 *   magazine  zoals de voorpagina op de telefoon: de kop als volvlaks
 *             kleurvlak met een rail, de rubrieken op het tweede papier met
 *             een rug van 5 in dezelfde kleur, naad 6; koppen in Instrument
 *             Serif, labels in Archivo 9–10 op .2em; pillen.
 *   modern    tegels van 18 op het halfdoorzichtige vlak, naad 6; Archivo
 *             400 en Plex Mono; pillen, de hoofdknop inkt.
 *
 * Gebruik:
 *
 *   <SubPage title="Fotodump" kicker="Groep" back="/chats" tab="chats">
 *     <Section label="Leden" action={{ label: "Voeg toe", onPress }}>
 *       <ListRow title="Noor" sub="@noor" left={<Avatar …/>} />
 *     </Section>
 *     <Button label="Verlaat groep" tone="danger" onPress={…} />
 *   </SubPage>
 */

const SEAM = RASTER.seam;

/** De kleur van de pagina: de kop en de ruggen van de rubrieken (magazine), het blad (kleur, modern). */
const HueCtx = createContext<Hue>("orange");
function usePageColor() {
  const scheme = useScheme();
  return friendColor(useContext(HueCtx), scheme);
}

function useTh(): LincinTheme {
  return useThemeSpec().id;
}

/** Mono (kleur, modern) of Archivo op .2em (magazine): het label van het thema. */
export function labelStyle(th: LincinTheme, size: number, c: string): TextStyle {
  return th === "magazine"
    ? { ...sans(500), fontSize: size, lineHeight: Math.round(size * 1.4), letterSpacing: size * 0.2, textTransform: "uppercase", color: c }
    : { ...mono(500), fontSize: size, lineHeight: Math.round(size * 1.4), letterSpacing: size * 0.12, textTransform: "uppercase", color: c };
}

/** De letter voor lopende tekst: serif in magazine, Archivo elders. */
export function bodyStyle(th: LincinTheme, size = 14, c = color("ink")): TextStyle {
  return th === "magazine"
    ? { ...serif(), fontSize: size + 3, lineHeight: Math.round((size + 3) * 1.35), color: c }
    : { ...sans(400), fontSize: size, lineHeight: Math.round(size * 1.45), color: c };
}

/** De kop van het thema op een maat. */
export function titleStyle(th: LincinTheme, size: number, c = color("ink")): TextStyle {
  if (th === "magazine") return { ...serif(), fontSize: size * 1.15, lineHeight: size * 1.1, letterSpacing: -size * 0.02, color: c };
  if (th === "modern") return { ...sans(400), fontSize: size, lineHeight: size * 1.08, letterSpacing: -size * 0.035, color: c };
  return { ...head(), fontSize: size, lineHeight: size * 0.92, color: c };
}

// ---------------------------------------------------------------
// De pagina
// ---------------------------------------------------------------

export function SubPage({
  title,
  kicker,
  sub,
  back,
  tab = "feed",
  right,
  keyboard = false,
  scroll = true,
  hue = "orange",
  children,
}: {
  /** De kop van de pagina. `null` laat hem weg (een scherm met een eigen kop). */
  title: string | null;
  /** Klein erboven: "Groep", "Nieuw event". */
  kicker?: string;
  /** Eén zin eronder. */
  sub?: string;
  /** Waarheen terug als er geen geschiedenis is. */
  back: string;
  /** Welk tabblad in de balk oplicht. */
  tab?: Tab;
  /** Iets rechts naast de kop: een knop, een teller. */
  right?: ReactNode;
  /** Een scherm met invoervelden: het toetsenbord schuift de pagina op. */
  keyboard?: boolean;
  /** Uit voor een scherm dat zelf scrollt (een lijst, de camera). */
  scroll?: boolean;
  /**
   * De kleur van de pagina: van de groep of de persoon (`hueFor(id)`), of
   * een vaste per soort scherm. Magazine zet de kop erin, kleur en modern
   * tinten het blad.
   */
  hue?: Hue;
  children: ReactNode;
}) {
  const th = useTh();
  const desktop = useIsDesktop();
  const router = useRouter();
  const backTarget = useBackTarget(router, back);
  const pad = th === "kleur" ? 18 : SEAM;
  const scheme = useScheme();
  const tint = friendColor(hue, scheme).fill;

  const headBlock =
    title !== null ? (
      <PageTitle title={title} kicker={kicker} sub={sub} right={right} />
    ) : null;

  const content = (
    <View style={{ padding: pad, paddingTop: th === "kleur" ? 8 : SEAM, gap: th === "kleur" ? 16 : SEAM }}>
      {headBlock}
      {children}
    </View>
  );

  const body = scroll ? (
    <ScrollView
      style={[{ flex: 1 }, vfade()]}
      contentContainerStyle={{ paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {content}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, minHeight: 0 }}>{content}</View>
  );

  return (
    <HueCtx.Provider value={hue}>
    <LincinScreen
      tab={tab}
      back={back}
      tint={tint}
      counter={kicker}
      // Op desktop staat de pagina als kolom in de rail, zonder telefoonkop:
      // daar draagt deze rij de weg terug.
      header={
        desktop ? (
          <View style={{ paddingHorizontal: pad, paddingBottom: 8 }}>
            <MonoLink label={`← ${backTarget.label}`} active onPress={backTarget.go} />
          </View>
        ) : undefined
      }
    >
      {keyboard ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </LincinScreen>
    </HueCtx.Provider>
  );
}

/** Kicker, titel, één zin — en rechts eventueel een knop. */
export function PageTitle({ title, kicker, sub, right }: { title: string; kicker?: string; sub?: string; right?: ReactNode }) {
  const th = useTh();
  const spec = useThemeSpec();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const inner = (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
      <View style={{ flex: 1, minWidth: 0, gap: th === "kleur" ? 8 : 10 }}>
        {kicker ? <Text style={labelStyle(th, th === "magazine" ? 9 : 10, dim)}>{kicker}</Text> : null}
        <Text style={titleStyle(th, 40, ink)}>{title}</Text>
        {sub ? (
          <Text style={th === "magazine" ? { ...serif(true), fontSize: 18, lineHeight: 24, color: dim } : { ...sans(400), fontSize: 14, lineHeight: 20, color: dim }}>{sub}</Text>
        ) : null}
      </View>
      {right}
    </View>
  );
  if (th === "kleur") {
    return <View style={{ paddingTop: 6, paddingBottom: 14, borderBottomWidth: spec.border, borderBottomColor: ink }}>{inner}</View>;
  }
  if (th === "magazine") return <MagazineTitle title={title} kicker={kicker} sub={sub} right={right} />;
  return <Panel style={{ padding: RASTER.tilePadLarge, paddingTop: 26 }}>{inner}</Panel>;
}

/**
 * Magazine: de kop als kleurvlak, zoals een spread op de voorpagina — een
 * verticale rail met de kicker, de titel groot in serif, het onderschrift
 * cursief, alles in de inkt die bij de kleur hoort.
 */
function MagazineTitle({ title, kicker, sub, right }: { title: string; kicker?: string; sub?: string; right?: ReactNode }) {
  const fc = usePageColor();
  return (
    <View style={{ backgroundColor: fc.fill, flexDirection: "row", minHeight: 190 }}>
      <View style={{ width: RASTER.rail, overflow: "hidden" }}>
        {kicker ? <VerticalLabel text={kicker} width={RASTER.rail} height={190} color={fc.ink} style={{ letterSpacing: 1.9, textTransform: "uppercase" }} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 22, paddingRight: 20, paddingLeft: 6, justifyContent: "flex-end", gap: 10 }}>
        <Text style={{ ...serif(), fontSize: 54, lineHeight: 50, letterSpacing: -1.6, color: fc.ink }}>{title}</Text>
        {sub ? <Text style={{ ...serif(true), fontSize: 18, lineHeight: 23, color: fc.ink, opacity: 0.86 }}>{sub}</Text> : null}
        {right ? <View style={{ flexDirection: "row", marginTop: 4 }}>{right}</View> : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------
// Vlakken
// ---------------------------------------------------------------

/** Het vlak van een blok: kader (kleur), tweede papier (magazine) of tegel (modern). */
export function Panel({ children, style }: { children?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const spec = useThemeSpec();
  const th = spec.id;
  const base: ViewStyle =
    th === "kleur"
      ? { borderWidth: spec.border, borderColor: color("ink"), backgroundColor: color("paper") }
      : th === "magazine"
        ? { backgroundColor: color("paper2") }
        : {
            borderRadius: RASTER.tileRadius,
            overflow: "hidden",
            backgroundColor: color("tile", "tileFill"),
            ...(Platform.OS === "web" ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as object) : null),
          };
  return <View style={[base, style]}>{children}</View>;
}

/**
 * Een rubriek: label (en eventueel een actie) boven een vlak. De kinderen
 * zijn meestal `ListRow`s; die zetten zelf hun scheidingslijn.
 */
export function Section({
  label,
  action,
  children,
  pad = false,
  style,
}: {
  label?: string;
  action?: { label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap };
  children: ReactNode;
  /** Binnenmarge voor losse inhoud (tekst, velden) in plaats van rijen. */
  pad?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const th = useTh();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const spine = usePageColor().fill;
  const head =
    label || action ? (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36, paddingHorizontal: th === "kleur" ? 0 : 12, paddingTop: th === "kleur" ? 0 : 6 }}>
        {label ? <Text style={labelStyle(th, th === "magazine" ? 9 : 10, th === "kleur" ? ink : dim)}>{label}</Text> : <View />}
        {action ? (
          <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36 }}>
            {action.icon ? <Ionicons name={action.icon} size={14} color={ink} /> : null}
            <Text style={[labelStyle(th, th === "magazine" ? 9.5 : 10, ink), { textDecorationLine: "underline" }]}>{action.label}</Text>
          </Pressable>
        ) : null}
      </View>
    ) : null;
  const inner = pad ? <View style={{ padding: th === "modern" ? RASTER.tilePad : 16, gap: 12 }}>{children}</View> : children;
  if (th === "kleur") {
    return (
      <View style={[{ gap: 8 }, style]}>
        {head}
        <Panel>{inner}</Panel>
      </View>
    );
  }
  // Magazine en modern: het label staat ín het vlak, bovenaan. Magazine
  // geeft het vlak een rug in de kleur van de pagina.
  return (
    <Panel style={[th === "magazine" ? { borderLeftWidth: 5, borderLeftColor: spine } : null, style]}>
      {head}
      {inner}
    </Panel>
  );
}

/**
 * Een rij in een lijst: links iets (avatar, icoon), een naam en een regel
 * eronder, rechts iets. Vaste hoogte, zodat een naam op twee regels de
 * rij niet hoger maakt dan zijn buur.
 */
export function ListRow({
  title,
  sub,
  left,
  right,
  badge,
  onPress,
  first = false,
  tone = "ink",
  accessibilityLabel,
}: {
  title: string;
  sub?: string;
  left?: ReactNode;
  right?: ReactNode;
  /** Een klein etiket naast de naam: "Jij", "Eigenaar". */
  badge?: string;
  onPress?: () => void;
  /** De eerste rij krijgt geen scheidingslijn boven zich. */
  first?: boolean;
  tone?: "ink" | "danger";
  accessibilityLabel?: string;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const c = tone === "danger" ? color("red") : color("ink");
  const dim = color("ink", "inkDim");
  const rule: ViewStyle = first
    ? {}
    : th === "kleur"
      ? { borderTopWidth: spec.border, borderTopColor: color("ink") }
      : th === "magazine"
        ? { borderTopWidth: 1, borderTopColor: color("ink", "postRule") }
        : { borderTopWidth: 1, borderStyle: "dashed", borderTopColor: color("ink", "dash") };
  const inner = (
    <>
      {left}
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text
            numberOfLines={1}
            style={[
              th === "magazine"
                ? { ...serif(), fontSize: 21, lineHeight: 25 }
                : th === "modern"
                  ? { ...sans(400), fontSize: 16, lineHeight: 20, letterSpacing: -0.3 }
                  : { ...head(), fontSize: 19, lineHeight: 20 },
              { color: c, flexShrink: 1 },
            ]}
          >
            {title}
          </Text>
          {badge ? <Badge label={badge} /> : null}
        </View>
        {sub ? (
          <Text numberOfLines={1} style={labelStyle(th, 9, dim)}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
    </>
  );
  const style: ViewStyle = {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: th === "magazine" ? 0 : 14,
    marginHorizontal: th === "magazine" ? 18 : 0,
    paddingVertical: 10,
    ...rule,
  };
  if (!onPress) return <View style={style}>{inner}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} onPress={onPress} style={({ pressed }) => [style, { opacity: pressed ? 0.7 : 1 }]}>
      {inner}
    </Pressable>
  );
}

/** Een klein etiket: kader in kleur, pil in magazine en modern. */
export function Badge({ label, tone = "outline" }: { label: string; tone?: "outline" | "ink" | "accent" }) {
  const spec = useThemeSpec();
  const th = spec.id;
  const ink = color("ink");
  const bg = tone === "ink" ? ink : tone === "accent" ? color("acid") : "transparent";
  const fg = tone === "ink" ? color("paper") : tone === "accent" ? (th === "kleur" ? ON_LIGHT : color("paper")) : ink;
  return (
    <View
      style={{
        paddingHorizontal: th === "kleur" ? 5 : 8,
        paddingVertical: 2,
        borderRadius: th === "kleur" ? 0 : 999,
        borderWidth: tone === "outline" ? (th === "kleur" ? spec.border : 1) : 0,
        borderColor: th === "kleur" ? ink : color("ink", "postRule"),
        backgroundColor: bg,
      }}
    >
      <Text style={labelStyle(th, 8.5, fg)}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------
// Knoppen
// ---------------------------------------------------------------

/**
 * De knop. `primary` is de hoofdactie (hoogstens één per scherm): zuurgeel
 * in kleur, inkt in magazine en modern. `danger` is rood op papier.
 */
export function Button({
  label,
  onPress,
  tone = "default",
  icon,
  disabled = false,
  busy = false,
  grow = false,
  small = false,
  style,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "default" | "danger" | "quiet";
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  busy?: boolean;
  grow?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const ink = color("ink");
  const round = th !== "kleur";
  const primary = tone === "primary";
  const bg = primary ? (th === "kleur" ? color("acid") : ink) : "transparent";
  const fg = primary ? (th === "kleur" ? ON_LIGHT : color("paper")) : tone === "danger" ? color("red") : ink;
  const border = primary
    ? th === "kleur"
      ? ink
      : "transparent"
    : tone === "quiet"
      ? "transparent"
      : tone === "danger"
        ? th === "kleur"
          ? color("red")
          : color("ink", "postRule")
        : th === "kleur"
          ? ink
          : color("ink", "postRule");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        {
          height: small ? 36 : 48,
          paddingHorizontal: small ? 14 : 20,
          borderRadius: round ? 999 : 0,
          borderWidth: th === "kleur" ? spec.border : 1,
          borderColor: border,
          backgroundColor: bg,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          flex: grow ? 1 : undefined,
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : icon ? <Ionicons name={icon} size={small ? 14 : 16} color={fg} /> : null}
      <Text numberOfLines={1} style={[labelStyle(th, small ? 9.5 : 10.5, fg), th === "kleur" ? { fontFamily: mono(600).fontFamily } : null]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Een rond (magazine, modern) of vierkant (kleur) knopje met één icoon. */
export function IconBtn({
  icon,
  label,
  onPress,
  tone = "default",
  size = 36,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "default" | "danger" | "ink";
  size?: number;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const c = tone === "danger" ? color("red") : tone === "ink" ? color("paper") : color("ink");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={Math.max(0, (44 - size) / 2)}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: th === "kleur" ? 0 : size / 2,
        borderWidth: tone === "ink" ? 0 : th === "kleur" ? spec.border : 1,
        borderColor: tone === "danger" && th === "kleur" ? color("red") : th === "kleur" ? color("ink") : color("ink", "postRule"),
        backgroundColor: tone === "ink" ? color("ink") : "transparent",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={Math.round(size * 0.45)} color={c} />
    </Pressable>
  );
}

// ---------------------------------------------------------------
// Invoer
// ---------------------------------------------------------------

/** Een label met een invoerveld eronder, in de vorm van het thema. */
export function Field({
  label,
  hint,
  error,
  style,
  ...input
}: TextInputProps & { label?: string; hint?: string; error?: string | null; style?: StyleProp<TextStyle> }) {
  const spec = useThemeSpec();
  const th = spec.id;
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={labelStyle(th, 9, dim)}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={dim}
        {...input}
        style={[
          {
            minHeight: 48,
            paddingHorizontal: 14,
            paddingVertical: input.multiline ? 12 : 0,
            borderRadius: th === "modern" ? 14 : 0,
            borderWidth: th === "kleur" ? spec.border : th === "magazine" ? 0 : 1,
            borderBottomWidth: th === "magazine" ? 1 : th === "kleur" ? spec.border : 1,
            borderColor: error ? color("red") : th === "kleur" ? ink : color("ink", "postRule"),
            backgroundColor: th === "kleur" ? color("paper") : th === "magazine" ? "transparent" : color("paper"),
            color: ink,
            textAlignVertical: input.multiline ? "top" : "center",
            ...(th === "magazine" ? { ...serif(), fontSize: 20, paddingHorizontal: 0 } : { ...sans(400), fontSize: 15 }),
          },
          Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
          style,
        ]}
      />
      {error ? <Text style={[labelStyle(th, 9, color("red")), { textTransform: "none", letterSpacing: 0.3 }]}>{error}</Text> : hint ? <Text style={[bodyStyle(th, 12, dim)]}>{hint}</Text> : null}
    </View>
  );
}

/** Een korte regel: uitleg, een fout, een bevestiging. */
export function Note({ children, tone = "dim", center = false }: { children: ReactNode; tone?: "dim" | "red" | "ink"; center?: boolean }) {
  const th = useTh();
  const c = tone === "red" ? color("red") : tone === "ink" ? color("ink") : color("ink", "inkDim");
  return (
    <Text
      style={[
        th === "magazine" ? { ...serif(true), fontSize: 15, lineHeight: 21 } : { ...sans(400), fontSize: 12.5, lineHeight: 18 },
        { color: c, textAlign: center ? "center" : "left", paddingHorizontal: th === "kleur" ? 0 : 12 },
      ]}
    >
      {children}
    </Text>
  );
}

/**
 * Een keuzerij van twee tot vier opties: vakken naast elkaar (kleur),
 * losse pillen (magazine, modern).
 */
export function Choice<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const ink = color("ink");
  return (
    <View
      style={{
        flexDirection: "row",
        gap: th === "kleur" ? 0 : SEAM,
        ...(th === "kleur" ? { borderWidth: spec.border, borderColor: ink } : null),
      }}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: 44,
              paddingHorizontal: 8,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: on ? ink : pressed ? color("ink", "postRule") : "transparent",
              borderRadius: th === "kleur" ? 0 : 999,
              borderWidth: th === "kleur" ? 0 : 1,
              borderColor: on ? ink : color("ink", "postRule"),
              ...(th === "kleur" && i > 0 ? { borderLeftWidth: spec.border, borderLeftColor: ink } : null),
            })}
          >
            <Text numberOfLines={1} style={labelStyle(th, 9.5, on ? color("paper") : ink)}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
