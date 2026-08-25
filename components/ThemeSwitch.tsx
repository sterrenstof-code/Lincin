import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import {
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  space,
} from "@/lib/design/type";
import {
  setPreference,
  usePreference,
  type ThemePreference,
} from "@/lib/design/theme";

/**
 * De schakelaar tussen de twee standen.
 *
 * Drie standen en geen twee: `Auto` volgt het besturingssysteem, en dat is
 * waar de app op begint. Wie zijn telefoon 's avonds op donker zet
 * verwacht dat een app meegaat; wie dat niet wil, kiest hier één keer een
 * kant en dan blijft het daarbij.
 *
 * De vorm is die van elke andere keuzerij in dit systeem: één kader van
 * 1.5px, drie vakken erin, gescheiden door dezelfde lijn. Geen pillen,
 * geen ronding, geen schaduw — zie DESIGN.md §4. Het gekozen vak is een
 * gevuld inktvlak, want dat is hoe "aan" er in deze app overal uitziet
 * (de tabs in de kop doen precies hetzelfde).
 *
 * Hij staat in het persoonlijke menu achter je avatar. Dat is waar alles
 * woont wat over jou gaat en niet over de uitgave — je meldingen, je
 * profiel, en dus ook hoe de uitgave er voor jóu uitziet.
 */

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "system", label: "Auto", icon: "phone-portrait-outline" },
  { value: "light", label: "Licht", icon: "sunny-outline" },
  { value: "dark", label: "Donker", icon: "moon-outline" },
];

export function ThemeSwitch() {
  const preference = usePreference();

  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingVertical: space.lg,
        gap: space.md,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Ionicons name="contrast-outline" size={20} color={feed.ink} />
        <Text
          style={[feedType.tile, { fontSize: 15, fontWeight: "700", color: feed.ink }]}
        >
          Weergave
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          borderWidth: FEED_BORDER,
          borderColor: feed.ink,
        }}
      >
        {OPTIONS.map((option, i) => {
          const active = preference === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => setPreference(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={option.label}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: space.xs,
                paddingVertical: space.md,
                backgroundColor: active ? feed.ink : "transparent",
                // De scheidingslijn hoort bij het vak links ervan, zodat er
                // aan de buitenrand geen dubbele lijn op het kader valt.
                ...(i === OPTIONS.length - 1
                  ? null
                  : { borderRightWidth: FEED_BORDER, borderRightColor: feed.ink }),
              }}
            >
              <Ionicons
                name={option.icon}
                size={14}
                color={active ? creamOnDark.DEFAULT : feed.ink}
              />
              <Text
                style={[
                  feedType.label,
                  {
                    fontSize: 12,
                    fontWeight: "700",
                    color: active ? creamOnDark.DEFAULT : feed.ink,
                  },
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
