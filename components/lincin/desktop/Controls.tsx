import { Pressable, Text, View } from "react-native";

import { color, useThemeSpec } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import { useT } from "@/lib/i18n";

/**
 * De schakelaar en de keuzerij van Instellingen (desktop-*-pages.dc.html,
 * `tg()` en `seg()`), thema-onafhankelijk: alleen vorm en tokens wisselen.
 *
 *   kleur     een vak van 52×28 met een inktrand, een vierkante knop van 21
 *             (zuurgeel aan, inkt uit); de keuzerij als vakken naast elkaar.
 *   magazine  een pil van 52×28 op inkt of haarlijn, een ronde knop van 22
 *             op papier; de keuzes als losse omlijnde pillen.
 *   modern    dezelfde pil met een witte knop; de keuzes in een witte pil
 *             met een schuivend inktvlak.
 */

export function Toggle({ on, onPress, label }: { on: boolean; onPress: () => void; label: string }) {
  const spec = useThemeSpec();
  const t = useT();
  const ink = color("ink");
  const kleur = spec.id === "kleur";
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label}: ${on ? t.on : t.off}`}
      onPress={onPress}
      style={{
        width: 52,
        height: 28,
        borderRadius: kleur ? 0 : 14,
        borderWidth: kleur ? spec.border : 0,
        borderColor: ink,
        backgroundColor: on ? ink : kleur ? "transparent" : color("ink", "postRule"),
      }}
    >
      <View
        style={{
          position: "absolute",
          top: kleur ? 2 : 3,
          left: kleur ? (on ? 25 : 2) : on ? 26 : 3,
          width: kleur ? 21 : 22,
          height: kleur ? 21 : 22,
          borderRadius: kleur ? 0 : 11,
          backgroundColor: kleur ? (on ? color("acid") : ink) : spec.id === "modern" ? color("tile") : color("paper"),
        }}
      />
    </Pressable>
  );
}

export function Choice<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const spec = useThemeSpec();
  const ink = color("ink");
  const th = spec.id;
  const text = (on: boolean) =>
    th === "kleur"
      ? [mono(600), { fontSize: 10, lineHeight: 13, letterSpacing: 0.8, textTransform: "uppercase" as const, color: on ? color("paper") : ink }]
      : [th === "magazine" ? sans(500) : mono(500), { fontSize: 9.5, lineHeight: 12, letterSpacing: th === "magazine" ? 1.5 : 1.14, textTransform: "uppercase" as const, color: on ? color("paper") : ink }];
  if (th === "kleur") {
    return (
      <View style={{ flexDirection: "row", borderWidth: spec.border, borderColor: ink }}>
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={{ flex: 1, height: 36, alignItems: "center", justifyContent: "center", borderLeftWidth: i ? spec.border : 0, borderLeftColor: ink, backgroundColor: on ? ink : "transparent" }}>
              <Text style={text(on)}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  if (th === "magazine") {
    return (
      <View style={{ flexDirection: "row", gap: 6 }}>
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable key={o.value} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={{ flex: 1, height: 36, borderRadius: 18, borderWidth: 1, borderColor: ink, alignItems: "center", justifyContent: "center", backgroundColor: on ? ink : "transparent" }}>
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
