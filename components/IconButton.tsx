import { Ionicons } from "@expo/vector-icons";
import { Pressable, type StyleProp, type ViewStyle } from "react-native";

import { CONTROL_H, feed } from "@/lib/design/type";

/**
 * Een knop die alleen een icoon is.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER IS
 * ---------------------------------------------------------------
 * DESIGN.md §7 stelt twee eisen aan zo'n knop: hij heeft een naam, en
 * hij is minstens `CONTROL_H` (44) groot. Voor de tweede eis stond op
 * vijfentachtig plekken `hitSlop` — en §7 zegt er zelf bij waarom dat
 * niet volstaat: **`hitSlop` doet niets op web.** react-native-web laat
 * de prop vallen. Daar telt alleen de échte maat.
 *
 * Web is het hoofdplatform van deze app. Een wisknopje van 18 punten met
 * `hitSlop={8}` is op een telefoon dus 34 en in de browser 18 — en de
 * browser is waar het meeste gebruik zit. Dat verschil is onzichtbaar
 * zolang je met een muis test, want een muis raakt 18 punten prima.
 *
 * Vandaar één onderdeel met een échte doos. De doos is de knop; het
 * icoon staat erin. Wat je aantikt is wat je ziet plus de marge eromheen,
 * op élk platform hetzelfde.
 *
 * ---------------------------------------------------------------
 * DE BUURMAN
 * ---------------------------------------------------------------
 * §7 waarschuwt ook voor het andere uiterste: een groter raakvlak dat
 * over zijn buur heen ligt maakt het erger. De latere broer wint het
 * raken, dus een wiskruisje naast een invoerveld wist je tekst terwijl
 * je je cursor probeerde te zetten.
 *
 * Een doos kan dat niet: hij duwt in plaats van te overlappen. Dat is
 * precies waarom dit een doos is en geen grotere `hitSlop`.
 *
 * ---------------------------------------------------------------
 * `size` IS HET ICOON, NIET DE KNOP
 * ---------------------------------------------------------------
 * De knop is altijd 44. `size` bepaalt alleen hoe groot het glyph erin
 * staat — anders zou een kleiner icoon stilletjes een kleiner raakvlak
 * meebrengen, en dat is nu juist wat hier misging.
 */
export function IconButton({
  name,
  label,
  onPress,
  size = 18,
  color = feed.ink,
  disabled = false,
  /**
   * De knop mag smaller dan 44 zijn als hij in een rij staat die zelf al
   * 44 hoog is en er ruimte omheen zit. Blijft altijd minstens 44 hoog —
   * verticaal is er zelden ruimte te winnen en juist daar mist een
   * duimtik het vaakst.
   */
  dense = false,
  style,
}: {
  name: keyof typeof Ionicons.glyphMap;
  /** Zonder dit staat er voor wie hem niet ziet letterlijk niets (§7). */
  label: string;
  onPress: () => void;
  size?: number;
  color?: string;
  disabled?: boolean;
  dense?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          minWidth: dense ? 36 : CONTROL_H,
          height: CONTROL_H,
          alignItems: "center",
          justifyContent: "center",
          // Geen vulling: §4 houdt het gevulde vlak voor de primaire
          // actie. Ingedrukt zakt het icoon in dekking in plaats van dat
          // er een vlak onder verschijnt.
          opacity: disabled ? 0.4 : pressed ? 0.55 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}
