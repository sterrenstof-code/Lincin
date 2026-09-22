import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Platform, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, pageTint, paperHex, useScheme, useThemeSpec, type Scheme } from "@/lib/design/theme";
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
 *   BLAD     het papier. In kleur getint met de vriend in beeld, als
 *            kleur van boven (2.2 §4); in modern een zachte kleurhaze;
 *            in magazine gewoon papier.
 *   VOET     per thema: het kader van kleur, de rugstrook van magazine
 *            (model 1d), of de zwevende pil van modern. Altijd in beeld
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
  /** De vriendkleur (hex) van wie in beeld is; het blad kleurt mee (alleen in kleur). */
  tint?: string | null;
  /**
   * De kleur van de vólgende vriend in de feed.
   *
   * Het verloop van kleur gebruikt hem sinds 2.2 níet meer: de tweede
   * kleurband onderin is weg (§4). De kleurhaze van modern gebruikt hem
   * nog wel, als de derde vlek onderaan.
   */
  tintNext?: string | null;
  /**
   * De vriendkleur van het actieve tabblad (alleen in kleur). Standaard
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
  const verloop = spec.tint && !!tint;
  const haze = spec.haze && !!tint;
  const bg = color("paper");
  const wide = !full && columnWidth(width) !== width;
  // De actieve tab draagt de vriendkleur in kleur én in magazine (2.2 §3:
  // "de kleur van de pagina"). Modern heeft een eigen pil, zonder kleur.
  const tabTakesTint = spec.nav !== "pil";
  const activeTint = tabTakesTint ? (tabTint === undefined ? tint : tabTint) ?? null : null;

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingTop: bleed ? 0 : insets.top }}>
      {verloop ? <Verloop tint={tint!} scheme={scheme} /> : null}
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
 * Het verloop van kleur: KLEUR ALS LICHT VAN BOVEN (2.2 §4).
 *
 * De kleur van de vriend in beeld ligt bovenaan en dooft uit naar papier.
 * Vier stops, precies als `kleurBg` in het prototype:
 *
 *   0%   de tint
 *   18%  nog steeds de tint — het licht valt van boven, vlak
 *   42%  de halve tint (de tint zelf op 52% op papier)
 *   72%  papier, en van daar naar onder blijft het papier
 *
 * In 2.1 stond hier nog een tweede kleurband onderin, in de kleur van de
 * vólgende vriend: het blad keek vooruit. Die is weg — hij concurreerde
 * met de tekst (2.2 §4). Daarmee vervalt ook de prop `tintNext`.
 *
 * De overgang duurt .7s (`background .7s ease`). Eén laag, en het zijn de
 * kleuren zelf die schuiven: elke frame een tussenkleur, vanaf wat er nú
 * staat. Er stond eerst een overvloeiing van twee lagen met een
 * geanimeerde doorzichtigheid, en die bleef bij snel scrollen in de browser
 * hangen op de kleuren van de vorige vriend. Een kleur die halverwege een
 * nieuw doel krijgt, loopt gewoon vanaf daar verder.
 */
const VERLOOP_MS = 700;

type Stops = { top: [number, number, number]; half: [number, number, number]; paper: [number, number, number] };

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexOf([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function mixRgb(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** CSS `ease`, benaderd: traag begin, snel midden, zacht einde. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function Verloop({ tint, scheme }: { tint: string; scheme: Scheme }) {
  const paper = paperHex(scheme);
  const top = pageTint(tint, scheme);
  // De halve tint: de tint zelf voor 52% op papier — `halfTint` in het
  // prototype. Gemengd in OKLCH, net als `pageTint`, zodat de toon van de
  // vriend blijft staan.
  const target: Stops = {
    top: rgbOf(top),
    half: rgbOf(pageTint(tint, scheme, { light: 0.42 * 0.52, dark: 0.18 * 0.52 })),
    paper: rgbOf(paper),
  };
  const key = `${hexOf(target.top)}${hexOf(target.half)}${hexOf(target.paper)}`;
  const [shown, setShown] = useState<Stops>(target);
  const shownRef = useRef(shown);
  shownRef.current = shown;
  const id = `verloop-${useId().replace(/[^a-z0-9]/gi, "")}`;

  useEffect(() => {
    const from = shownRef.current;
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - start) / VERLOOP_MS);
      const k = ease(t);
      setShown({
        top: mixRgb(from.top, target.top, k),
        half: mixRgb(from.half, target.half, k),
        paper: mixRgb(from.paper, target.paper, k),
      });
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // Alleen een nieuw doel start een overgang; `target` is elke render een nieuw object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const hex = hexOf(shown.top);
  const halfHex = hexOf(shown.half);
  const paperNow = hexOf(shown.paper);
  return (
    <View style={{ pointerEvents: "none", position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          {/* Eén id per blad: op web staan meerdere schermen tegelijk in het
              document, en `url(#…)` pakt het eerste met die naam. */}
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset={0} stopColor={hex} />
            <Stop offset={0.18} stopColor={hex} />
            <Stop offset={0.42} stopColor={halfHex} />
            <Stop offset={0.72} stopColor={paperNow} />
            <Stop offset={1} stopColor={paperNow} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/**
 * De kleurhaze van modern (prototype, `modernBg`).
 *
 * Geen verloop van boven naar beneden zoals in kleur, maar drie radiale
 * vlekken: de vriend in beeld linksboven en rechtsboven, en wie hierna
 * komt onderaan. Ze liggen op het papier en de tegels liggen er weer
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
