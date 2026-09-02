import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import {
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  space,
} from "@/lib/design/type";

/**
 * De keuzerij: één kader, een paar vakken erin, en het gekozen vak gevuld.
 *
 * Dit is de vorm die dit systeem overal voor "kies er één" gebruikt — de
 * tabstrip in de kop doet het, de licht/donker-schakelaar doet het. Eén
 * kader van 1.5px, cellen gescheiden door dezelfde lijn, geen pillen, geen
 * ronding, geen schaduw (DESIGN.md §4). Aan is een inktvlak met crème
 * erop; uit is het blad zelf.
 *
 * Hij staat hier los omdat er inmiddels twee blokken instellingen zijn die
 * er precies zo uit horen te zien. Twee keer dezelfde rij natekenen is hoe
 * ze uit de pas gaan lopen: de ene krijgt ooit een andere hoogte dan de
 * andere en niemand ziet waaróm.
 */

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Een icoon uit de set. Gebruik `glyph` als de tekening eigen is. */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Een eigen tekening, die zijn kleur van de cel krijgt. */
  glyph?: (color: string) => ReactNode;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
      }}
    >
      {options.map((option, i) => {
        const active = option.value === value;
        const tint = active ? creamOnDark.DEFAULT : feed.ink;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
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
              paddingHorizontal: space.xs,
              backgroundColor: active ? feed.ink : "transparent",
              // De scheidingslijn hoort bij het vak links ervan, zodat er
              // aan de buitenrand geen dubbele lijn op het kader valt.
              ...(i === options.length - 1
                ? null
                : { borderRightWidth: FEED_BORDER, borderRightColor: feed.ink }),
            }}
          >
            {option.glyph ? (
              option.glyph(tint)
            ) : option.icon ? (
              <Ionicons name={option.icon} size={14} color={tint} />
            ) : null}
            <Text
              style={[
                feedType.label,
                { fontSize: 12, fontWeight: "700", color: tint },
              ]}
              numberOfLines={1}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Een blok instellingen: een kop met een icoon, en eronder de rijen.
 *
 * De blokken staan onder elkaar in het persoonlijke venster en scheiden
 * zichzelf met een lijn — hetzelfde als wat `ActionSheet` tussen zijn
 * regels doet, zodat het venster van boven tot onder één ritme houdt.
 */
export function SettingBlock({
  icon,
  title,
  children,
  divider = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
  /** Een lijn erboven, voor elk blok behalve het eerste. */
  divider?: boolean;
}) {
  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        paddingVertical: space.lg,
        gap: space.md,
        ...(divider
          ? { borderTopWidth: FEED_BORDER, borderTopColor: feed.ink }
          : null),
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <Ionicons name={icon} size={20} color={feed.ink} />
        <Text
          style={[feedType.tile, { fontSize: 15, fontWeight: "700", color: feed.ink }]}
        >
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}
