import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import type { ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type TextStyle,
} from "react-native";

import { carbon, page, rule, type, WIDE_BREAKPOINT } from "@/lib/design/type";

/**
 * Editorial-primitieven.
 *
 * De pagina is gebroken wit, de inkt is zwart, en inhoud wordt gescheiden
 * door haarlijnen die van rand tot rand lopen — niet door zwevende kaarten
 * met tussenruimte. Dat is het verschil tussen een affiche en een tijdlijn.
 *
 * Twee tonen, meer niet:
 *   page  — gebroken wit vlak, zwarte tekst   (de standaard)
 *   dark  — zwart vlak, gebroken witte tekst  (de omkering: één per scherm)
 */

export type Tone = "page" | "dark";

function textColor(tone: Tone, dim: boolean): string {
  if (tone === "dark") return dim ? "#8E8C86" : page.DEFAULT;
  return dim ? carbon.muted : carbon.soft;
}

// ---------------------------------------------------------------
// Breedte
// ---------------------------------------------------------------

/** Is dit een desktopbreedte? Bepaalt de tweekolomsstructuur. */
export function useWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}

/**
 * De pagina-kolom. Op telefoon volle breedte, op desktop een brede maat
 * zoals de referentie — géén 600px-telefoonkolom meer, want de hele
 * bedoeling van dit ontwerp is dat het op groot scherm ademt.
 */
export function Sheet({
  children,
  flex = false,
}: {
  children: ReactNode;
  /** Zet aan voor de scrollende inhoud — anders krijgt de lijst geen hoogte. */
  flex?: boolean;
}) {
  const wide = useWide();
  return (
    <View
      style={{
        width: "100%",
        maxWidth: wide ? 1240 : 720,
        alignSelf: "center",
        ...(flex ? { flex: 1 } : null),
      }}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------
// Lijnen
// ---------------------------------------------------------------

/** Echte 1px-lijn, ook op retina — geen border-class. */
export function Rule({
  tone = "page",
  strong = false,
}: {
  tone?: Tone;
  strong?: boolean;
}) {
  return (
    <View
      style={{
        height: strong ? 1 : StyleSheet.hairlineWidth,
        backgroundColor:
          tone === "dark" ? rule.onDark : strong ? rule.strong : rule.soft,
      }}
    />
  );
}

// ---------------------------------------------------------------
// Tekst
// ---------------------------------------------------------------

/**
 * De labellaag. Zinsvorm en 11px — rustiger dan de 9px-kapitalen van de
 * vorige versie. `caps` is er nog voor de zeldzame rubriek die schreeuwen mag.
 */
export function Meta({
  children,
  tone = "page",
  dim = false,
  caps = false,
  strong = false,
  style,
  numberOfLines,
}: {
  children: string;
  tone?: Tone;
  dim?: boolean;
  caps?: boolean;
  /** Volle inktkleur i.p.v. de zachte labelkleur. */
  strong?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const color = strong
    ? tone === "dark" ? page.DEFAULT : carbon.DEFAULT
    : textColor(tone, dim);
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[caps ? type.metaCaps : type.meta, { color }, style]}
    >
      {caps ? children.toUpperCase() : children}
    </Text>
  );
}

/**
 * De regel boven (of naast) elke vondst: SOORT · DELER · TIJD.
 * `stacked` zet ze onder elkaar — dat is de labelkolom op desktop.
 */
export function Kicker({
  parts,
  tone = "page",
  right,
  stacked = false,
}: {
  parts: (string | null | undefined)[];
  tone?: Tone;
  right?: ReactNode;
  stacked?: boolean;
}) {
  const visible = parts.filter((p): p is string => !!p && p.length > 0);

  if (stacked) {
    return (
      <View>
        {visible.map((part, i) => (
          <Meta key={`${part}-${i}`} tone={tone} dim={i > 0} strong={i === 0}>
            {part}
          </Meta>
        ))}
        {right ? <View className="mt-2">{right}</View> : null}
      </View>
    );
  }

  return (
    <View className="flex-row items-center">
      <View className="flex-1 flex-row items-center flex-wrap">
        {visible.map((part, i) => (
          <View key={`${part}-${i}`} className="flex-row items-center">
            {i > 0 && (
              <Meta tone={tone} dim style={{ marginHorizontal: 6 }}>
                ·
              </Meta>
            )}
            <Meta tone={tone} dim={i > 0} strong={i === 0}>
              {part}
            </Meta>
          </View>
        ))}
      </View>
      {right}
    </View>
  );
}

/** Rubriekkop: label links, zware lijn eronder. */
export function SectionHead({
  label,
  right,
  tone = "page",
}: {
  label: string;
  right?: string;
  tone?: Tone;
}) {
  return (
    <View>
      <View className="flex-row items-end justify-between px-6 pb-2.5 pt-9">
        <Meta tone={tone} strong>
          {label}
        </Meta>
        {right ? (
          <Meta tone={tone} dim>
            {right}
          </Meta>
        ) : null}
      </View>
      <Rule tone={tone} strong />
    </View>
  );
}

// ---------------------------------------------------------------
// Interactie
// ---------------------------------------------------------------

/** De diagonale pijl — "dit leidt ergens heen". */
export function Arrow({
  tone = "page",
  size = 16,
  dim = false,
}: {
  tone?: Tone;
  size?: number;
  dim?: boolean;
}) {
  return (
    <View style={{ transform: [{ rotate: "-45deg" }] }}>
      <Ionicons name="arrow-forward" size={size} color={textColor(tone, dim)} />
    </View>
  );
}

/** Volle-breedte klikbare regel met pijl rechts en haarlijn eronder. */
export function ArrowRow({
  title,
  meta,
  onPress,
  tone = "page",
  serif = true,
}: {
  title: string;
  meta?: string;
  onPress: () => void;
  tone?: Tone;
  serif?: boolean;
}) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        className={`flex-row items-center px-6 py-5 ${
          tone === "dark" ? "active:bg-carbon-soft" : "active:bg-page-alt"
        }`}
      >
        <View className="flex-1 pr-5">
          <Text
            style={[
              serif ? type.headlineSmall : type.body,
              { color: tone === "dark" ? page.DEFAULT : carbon.DEFAULT },
            ]}
          >
            {title}
          </Text>
          {meta ? (
            <View className="mt-1">
              <Meta tone={tone} dim>
                {meta}
              </Meta>
            </View>
          ) : null}
        </View>
        <Arrow tone={tone} dim />
      </Pressable>
      <Rule tone={tone} />
    </View>
  );
}

/**
 * Rechthoekige knop. Gevuld = primair, omlijnd = secundair.
 * Geen pillen — dat is het hele punt.
 */
export function BoxButton({
  label,
  onPress,
  tone = "page",
  filled = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  filled?: boolean;
  disabled?: boolean;
}) {
  const edge = tone === "dark" ? page.DEFAULT : carbon.DEFAULT;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: disabled ? carbon.muted : edge,
        backgroundColor: filled && !disabled ? edge : "transparent",
      }}
      className="px-4 py-2.5"
    >
      <Text
        style={[
          type.meta,
          {
            color: disabled
              ? carbon.muted
              : filled
              ? tone === "dark" ? carbon.DEFAULT : page.DEFAULT
              : edge,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Tags, gescheiden door een schuine streep. */
export function TagRow({ tags, tone = "page" }: { tags: string[]; tone?: Tone }) {
  if (!tags || tags.length === 0) return null;
  return (
    <View className="flex-row flex-wrap items-center mt-4">
      {tags.map((t, i) => (
        <View key={t} className="flex-row items-center">
          {i > 0 && (
            <Meta tone={tone} dim style={{ marginHorizontal: 6 }}>
              /
            </Meta>
          )}
          <Meta tone={tone} dim>
            {t}
          </Meta>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------
// Merk
// ---------------------------------------------------------------

/**
 * Het merk in de kop: het muntlogo plus het woordmerk in de display-serif.
 * Verder staat er niets bovenaan — geen scherm-titel, geen ondertitel.
 * De inhoud is de titel.
 */
export function Logo({ tone = "page" }: { tone?: Tone }) {
  return (
    <View className="flex-row items-center">
      <Image
        source={require("../assets/images/logo-master.png")}
        style={{ width: 24, height: 24 }}
        contentFit="contain"
        transition={0}
      />
      <Text
        style={[
          type.wordmark,
          {
            color: tone === "dark" ? page.DEFAULT : carbon.DEFAULT,
            marginLeft: 9,
          },
        ]}
      >
        Lincin
      </Text>
    </View>
  );
}
