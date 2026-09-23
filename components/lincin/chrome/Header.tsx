import { usePathname, useRouter } from "expo-router";
import { Pressable, Text, View, type TextStyle } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { color, useThemeSpec } from "@/lib/design/theme";
import { lincinType, mono, sans, serif } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { safeBack } from "@/lib/nav";
import { useUnread } from "@/lib/lincin/unread";

import { GUTTER, SquareBtn } from "../ui";

/**
 * De kopregel (WIJZIGINGEN-2.2 §5).
 *
 * Drie thema's, drie koppen — maar met dezelfde drie plaatsen: links de
 * terugknop, in het midden waar je bent, rechts meldingen en een nieuwe
 * bijdrage.
 *
 *   KLEUR     "Lincin" links, rechts de teller, ◉ en +. Vierkanten van
 *             32 px, want kleur kent geen ronding.
 *   MAGAZINE  kolofonregel "Lincin · teller" in gespatieerde Archivo,
 *             rechts ✳ en + als omlijnde cirkels van 30 px.
 *   MODERN    de teller in mono links, rechts twee ronde knoppen van
 *             44 px op tegelvlak: de bel (met rode stip bij nieuw) en de
 *             plus.
 *
 * DE TERUGKNOP staat sinds 2.2 hier, in de kopregel, en niet meer als
 * losse "← Terug"-regel in de pagina zelf. Hij verschijnt op elk
 * subscherm: bijdrage, profiel, gesprek, instellingen, meldingen, nieuwe
 * bijdrage. De vorm volgt het thema — in kleur een vierkant, in magazine
 * en modern een cirkel — want 2.2 §5 vraagt "dezelfde vorm als de ronde
 * knoppen rechts", en die zijn in kleur vierkant.
 *
 * Elk raakvlak is minstens 44 px: waar de zichtbare vorm kleiner is, ligt
 * het raakvlak op een omhulsel met compenserende negatieve marge.
 */

/**
 * De drie tekeningen uit het prototype. `react-native-svg` erft geen
 * `currentColor` uit een omhullende `<Text>`, dus de kleur gaat er als prop
 * in — anders staat er op native een zwarte pijl op een zwart vlak.
 */
function BackArrow({ tone, size = 14 }: { tone: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M9.6 3.4 5 8l4.6 4.6" stroke={tone} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function BellIcon({ tone, size = 16 }: { tone: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Circle cx={8} cy={6.6} r={4.3} stroke={tone} strokeWidth={1.3} />
      <Path d="M3.4 12.2h9.2" stroke={tone} strokeWidth={1.3} strokeLinecap="round" />
    </Svg>
  );
}

export function PlusIcon({ tone, size = 16 }: { tone: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <Path d="M8 2.4v11.2M2.4 8h11.2" stroke={tone} strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  );
}

/**
 * De terugknop. `to` is waar hij heen gaat als er geen geschiedenis is om
 * op terug te vallen — een gedeelde link opent immers middenin de app.
 */
export function BackButton({ to }: { to: string }) {
  const router = useRouter();
  const spec = useThemeSpec();
  // Prototype: kleur 32 px met `border-radius: var(--r)` (dus vierkant),
  // magazine 34 px rond, modern 44 px rond.
  const size = spec.id === "modern" ? 44 : spec.id === "magazine" ? 34 : 32;
  const radius = spec.id === "kleur" ? spec.radius : size / 2;
  // Het raakvlak op 44: de padding vult aan wat de vorm mist, de negatieve
  // marge haalt die ruimte weer uit de opmaak.
  const pad = Math.max(0, Math.ceil((44 - size) / 2));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Terug"
      onPress={() => safeBack(router, to)}
      style={({ pressed }) => ({
        flexShrink: 0,
        padding: pad,
        margin: -pad,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: color("ink"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <BackArrow tone={color("paper")} />
      </View>
    </Pressable>
  );
}

/**
 * Een ronde knop van 44 px op tegelvlak — de twee rechts in de
 * modern-kopregel (2.2 §5).
 */
function RoundTileBtn({
  onPress,
  label,
  badge = false,
  fill = false,
  render,
}: {
  onPress: () => void;
  label: string;
  badge?: boolean;
  /** Een inktvlak in plaats van een tegel — de plus in de feed. */
  fill?: boolean;
  render: (tone: string) => React.ReactNode;
}) {
  const tone = fill ? color("paper") : color("ink");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: fill ? color("ink") : color("tile", "tileFill"),
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {render(tone)}
      {badge ? (
        <View
          style={{
            position: "absolute",
            top: 10,
            right: 11,
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: color("red"),
          }}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * Een omlijnde cirkel van 30 px met een serifglyph — de vorm van magazine.
 *
 * Staat in de kopregel (✳ meldingen, + nieuwe bijdrage) én op het hero van
 * de feed, want daar heeft de magazine-feed geen kopregel maar dezelfde
 * twee handelingen. Op het beeld krijgt hij `tone` in papierkleur en een
 * schaduw mee, zodat de glyph leesbaar blijft.
 *
 * Het raakvlak is 44: de zichtbare cirkel is 30, met 7 px padding eromheen
 * en een compenserende negatieve marge.
 */
export function CircleGlyphBtn({
  glyph,
  fontSize,
  onPress,
  label,
  badge = false,
  tone,
  shade,
  ringColor,
}: {
  glyph: string;
  fontSize: number;
  onPress: () => void;
  label: string;
  badge?: boolean;
  tone?: string;
  /** Een tekstschaduw voor de glyph, als hij op een foto staat. */
  shade?: TextStyle;
  /** De ring om de rode stip; standaard papier. */
  ringColor?: string;
}) {
  const fg = tone ?? color("ink");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({ padding: 7, margin: -7, opacity: pressed ? 0.7 : 1 })}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 1,
          borderColor: fg,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ ...serif(), fontSize, lineHeight: fontSize, color: fg, ...shade }}>{glyph}</Text>
      </View>
      {badge ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: color("red"),
            borderWidth: 2,
            borderColor: ringColor ?? color("paper"),
          }}
        />
      ) : null}
    </Pressable>
  );
}

/**
 * `actions={false}`: zonder ◉ en +. Op een scherm waar je iets maakt is
 * "+ nieuwe bijdrage" een tweede kopie van waar je al bent, en de meldingen
 * lokken je weg van wat je aan het schrijven bent.
 */
export function Header({ counter, back, actions = true }: { counter?: string; back?: string | null; actions?: boolean }) {
  const spec = useThemeSpec();
  if (spec.id === "magazine") return <HeaderMagazine counter={counter} back={back} actions={actions} />;
  if (spec.id === "modern") return <HeaderModern counter={counter} back={back} actions={actions} />;
  return <HeaderKleur counter={counter} back={back} actions={actions} />;
}

/** "Lincin" · teller · ◉ · + */
function HeaderKleur({ counter, back, actions = true }: { counter?: string; back?: string | null; actions?: boolean }) {
  const router = useRouter();
  const t = useT();
  const pathname = usePathname();
  const unread = useUnread();
  const onNotes = pathname.startsWith("/notifications");
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 6,
        paddingHorizontal: GUTTER,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1, minWidth: 0 }}>
        {back ? <BackButton to={back} /> : null}
        {/* Op een subpagina zegt de kop "Terug" naast de pijl, niet "Lincin"
            (mobile-app.dc.html, `kleurNoBack`): de weg terug staat er één keer. */}
        {back ? (
          <Pressable accessibilityRole="button" onPress={() => safeBack(router, back)} hitSlop={8}>
            <Text style={[lincinType.meta, mono(600), { color: color("ink") }]}>{t.back}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="link" onPress={() => router.push("/feed")} hitSlop={8}>
            <Text style={[lincinType.meta, mono(600), { color: color("ink") }]}>Lincin</Text>
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
        {counter ? (
          <Text style={[lincinType.meta, { color: color("ink", "inkDim"), marginRight: 4 }]}>{counter}</Text>
        ) : null}
        {actions ? (
          <>
            <SquareBtn
              glyph="◉"
              fontSize={14}
              fill={onNotes}
              badge={unread.notifications > 0}
              onPress={() => router.push("/notifications")}
              accessibilityLabel={unread.notifications > 0 ? `Meldingen, ${unread.notifications} nieuw` : "Meldingen"}
            />
            <SquareBtn
              glyph="+"
              fontSize={18}
              fill
              onPress={() => router.push("/post-compose")}
              accessibilityLabel="Nieuwe bijdrage"
            />
          </>
        ) : null}
      </View>
    </View>
  );
}

/** De kolofonregel: "Lincin · teller" links, ✳ en + rechts. */
function HeaderMagazine({ counter, back, actions = true }: { counter?: string; back?: string | null; actions?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const unread = useUnread();
  const onNotes = pathname.startsWith("/notifications");
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: 8,
        paddingBottom: 16,
        paddingHorizontal: 24,
        gap: 16,
      }}
    >
      {back ? (
        <View style={{ marginRight: 5 }}>
          <BackButton to={back} />
        </View>
      ) : null}
      <Pressable
        accessibilityRole="link"
        onPress={() => router.push("/feed")}
        style={{ flexShrink: 1, minWidth: 0, paddingVertical: 11, marginVertical: -11 }}
      >
        <Text
          numberOfLines={1}
          style={{
            ...sans(500),
            fontSize: 9,
            lineHeight: 12,
            letterSpacing: 1.98, // .22em
            textTransform: "uppercase",
            color: color("ink", "inkDim"),
          }}
        >
          {counter ? `Lincin · ${counter}` : "Lincin"}
        </Text>
      </Pressable>
      {actions ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <CircleGlyphBtn
            glyph="✳"
            fontSize={15}
            badge={unread.notifications > 0}
            tone={onNotes ? color("ink") : color("ink", "inkDim")}
            onPress={() => router.push("/notifications")}
            label={unread.notifications > 0 ? `Meldingen, ${unread.notifications} nieuw` : "Meldingen"}
          />
          <CircleGlyphBtn glyph="+" fontSize={19} onPress={() => router.push("/post-compose")} label="Nieuwe bijdrage" />
        </View>
      ) : null}
    </View>
  );
}

/** De teller in mono links, twee ronde knoppen van 44 px rechts. */
function HeaderModern({ counter, back, actions = true }: { counter?: string; back?: string | null; actions?: boolean }) {
  const router = useRouter();
  const unread = useUnread();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 12,
        // De ronde knoppen van 44 stonden tegen de bovenrand geplakt; de
        // andere twee thema's hebben hier wel lucht.
        paddingTop: 10,
        paddingBottom: 8,
        gap: 10,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1, minWidth: 0 }}>
        {back ? <BackButton to={back} /> : null}
        <Text
          numberOfLines={1}
          style={{
            ...mono(500),
            fontSize: 9.5,
            lineHeight: 13,
            letterSpacing: 1.71, // .18em
            textTransform: "uppercase",
            color: color("ink", "inkDim"),
          }}
        >
          {counter ?? "Lincin"}
        </Text>
      </View>
      {actions ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <RoundTileBtn
            onPress={() => router.push("/notifications")}
            label={unread.notifications > 0 ? `Meldingen, ${unread.notifications} nieuw` : "Meldingen"}
            badge={unread.notifications > 0}
            render={(tone) => <BellIcon tone={tone} />}
          />
          <RoundTileBtn
            onPress={() => router.push("/post-compose")}
            label="Nieuwe bijdrage"
            render={(tone) => <PlusIcon tone={tone} />}
          />
        </View>
      ) : null}
    </View>
  );
}
