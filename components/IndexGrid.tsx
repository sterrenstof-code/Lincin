import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import {
  feed,
  FEED_BORDER,
  feedType,
  rule,
  space,
} from "@/lib/design/type";

/**
 * De rasterlaag — v5.
 *
 * ---------------------------------------------------------------
 * WAAR DIT VANDAAN KOMT
 * ---------------------------------------------------------------
 * Twee bladen, en ze vullen elkaar aan.
 *
 * **Fondation Phi** (Yoko Ono, *Liberté Conquérante*) zat er al in: de
 * etiketkolom links, banden over de volle breedte met een haarlijn ertussen,
 * en één display-serif die de pagina draagt. Dat staat in `lib/design/type.ts`
 * en in `Sheet` — de 1250 is niet willekeurig, het is een etiketkolom plus
 * inhoud.
 *
 * **Искусство кино** (het Russische filmtijdschrift) voegt iets toe wat hier
 * ontbrak: een rooster waarin de cellen géén kaders hebben. De kolommen
 * worden gescheiden door verticale haarlijnen die over de volle rijhoogte
 * doorlopen, en de rijen door horizontale. Je ziet geen kaartjes maar een
 * opgemaakte pagina.
 *
 * Dat verschil is niet cosmetisch. Een kaart met een kader is een object dat
 * op een pagina ligt; een cel tussen twee lijnen ís de pagina. Dit systeem
 * had die keuze al gemaakt voor de vondstkaart (DESIGN.md §4: "een kaart
 * heeft geen vulling"), maar het rooster eromheen hield zich er nog niet
 * aan — daar stond elke tegel nog in zijn eigen omlijning.
 *
 * ---------------------------------------------------------------
 * WAT HIER NIET IN ZIT
 * ---------------------------------------------------------------
 * Geen kleuren, geen schaduwen, geen afronding. Die horen bij `type.ts` en
 * bij de twee standen; dit bestand levert alleen structuur. Zo kan een
 * rooster nooit uit de toon vallen tegen het palet in, hoe het ook gevuld
 * wordt — dezelfde afspraak als bij `RichText`.
 */

// ---------------------------------------------------------------
// DE SCHIJF — een merkteken, geen knop
// ---------------------------------------------------------------

/**
 * Een gevulde cirkel met een teken erin.
 *
 * In de referentie staat hij vóór een rubriekkop en als klein label bij een
 * datum. Het is het enige ronde element in een systeem dat verder op rechte
 * hoeken staat, en dat is precies waarom hij werkt: hij leest als een
 * stempel op de pagina in plaats van als nóg een vlak.
 *
 * Bewust geen `Pressable`. Een schijf die je kunt aantikken wordt een knop,
 * en dan moet hij een aanraakvlak van 44 punten hebben — waarmee hij zijn
 * hele karakter verliest. Hoort er een handeling bij, wikkel hem dan zelf.
 */
export function Disc({
  glyph,
  size = 22,
  tone = "ink",
}: {
  /** Eén of twee tekens. Meer past niet en hoort er niet in. */
  glyph: string;
  size?: number;
  tone?: "ink" | "paper";
}) {
  const onInk = tone === "ink";
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: onInk ? feed.ink : feed.post,
        ...(onInk ? null : { borderWidth: FEED_BORDER, borderColor: feed.ink }),
      }}
    >
      <Text
        style={{
          fontFamily: feedType.kicker.fontFamily,
          fontSize: Math.round(size * 0.45),
          lineHeight: Math.round(size * 0.5),
          fontWeight: "800",
          letterSpacing: 0,
          color: onInk ? feed.post : feed.ink,
        }}
      >
        {glyph}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------
// DE RUBRIEKKOP — schijf, woord, lijn
// ---------------------------------------------------------------

/**
 * De zwaardere rubriekkop uit de referentie: een schijf, een groot woord in
 * kapitalen, en een dikke lijn eronder.
 *
 * Naast `SectionBand` en niet in plaats daarvan. Die is de inhoudsopgave —
 * genummerd, klein, veel van na elkaar. Deze is de aankondiging van een
 * hoofdstuk: er staan er twee of drie op een pagina, niet acht. Gebruik je
 * hem vaker, dan schreeuwt de pagina en is er geen hiërarchie meer.
 */
export function SectionMark({
  glyph,
  label,
  trailing,
}: {
  glyph: string;
  label: string;
  /** Rechts op dezelfde regel — bijvoorbeeld "Alles bekijken →". */
  trailing?: ReactNode;
}) {
  return (
    <View style={{ marginBottom: space.lg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingBottom: space.md,
        }}
      >
        <Disc glyph={glyph} size={26} />
        <Text
          style={{
            fontFamily: feedType.kicker.fontFamily,
            fontSize: 26,
            lineHeight: 30,
            fontWeight: "800",
            letterSpacing: 0.5,
            color: feed.ink,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {label.toUpperCase()}
        </Text>
        {trailing}
      </View>
      {/* Zwaarder dan een scheidingslijn tussen rijen: dit is waar een
          hoofdstuk begint, niet waar twee dingen elkaar raken. */}
      <View style={{ height: FEED_BORDER * 2, backgroundColor: feed.ink }} />
    </View>
  );
}

// ---------------------------------------------------------------
// HET DATUMCIJFER
// ---------------------------------------------------------------

/**
 * De datum als getal, rechts uitgelijnd en groot.
 *
 * In de referentie is dit het zwaarste element van een cel — zwaarder dan de
 * titel. Dat klopt voor een agenda: bij een evenement is *wanneer* de vraag,
 * en pas daarna *wat*. Voor iets zonder datum heeft dit geen zin; zet er dan
 * niets neer in plaats van een streepje.
 */
export function DateStamp({
  date,
  size = 30,
}: {
  date: Date | string;
  size?: number;
}) {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return (
    <Text
      style={{
        fontFamily: feedType.numeral.fontFamily,
        fontSize: size,
        lineHeight: Math.round(size * 1.05),
        // Cijfers van gelijke breedte: anders danst de datum van cel tot cel
        // en verliest de kolom zijn rechterlijn.
        fontVariant: ["tabular-nums"],
        letterSpacing: -0.5,
        color: feed.ink,
      }}
    >
      {dd}.{mm}
    </Text>
  );
}

// ---------------------------------------------------------------
// HET ROOSTER
// ---------------------------------------------------------------

/**
 * Cellen zonder kaders, gescheiden door haarlijnen.
 *
 * ---------------------------------------------------------------
 * WAAROM DE LAATSTE RIJ WORDT AANGEVULD
 * ---------------------------------------------------------------
 * Blijven er twee cellen over in een rooster van drie, dan houdt de derde
 * verticale lijn halverwege op en zakt de pagina aan één kant in. De
 * referentie lost dat op met een grijs vlak waar "AD" in staat — een lege
 * plek die de maat vasthoudt.
 *
 * Wij zetten er niets in, maar houden de cel wél: de lijn loopt door, de
 * ruimte blijft leeg. Dat is hetzelfde principe zonder een advertentie te
 * hoeven verzinnen.
 *
 * De lijnen zitten op de cellen en niet op een aparte laag eroverheen. Een
 * overlay zou op de punt moeten uitrekenen hoe hoog de rij geworden is, en
 * dat weet je bij tekst pas ná de meting — één frame te laat, en dan zie je
 * de lijnen springen.
 */
export function IndexGrid({
  columns,
  children,
  style,
}: {
  /** Bepaal dit bij de aanroeper: die kent de breedte van zijn eigen kolom. */
  columns: number;
  children: ReactNode[];
  style?: ViewStyle;
}) {
  const cells = children.filter((c) => c !== null && c !== undefined && c !== false);
  const n = Math.max(1, Math.floor(columns));
  if (cells.length === 0) return null;

  const rows: ReactNode[][] = [];
  for (let i = 0; i < cells.length; i += n) {
    rows.push(cells.slice(i, i + n));
  }

  return (
    <View style={style}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: "row" }}>
          {Array.from({ length: n }).map((_, c) => (
            <View
              key={c}
              style={{
                flex: 1,
                minWidth: 0,
                paddingVertical: space.lg,
                paddingHorizontal: c === 0 ? 0 : space.md,
                // Boven élke rij een lijn, ook de eerste: de rubriekkop
                // erboven sluit met zijn eigen zware lijn af, en dan hoort
                // de eerste rij daar niet tegenaan te plakken.
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: rule.soft,
                ...(c === 0
                  ? null
                  : {
                      borderLeftWidth: StyleSheet.hairlineWidth,
                      borderLeftColor: rule.soft,
                    }),
              }}
            >
              {/* Lege cel: de lijn loopt door, de ruimte blijft leeg. */}
              {row[c] ?? null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------
// DE ETIKETBAND — de kant van Fondation Phi
// ---------------------------------------------------------------

/**
 * Een band over de volle breedte: etiket links, inhoud rechts, lijn erboven.
 *
 * Dit is de opbouw waar `Sheet` zijn maat aan ontleent — 1250 is de
 * etiketkolom plus de inhoud ernaast. Hij stond alleen nergens als
 * onderdeel, waardoor elk scherm hem opnieuw uittekende met een eigen
 * kolombreedte. Nu is er één maat, en op smal valt hij netjes onder elkaar:
 * een etiketkolom van 180 punten naast een telefoonscherm laat niets over
 * voor de inhoud.
 */
export function LabelBand({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide: boolean;
}) {
  return (
    <View
      style={{
        borderTopWidth: FEED_BORDER,
        borderTopColor: feed.ink,
        paddingVertical: space.lg,
        ...(wide
          ? { flexDirection: "row" as const, gap: space.xxl }
          : { gap: space.sm }),
      }}
    >
      <Text
        style={[
          feedType.label,
          {
            color: feed.inkDim,
            ...(wide ? { width: LABEL_COLUMN } : null),
          },
        ]}
      >
        {label}
      </Text>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}

/**
 * De etiketkolom. Breed genoeg voor twee woorden onder elkaar, smal genoeg
 * dat de inhoud ernaast de hoofdzaak blijft.
 */
export const LABEL_COLUMN = 180;

// ---------------------------------------------------------------
// DE MICRO-MARKERING — de kant van het Teenage Engineering-blad
// ---------------------------------------------------------------

/**
 * Het kleinste label dat er is: `// 002`, `[ about ]`, `ux / ui`.
 *
 * Een teken dat er iets geteld of benoemd wordt, zonder dat het aandacht
 * vraagt. In de referentie hangen ze in de hoeken van een vlak en zeggen ze
 * waar je bent in een reeks — dezelfde rol als een paginanummer in een boek.
 *
 * De haken en schuine strepen horen erbij en staan daarom hier, niet in de
 * aanroep: schrijft elk scherm ze zelf, dan staat er de ene keer `[about]`
 * en de andere keer `[ about ]`, en dat verschil zie je.
 */
export function IndexMark({
  children,
  form = "slash",
  tone = "ink",
}: {
  children: string;
  /** `slash` → `// 002`, `bracket` → `[ about ]`, `plain` → `ux / ui`. */
  form?: "slash" | "bracket" | "plain";
  tone?: "ink" | "cream";
}) {
  const text =
    form === "slash" ? `// ${children}`
    : form === "bracket" ? `[ ${children} ]`
    : children;
  return (
    <Text
      style={[
        feedType.kicker,
        {
          fontSize: 9,
          letterSpacing: 1.2,
          color: tone === "ink" ? feed.inkDim : "rgba(255,255,255,0.72)",
        },
      ]}
    >
      {text}
    </Text>
  );
}

/**
 * Een rij korte bijschriften in gelijke kolommen.
 *
 * Onderaan een beeld, of onder een blok: vier of vijf zinnetjes naast
 * elkaar die samen vertellen wat er te zien is. Het is de tegenhanger van
 * `LabelBand` — die zet één etiket naast veel inhoud, deze zet veel kleine
 * stukjes naast elkaar zonder hiërarchie.
 *
 * Op smal vallen ze onder elkaar. Vijf kolommen op een telefoon geeft
 * regels van drie woorden, en dan lees je niets meer.
 */
export function CaptionStrip({
  items,
  wide,
  tone = "ink",
}: {
  items: string[];
  wide: boolean;
  tone?: "ink" | "cream";
}) {
  if (items.length === 0) return null;
  const color = tone === "ink" ? feed.inkDim : "rgba(255,255,255,0.72)";
  return (
    <View
      style={{
        flexDirection: wide ? "row" : "column",
        gap: wide ? space.xxl : space.sm,
      }}
    >
      {items.map((item, i) => (
        <Text
          key={i}
          style={[
            feedType.label,
            { color, ...(wide ? { flex: 1 } : null) },
          ]}
        >
          {item}
        </Text>
      ))}
    </View>
  );
}
