import { useEffect, useState, type ReactNode } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, pageTint, useScheme, useThemeSpec, type Scheme } from "@/lib/design/theme";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { useUnread, type Tab } from "@/lib/lincin/unread";

import { DesktopShell } from "./desktop/Shell";

import { Header } from "./chrome/Header";
import { FooterTabs } from "./chrome/Footer";

import { GUTTER } from "./ui";

/**
 * De omlijsting van élk v2-scherm (HANDOFF §Global chrome, 2.2 §5).
 *
 *   KOP      per thema een eigen vorm, maar altijd dezelfde drie plaatsen:
 *            links de terugknop (op elk subscherm), in het midden waar je
 *            bent, rechts meldingen en een nieuwe bijdrage. Zie
 *            `chrome/Header.tsx`.
 *   BLAD     het papier. In modern een zachte kleurhaze van de vriend
 *            in beeld; in magazine gewoon papier.
 *   VOET     per thema: de rugstrook van magazine (model 1d), of de
 *            zwevende pil van modern. Altijd in beeld
 *            en altijd boven de inhoud. Zie `chrome/Footer.tsx`.
 *
 * De voet staat hier en niet in de tabnavigator: een gesprek en een
 * bladzijde zijn stack-schermen en horen hem óók te hebben, met het
 * juiste tabblad aan.
 */

export type { Tab };
export { useUnread };
export { Header } from "./chrome/Header";
export { BackButton } from "./chrome/Header";
export { NAV_CLEARANCE } from "./chrome/Footer";
export { vfade, FADE } from "./chrome/VFade";

/** Hoe breed het blad op een groot scherm mag worden. */
const COLUMN_MAX = 640;

/**
 * Hoe breed het blad nú is, gegeven de vensterbreedte: het venster zelf,
 * of de kolom als het venster ruim breder is. Wie iets moet verdelen over
 * die breedte rekent hiermee in plaats van te meten — een `onLayout` op de
 * ScrollView blijft op web wel eens uit.
 */
export function columnWidth(windowWidth: number): number {
  return windowWidth > COLUMN_MAX + 40 ? COLUMN_MAX : windowWidth;
}

export function LincinScreen({
  tab,
  tint,
  tintNext = null,
  tabTint,
  counter,
  header = "default",
  back = null,
  full = false,
  bleed = false,
  embedded = false,
  ownDesktop = false,
  tabs,
  actions = true,
  children,
}: {
  tab: Tab;
  /** Geen kolom van 640 op een breed scherm — voor wie zelf kolommen legt (het gesprek). */
  full?: boolean;
  /**
   * De vriendkleur (hex) van wie in beeld is: de kleurhaze van modern, en
   * het actieve tabblad van magazine.
   */
  tint?: string | null;
  /**
   * De kleur van de vólgende vriend in de feed. De kleurhaze van modern
   * gebruikt hem als de derde vlek onderaan.
   */
  tintNext?: string | null;
  /**
   * De vriendkleur van het actieve tabblad (alleen in magazine). Standaard
   * `tint`; een scherm dat wel tint maar geen vriend in beeld heeft
   * (nieuwe bijdrage) geeft `null`.
   */
  tabTint?: string | null;
  /** Rechts in de kop, mono en gedempt: `01 / 05` of de schermnaam. */
  counter?: string;
  /**
   * Een subscherm: de kopregel krijgt links een terugknop (2.2 §5). De
   * waarde is de route om op terug te vallen als er geen geschiedenis is —
   * een gedeelde link opent middenin de app en heeft niets achter zich.
   * `null` (standaard) is een hoofdscherm, zonder terugknop.
   */
  back?: string | null;
  /**
   * De kop "Lincin · teller · ◉ · +" staat op élk scherm (prototype:
   * `showHeader` is alleen uit voor de magazine-feed). Een scherm met een
   * eigen bovenrij (`← Terug`, een titel) geeft die hier mee; hij komt
   * ónder de kop. `none` laat de kop weg.
   */
  header?: "default" | "none" | ReactNode;
  /** De inhoud loopt onder de statusbalk door (het magazine-hero). */
  bleed?: boolean;
  /** In het desktoppaneel: alleen de inhoud, geen kop, voet of blad. */
  embedded?: boolean;
  /** Dit scherm tekent zijn eigen desktopvorm (de feed): geen omlijsting. */
  ownDesktop?: boolean;
  /**
   * De tabbalk onderaan. Standaard alleen op een hoofdscherm — een scherm
   * zonder `back`: feed, gesprekken, events, jij.
   *
   * Hij stond op elk scherm, en in modern zweeft de pil over de inhoud
   * zonder dat iets er ruimte voor houdt. Op een bijdrage lag hij dus pal
   * over het reactieveld, in een gesprek boven het invoerveld. Een
   * subscherm heeft "terug" in de kop; de tabbalk voegt daar niets toe
   * behalve iets om per ongeluk op te tikken.
   */
  tabs?: boolean;
  /**
   * ◉ en + in de kop. Uit bij een scherm waar je iets maakt (nieuwe
   * bijdrage): daar lokken ze je weg van wat je schrijft, en "+" opende er
   * een tweede nieuwe bijdrage.
   */
  actions?: boolean;
  children: ReactNode;
}) {
  const scheme = useScheme();
  const spec = useThemeSpec();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = useIsDesktop();
  const showTabs = tabs ?? !back;
  if (embedded) return <View style={{ flex: 1, minHeight: 0 }}>{children}</View>;
  if (desktop && !ownDesktop) {
    // Desktop (Lincin Desktop.dc.html): rail, hoofdkolom, paneel. Een scherm
    // zonder eigen desktopvorm staat als kolom van 640 in het midden, mét
    // zijn eigen bovenrij (← Terug) maar zonder de telefoonkop en -voet.
    return (
      <DesktopShell active={tab}>
        <View style={{ flex: 1, minHeight: 0, alignItems: "center" }}>
          <View style={{ flex: 1, minHeight: 0, width: "100%", maxWidth: 640, paddingTop: 16 }}>
            {header === "default" || header === "none" ? null : header}
            {children}
          </View>
        </View>
      </DesktopShell>
    );
  }
  const haze = spec.haze && !!tint;
  const bg = color("paper");
  const wide = !full && columnWidth(width) !== width;
  // De actieve tab draagt de vriendkleur in magazine (2.2 §3: "de kleur
  // van de pagina"). Modern heeft een eigen pil, zonder kleur.
  const tabTakesTint = spec.nav === "rugstrook";
  const activeTint = tabTakesTint ? (tabTint === undefined ? tint : tabTint) ?? null : null;

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: bleed ? 0 : insets.top }}>
      {haze ? <Haze tint={tint!} next={tintNext} scheme={scheme} /> : null}
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: wide ? COLUMN_MAX : undefined,
          alignSelf: "center",
        }}
      >
        {header === "none" ? null : <Header counter={counter} back={back} actions={actions} />}
        {header === "default" || header === "none" ? null : header}
        <View style={{ flex: 1, minHeight: 0, paddingBottom: showTabs ? 0 : insets.bottom }}>{children}</View>
        {showTabs ? <FooterTabs active={tab} tint={activeTint} bottomInset={Math.max(insets.bottom, 16)} /> : null}
      </View>
    </View>
  );
}

/**
 * De kleurhaze van modern (prototype, `modernBg`).
 *
 * Geen verloop van boven naar beneden, maar drie radiale vlekken: de
 * vriend in beeld linksboven en rechtsboven, en wie hierna komt onderaan. Ze liggen op het papier en de tegels liggen er weer
 * bovenop, halfdoorzichtig, zodat de kleur er dwars doorheen schemert.
 *
 * Op web zijn het drie CSS-verlopen op één laag; dat is precies wat het
 * prototype doet en het kost niets. `react-native-svg` kent
 * `RadialGradient` ook, maar een `at 12% -8%` met eigen straal per as is
 * daar een `<RadialGradient>` met `gradientTransform`, en drie daarvan
 * over elkaar is duurder dan het waard is. Op native blijft het bij het
 * papier: de tegels dragen de vorm, de haze is een extraatje.
 */
function Haze({ tint, next, scheme }: { tint: string; next: string | null; scheme: Scheme }) {
  const [shown, setShown] = useState({ tint, next: next ?? tint });
  const key = `${tint}|${next ?? tint}`;
  useEffect(() => {
    setShown({ tint, next: next ?? tint });
  }, [key, tint, next]);

  if (Platform.OS !== "web") return null;
  const dark = scheme === "dark";
  // Dezelfde percentages als `modernBg` in het prototype. `pageTint` mengt
  // in OKLCH met het papier van het thema dat nú geldt, net als de
  // `color-mix(in oklch, …)` daar.
  const mix = (fill: string, w: number) => pageTint(fill, scheme, { light: w, dark: w });
  const a = mix(shown.tint, dark ? 0.52 : 0.4);
  const b = mix(shown.tint, dark ? 0.34 : 0.26);
  const c = mix(shown.next, 0.34);
  const image = [
    `radial-gradient(118% 76% at 12% -8%, ${a} 0%, transparent 62%)`,
    `radial-gradient(92% 58% at 106% 14%, ${b} 0%, transparent 66%)`,
    `radial-gradient(130% 68% at 46% 116%, ${c} 0%, transparent 68%)`,
  ].join(", ");
  return (
    <View
      style={[
        { pointerEvents: "none", position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
        {
          backgroundImage: image,
          transitionProperty: "background-image",
          transitionDuration: "700ms",
          transitionTimingFunction: "ease",
        } as object,
      ]}
    />
  );
}

/**
 * De bovenrij van een blad ónder de kopregel: een titel of een label.
 *
 * De terugknop stond hier tot 2.1 als losse `← Terug`-chip. Sinds 2.2
 * staat hij in de kopregel zelf (2.2 §5) en is `left` alleen nog voor wat
 * een scherm daar verder kwijt wil.
 */
export function TopRow({
  left,
  right,
  center,
}: {
  left?: ReactNode;
  right?: ReactNode;
  center?: ReactNode;
}) {
  return (
    <View
      style={{
        marginTop: 8,
        marginHorizontal: GUTTER,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
        {left}
        {center}
      </View>
      {right}
    </View>
  );
}
