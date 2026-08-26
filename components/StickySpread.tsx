import { Platform, useWindowDimensions, View, type ViewStyle } from "react-native";
import type { ReactNode } from "react";

import { feed, FEED_BORDER, space } from "@/lib/design/type";

/**
 * De tweeluik-opmaak die de horizontale gelaagdheid doorbreekt.
 *
 *   ┌────────────────────┬──────────────────────┐
 *   │                    │  tekstblok           │
 *   │   beeld, 100vh,    │                      │
 *   │   blijft staan     │  tekstblok           │
 *   │                    │                      │
 *   │                    │  tekstblok           │
 *   └────────────────────┴──────────────────────┘
 *
 * Het beeld links blijft staan terwijl de blokken rechts eraan voorbij
 * scrollen. Dat is de klassieke redactionele scroll: één beeld draagt een
 * hele passage in plaats van dat beeld en tekst om beurten een rij vullen.
 *
 * ---------------------------------------------------------------
 * PLATFORMVERSCHIL — belangrijk
 * ---------------------------------------------------------------
 * `position: sticky` bestaat alleen op web. React Native kent het niet, en
 * er is in dit project geen bibliotheek die het nabootst (Reanimated 4 heeft
 * geen gedeelde-element- of sticky-API, en installeren kan niet vanuit een
 * cloud-sessie).
 *
 * Op native valt dit onderdeel daarom terug op een gestapelde opmaak: eerst
 * het beeld op een vaste verhouding, dan de tekst. Dat is geen kapotte
 * versie van het tweeluik maar een eigen, werkende vorm — dezelfde afweging
 * als bij `LogoMark`.
 *
 * Onder het breekpunt stapelt hij ook op web: twee kolommen van elk minder
 * dan ~380px leest slechter dan één kolom.
 */

/** Breekpunt waarboven het tweeluik echt twee kolommen wordt. */
export const SPREAD_BREAKPOINT = 900;

export function StickySpread({
  media,
  children,
  /** Verhouding beeldkolom : tekstkolom. */
  ratio = 1.1,
  /** Afstand tot de bovenkant waarop het beeld blijft plakken. */
  stickyTop = 0,
  style,
}: {
  /**
   * Het beeld links. Krijgt de volle hoogte van het venster.
   *
   * `null` is een geldige waarde en betekent: er ís geen beeld. Dan vervalt
   * de kolom, niet alleen de inhoud ervan.
   */
  media: ReactNode;
  /** De blokken rechts. */
  children: ReactNode;
  ratio?: number;
  stickyTop?: number;
  style?: ViewStyle;
}) {
  const { width, height } = useWindowDimensions();
  const twoColumn = width >= SPREAD_BREAKPOINT;
  const canStick = Platform.OS === "web";

  /**
   * Geen beeld, geen beeldkolom.
   *
   * De kolom werd altijd getekend, ook als er niets in zat: een vlak van een
   * volle vensterhoogte met een plaatshouder-icoontje erin. Bij een notitie
   * of een idee — vondsten die per definitie geen foto hebben — was dat de
   * helft van het scherm, leeg, naast de tekst waar het wél om ging.
   *
   * Een tweeluik zonder beeld is geen tweeluik. Dan is het één kolom, en die
   * mag de volle breedte hebben.
   */
  if (!media) {
    return <View style={style}>{children}</View>;
  }

  if (!twoColumn) {
    return (
      <View style={style}>
        <View
          style={{
            width: "100%",
            aspectRatio: 4 / 5,
            borderBottomWidth: FEED_BORDER,
            borderBottomColor: feed.ink,
            backgroundColor: feed.postFill,
          }}
        >
          {media}
        </View>
        <View>{children}</View>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", ...style }}>
      <View
        style={{
          flex: ratio,
          borderRightWidth: FEED_BORDER,
          borderRightColor: feed.ink,
          ...(canStick
            ? // `as any`: position "sticky" staat niet in het RN-type, maar
              // react-native-web geeft hem ongemoeid door aan de DOM.
              ({ position: "sticky", top: stickyTop } as any)
            : null),
        }}
      >
        <View
          style={{
            // 100vh min de ruimte die de kop bovenaan inneemt.
            height: Math.max(320, height - stickyTop),
            backgroundColor: feed.postFill,
          }}
        >
          {media}
        </View>
      </View>

      {/* De tekstkolom. `minWidth: 0` want anders weigert een flex-kind
          smaller te worden dan zijn inhoud en duwt het de beeldkolom weg. */}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
    </View>
  );
}

/**
 * Eén tekstblok binnen de rechterkolom van een tweeluik.
 *
 * Elk blok staat in een eigen kader met een royale binnenmarge, zodat de
 * kolom leest als een reeks kaarten die langs het beeld schuiven — niet als
 * één doorlopende lap tekst.
 */
export function SpreadBlock({
  children,
  last = false,
  filled = false,
}: {
  children: ReactNode;
  /** De laatste krijgt geen scheidingslijn onderaan. */
  last?: boolean;
  /** Plumvlak in plaats van het lavendel paginavlak. */
  filled?: boolean;
}) {
  return (
    <View
      style={{
        // Was 28/32. Een blok met een kop en twee regels eronder kreeg
        // daarmee meer lucht dan inhoud, en de kolom werd een reeks
        // vlakken in plaats van één stuk.
        paddingHorizontal: space.xl,
        paddingVertical: space.xl,
        backgroundColor: filled ? feed.post : "transparent",
        ...(last
          ? null
          : { borderBottomWidth: FEED_BORDER, borderBottomColor: feed.ink }),
      }}
    >
      {children}
    </View>
  );
}
