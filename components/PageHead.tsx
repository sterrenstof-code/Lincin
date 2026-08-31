import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { feed, feedType, flameDeep, space } from "@/lib/design/type";

/**
 * De kop van een pagina: kicker, titel, één zin eronder.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN ONDERDEEL IS
 * ---------------------------------------------------------------
 * De opbouw stond drie keer uitgeschreven — meldingen had hem, chats en
 * lincs niet. Die twee hielden `text-3xl font-bold`, het patroon van vóór
 * v3, en dat is precies het soort verschil dat blijft bestaan zolang het
 * nergens één plek heeft: je wisselt van tabblad en je wisselt van
 * ontwerp, terwijl er verder niets aan de pagina veranderd is.
 *
 * De kicker staat in `flameDeep` en niet in `flame`: hij is 10px, en de
 * DEFAULT haalt op het paginavlak geen 4.5:1 (DESIGN.md §2).
 *
 * `maxWidth` is niet de bladbreedte maar de leesbreedte — een kop die over
 * 1250 punten doorloopt is één regel die je hoofd moet volgen in plaats
 * van lezen.
 */
export function PageHead({
  kicker,
  title,
  intro,
  wide,
  /**
   * Eén knop naast de titel. Op een breed scherm staat hij ernaast op de
   * grondlijn, op een smal eronder — anders duwt hij de kop weg.
   *
   * Bestaat omdat de agenda hem nodig had en daarom zijn eigen kop bleef
   * uitschrijven; dan is het onderdeel er wel maar draagt het niet alles,
   * en staat de opbouw alsnog op twee plekken.
   */
  action,
  /** Ruimte onder het blok. Een pagina die meteen een lijst begint mag
   *  dichter, een pagina met rubrieken eronder hoort ruimer. */
  gap = 34,
}: {
  kicker: string;
  title: string;
  intro?: string;
  wide: boolean;
  action?: ReactNode;
  gap?: number;
}) {
  return (
    <View style={{ marginBottom: gap }}>
      <Text
        style={[
          feedType.kicker,
          { color: flameDeep, letterSpacing: 0.55, marginBottom: 10 },
        ]}
      >
        {kicker.toUpperCase()}
      </Text>
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          justifyContent: "space-between",
          alignItems: wide ? "flex-end" : "flex-start",
        }}
      >
        <Text
          style={[
            wide ? feedType.hero : feedType.heroSmall,
            { color: feed.ink, maxWidth: 620 },
          ]}
        >
          {title}
        </Text>
        {action ? (
          <View style={{ marginTop: wide ? 0 : space.lg }}>{action}</View>
        ) : null}
      </View>
      {intro ? (
        <Text
          style={[
            feedType.body,
            { color: feed.inkDim, maxWidth: 520, marginTop: space.md },
          ]}
        >
          {intro}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * De kop van een rubriek bínnen een pagina.
 *
 * Kleiner dan `SectionBand` — die is de inhoudsopgave van de feed en heeft
 * een nummer — en groter dan niets. Hier: het woord en de lijn eronder.
 * Vervangt `text-xs uppercase tracking-wider text-ink-muted`, dat op vijf
 * plekken los was uitgeschreven en op elk daarvan iets anders was.
 */
export function RubricHead({
  label,
  count,
  style,
}: {
  label: string;
  /** Staat rechts, in dezelfde trede. Voor "3" naast "Linc-verzoeken". */
  count?: number;
  style?: object;
}) {
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "baseline",
          gap: space.sm,
          marginBottom: space.md,
        },
        style,
      ]}
    >
      <Text
        style={[
          feedType.label,
          { fontSize: 12, fontWeight: "800", letterSpacing: 0.6, color: feed.ink },
        ]}
      >
        {label.toUpperCase()}
      </Text>
      {count !== undefined ? (
        <Text style={[feedType.label, { fontSize: 12, color: feed.inkDim }]}>
          {count}
        </Text>
      ) : null}
    </View>
  );
}
