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

import {
  carbon,
  feed,
  FEED_BORDER,
  feedType,
  flameDeep,
  page,
  rule,
  type,
  WIDE_BREAKPOINT,
} from "@/lib/design/type";

/**
 * Editorial-primitieven.
 *
 * De pagina is gebroken wit, de inkt is zwart, en inhoud wordt gescheiden
 * door haarlijnen die van rand tot rand lopen — niet door zwevende kaarten
 * met tussenruimte. Dat is het verschil tussen een affiche en een tijdlijn.
 *
 * Twee tonen dragen het affiche-systeem:
 *   page  — gebroken wit vlak, zwarte tekst   (de standaard)
 *   dark  — zwart vlak, gebroken witte tekst  (de omkering: één per scherm)
 *
 * Daar staan twee tonen naast die enkel het feed-v3-scherm bedienen:
 *   feed  — inkt op het lavendel paginavlak (`feed-lav`)
 *   post  — `feed-text` op een post-oppervlak (`feed-post`)
 *
 * Bestaande aanroepers noemen `tone` niet en houden dus `page` — de twee
 * nieuwe tonen veranderen niets aan chat, vrienden, profiel, events of auth.
 */

export type Tone = "page" | "dark" | "feed" | "post";

function textColor(tone: Tone, dim: boolean): string {
  if (tone === "dark") return dim ? feed.inkDim : page.DEFAULT;
  if (tone === "feed") return dim ? feed.inkDim : feed.ink;
  if (tone === "post") return dim ? feed.textDim : feed.text;
  return dim ? carbon.muted : carbon.soft;
}

/** De volle tekstkleur van een toon — voor `strong` en voor kaders. */
function edgeColor(tone: Tone): string {
  if (tone === "dark") return page.DEFAULT;
  if (tone === "feed") return feed.ink;
  if (tone === "post") return feed.text;
  return carbon.DEFAULT;
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
        // 1180 = 210 etiketkolom + ~970 inhoud. Precies vol, zodat er rechts
        // geen dode zone tussen de inhoud en het einde van de haarlijn valt.
        maxWidth: wide ? 1180 : 720,
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
  const backgroundColor =
    tone === "dark" ? rule.onDark
    : tone === "post" ? feed.postRule
    : tone === "feed" ? (strong ? feed.ink : "rgba(11,10,12,0.25)")
    : strong ? rule.strong
    : rule.soft;

  return (
    <View
      style={{
        // De feed-tonen tekenen een échte 1.5px-lijn: dit systeem leest als
        // een gedrukt raster met kaders, niet als losse haarlijnen.
        height:
          tone === "feed" && strong ? 1.5
          : strong ? 1
          : StyleSheet.hairlineWidth,
        backgroundColor,
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
  const color = strong ? edgeColor(tone) : textColor(tone, dim);
  // De feed-tonen zetten in Inter, de affiche-tonen in de bestaande grotesk.
  const base =
    tone === "feed" || tone === "post"
      ? caps ? feedType.kicker : feedType.label
      : caps ? type.metaCaps : type.meta;
  return (
    <Text numberOfLines={numberOfLines} style={[base, { color }, style]}>
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
 *
 * De feed-tonen gebruiken dezelfde component met andere kleuren en een
 * 1.5px-kader in plaats van een haarlijn; er is bewust geen tweede
 * knopcomponent voor het feed-scherm.
 */
export function BoxButton({
  label,
  onPress,
  tone = "page",
  filled = false,
  disabled = false,
  block = false,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  filled?: boolean;
  disabled?: boolean;
  /** Volle breedte — de "Iets delen"-knop in de feed-zijbalk. */
  block?: boolean;
}) {
  const isFeed = tone === "feed" || tone === "post";
  const edge = edgeColor(tone);
  /** Kleur van de tekst óp een gevulde knop. */
  const onFilled =
    tone === "dark" ? carbon.DEFAULT
    : tone === "feed" ? feed.text
    : tone === "post" ? feed.post
    : page.DEFAULT;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        borderWidth: isFeed ? FEED_BORDER : StyleSheet.hairlineWidth,
        borderColor: disabled ? carbon.muted : edge,
        backgroundColor:
          filled && !disabled
            // De ingedrukte staat van een gevulde feed-knop is flame-deep —
            // de web-mockup doet dat op :hover, native heeft alleen :active.
            ? isFeed && pressed ? flameDeep : edge
            : "transparent",
        ...(isFeed
          ? { paddingVertical: 12, paddingHorizontal: 16 }
          : { paddingVertical: 10, paddingHorizontal: 16 }),
        ...(block ? { width: "100%" as const, alignItems: "center" as const } : null),
      })}
    >
      <Text
        style={[
          isFeed ? feedType.label : type.meta,
          isFeed ? { fontSize: 13, fontWeight: "700" as const } : null,
          { color: disabled ? carbon.muted : filled ? onFilled : edge },
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
