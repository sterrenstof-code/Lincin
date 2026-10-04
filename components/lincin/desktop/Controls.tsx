import { Pressable, Text, View } from "react-native";

import { color, useThemeSpec } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import { useT } from "@/lib/i18n";

/**
 * De schakelaar en de keuzerij van Instellingen (desktop-*-pages.dc.html,
 * `tg()` en `seg()`), thema-onafhankelijk: alleen vorm en tokens wisselen.
 *
 *   magazine  de omslag (handoff 24 sep): een vierkant spoor van 52×28 op
 *             inkt of haarlijn met een ronde knop van 22 op papier; de
 *             keuzes als losse vierkante vakken met een lijn van 1.
 *   modern    dezelfde pil met een witte knop; de keuzes in een witte pil
 *             met een schuivend inktvlak.
 */

export function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const spec = useThemeSpec();
  const t = useT();
  const ink = color("ink");
  const mag = spec.id === "magazine";
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label}: ${on ? t.on : t.off}`}
      onPress={onPress}
      style={{
        width: 52,
        height: 28,
        borderRadius: mag ? 0 : 14,
        backgroundColor: on ? ink : color("ink", "postRule"),
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 3,
          left: on ? 26 : 3,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: spec.id === "modern" ? color("tile") : color("paper"),
        }}
      />
    </Pressable>
  );
}

export function Choice<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const spec = useThemeSpec();
  const ink = color("ink");
  const th = spec.id;
  const text = (on: boolean) => [th === "magazine" ? sans(700) : mono(500), { fontSize: th === "magazine" ? 10 : 9.5, lineHeight: 12, letterSpacing: th === "magazine" ? 1 : 1.14, textTransform: "uppercase" as const, color: on ? color("paper") : ink }];
  if (th === "magazine") {
    return (
      <View style={{ flexDirection: "row", gap: 6 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={{ flex: 1, height: 36, borderWidth: 1, borderColor: ink, alignItems: "center", justifyContent: "center", backgroundColor: on ? ink : "transparent" }}>
              <Text style={text(on)}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", padding: 4, borderRadius: 999, backgroundColor: color("tile") }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={{ flex: 1, height: 34, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: on ? ink : "transparent" }}>
            <Text style={text(on)}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
