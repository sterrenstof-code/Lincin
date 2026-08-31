import { Text } from "react-native";

import { feed, feedType, flameDeep, space } from "@/lib/design/type";

/**
 * Hoeveel tekens je nog hebt.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER IS
 * ---------------------------------------------------------------
 * Achttien velden in de app hebben een `maxLength` — 2000 op een
 * toelichting, 500 op een reactie, 280 op een bio — en geen enkel veld
 * zei het. Je typt gewoon door en op een gegeven moment gebeurt er niets
 * meer. Er is geen melding, geen rem, geen teller: het toetsenbord doet
 * het opeens niet, en dat leest als een kapot veld en niet als een grens.
 *
 * ---------------------------------------------------------------
 * WAAROM HIJ ER NIET ALTIJD STAAT
 * ---------------------------------------------------------------
 * Een teller die vanaf het eerste teken meeloopt maakt van schrijven een
 * wedstrijd, en dat is precies het tegenovergestelde van wat de
 * composeschermen willen zijn. Hij verschijnt daarom pas als het ertoe
 * doet — standaard bij het laatste vijfde — en dan staat er hoeveel je
 * er nog hébt, niet hoeveel je er gebruikt hebt.
 *
 * Op de grens wordt hij `flameDeep`, want dan is het geen bijschrift meer
 * maar het antwoord op de vraag waarom er niets meer bijkomt.
 */
export function CharCount({
  value,
  max,
  /** Vanaf welk deel van de limiet hij verschijnt. */
  threshold = 0.8,
  style,
}: {
  value: string;
  max: number;
  threshold?: number;
  style?: object;
}) {
  const used = value.length;
  if (used < max * threshold) return null;

  const left = max - used;
  const atLimit = left <= 0;

  return (
    <Text
      // Beleefd, niet dwingend: dit hoort je niet te onderbreken terwijl
      // je typt, maar het moet er wél zijn als je erom vraagt.
      accessibilityLiveRegion="polite"
      style={[
        feedType.caption,
        {
          color: atLimit ? flameDeep : feed.inkDim,
          textAlign: "right",
          marginTop: space.xs,
        },
        style,
      ]}
    >
      {atLimit ? "Maximum bereikt" : `Nog ${left} tekens`}
    </Text>
  );
}
