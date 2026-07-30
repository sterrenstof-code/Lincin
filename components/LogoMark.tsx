import { Image, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { feed, FEED_BORDER, INTER_FAMILY } from "@/lib/design/type";

/**
 * Het woordmerk als korrelplaat — NATIVE variant.
 *
 * De webversie (`LogoMark.web.tsx`) doet dit met de echte CSS-technieken uit
 * `feed-v3-merged.html`: een radiale verlooponderlaag, `feTurbulence`-korrel
 * met `mix-blend-mode: overlay`, twee gestapelde `background-clip: text`-
 * lagen voor de halftoon ín de letters (zwarte stippen op multiply, flame-
 * stippen op screen), en de lijntekening op `mix-blend-mode: difference`.
 * Geen van die technieken bestaat op native, en ze door NativeWind persen
 * levert alleen stille no-ops op.
 *
 * Deze variant benadert dezelfde plaat met wat native wél kan:
 *   1. een vooraf gerenderde, naadloos tileable korrel-PNG
 *      (`assets/images/grain.png`, 200×200) als herhalende laag;
 *   2. een vlakke, extreem vette en smal getrokken letterzetting;
 *   3. dezelfde lijntekening in react-native-svg.
 *
 * Bewust NIET gekozen: de halftoon-in-de-letters exact namaken met
 * `@react-native-masked-view/masked-view`. Dat is een extra native
 * dependency voor een stippenraster van 3px dat op telefoonformaat toch
 * dichtslibt, en de plaat leest zonder die stippen als dezelfde plaat.
 *
 * Beide varianten exporteren exact dezelfde props, zodat `feed.tsx` en de
 * zijbalk niet hoeven te weten op welk platform ze draaien.
 */
export type LogoMarkProps = {
  /** `plate` = de brede band onder de kop, `compact` = inline in een rij. */
  size?: "plate" | "compact";
};

const WORDMARK = "Lincin";

export function LogoMark({ size = "plate" }: LogoMarkProps) {
  const compact = size === "compact";
  const height = compact ? 56 : 150;
  const fontSize = compact ? 26 : 64;

  return (
    <View
      style={{
        height,
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        // Vlakke benadering van de radiale verlooponderlaag van de webversie.
        backgroundColor: "#17181B",
        overflow: "hidden",
        justifyContent: "center",
      }}
    >
      {/* Korrel. `repeat` tilet de 200×200-PNG over het hele vlak. De Image
          zit in een View omdat `pointerEvents` in deze RN-versie noch als
          Image-prop noch in ImageStyle bestaat — alleen op View. */}
      <View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      >
        <Image
          source={require("../assets/images/grain.png")}
          resizeMode="repeat"
          style={{ width: "100%", height: "100%", opacity: 0.3 }}
        />
      </View>

      {/* Het woordmerk: links uitgelijnd, kapitaal, smal getrokken.
          De translateX corrigeert de scaleX, die vanuit het midden werkt
          terwijl de webversie `transform-origin: left top` gebruikt. */}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={{
          marginLeft: compact ? 14 : 28,
          fontFamily: INTER_FAMILY,
          fontWeight: "900",
          fontSize,
          lineHeight: fontSize * 0.98,
          letterSpacing: -fontSize * 0.03,
          color: "#FAF8F5",
          alignSelf: "flex-start",
          transform: [{ scaleX: 0.82 }, { translateX: -fontSize * 0.55 }],
        }}
      >
        {WORDMARK.toUpperCase()}
      </Text>

      {/* De lijntekening rechtsonder — het "verbonden draad"-motief. */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: compact ? 12 : 36,
          bottom: compact ? -6 : -10,
          opacity: 0.9,
        }}
      >
        <Svg
          width={compact ? 64 : 150}
          height={compact ? 55 : 128}
          viewBox="0 0 260 220"
        >
          <Path
            d="M20 200 C 60 160, 40 120, 90 100 C 130 84, 120 40, 160 20"
            stroke="#FAF8F5"
            strokeWidth={1.6}
            fill="none"
          />
          <Path
            d="M90 100 C 110 130, 150 130, 170 160 C 190 185, 220 175, 240 200"
            stroke="#FAF8F5"
            strokeWidth={1.6}
            fill="none"
          />
          <Circle cx={160} cy={20} r={5} stroke="#FAF8F5" strokeWidth={1.6} fill="none" />
          <Circle cx={90} cy={100} r={4} stroke="#FAF8F5" strokeWidth={1.6} fill="none" />
        </Svg>
      </View>

      {compact ? null : (
        <Text
          style={{
            position: "absolute",
            left: 28,
            bottom: 14,
            fontFamily: INTER_FAMILY,
            fontSize: 11,
            letterSpacing: 0.55,
            color: "rgba(250,248,245,0.65)",
          }}
        >
          Link up.
        </Text>
      )}
    </View>
  );
}
