import { useState, type ReactNode } from "react";
import { Pressable, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

import { SafeImage } from "@/components/SafeImage";
import type { Compose } from "@/app/post-compose";
import { MAX_PHOTOS } from "@/lib/lincin/compose";
import { color, line } from "@/lib/design/theme";
import { mono } from "@/lib/design/type";

import { BORDER, Serif } from "../ui";

/**
 * Het beeldvak van Nieuwe bijdrage met meerdere foto's (HANDOFF 2.1 §8).
 *
 * Bovenaan een carrousel van vakken — één per foto, vastklikkend — en
 * daaronder een balk van 36px: links `01 / 03 · sleep meerdere foto's —
 * tot 6`, rechts `−` (haalt de laatste weg) en `+ foto erbij` (tot zes).
 * Een leeg vak opent de fotokiezer.
 */
export function PhotoSlots({
  c,
  placeholder,
  preview = null,
  emptyPicks = true,
}: {
  c: Compose;
  placeholder: string;
  /** Wat het lege vak toont in plaats van de placeholder (tekst, linkbeeld). */
  preview?: ReactNode;
  /** Opent een tik op het lege vak de fotokiezer? Ja bij foto en krabbel. */
  emptyPicks?: boolean;
}) {
  const { t, imageUris, addPhotos, removePhoto } = c;
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const n = imageUris.length;
  const slots: (string | null)[] = n ? imageUris : [null];
  const current = Math.min(idx, slots.length - 1);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const width = e.nativeEvent.layoutMeasurement.width || w;
    const i = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (i !== idx) setIdx(i);
  }

  const bar = { ...mono(500), fontSize: 9, lineHeight: 12, letterSpacing: 0.72, textTransform: "uppercase" as const };

  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flex: 1, minHeight: 0, backgroundColor: color("paper2") }}>
        {w > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={32}
            style={{ flex: 1 }}
          >
            {slots.map((uri, i) => (
              <Pressable
                key={`${uri ?? "leeg"}-${i}`}
                accessibilityRole="button"
                accessibilityLabel={uri ? `Foto ${i + 1}` : "Kies een beeld"}
                onPress={uri || !emptyPicks ? undefined : addPhotos}
                style={{ width: w, height: "100%", alignItems: "center", justifyContent: "center", padding: uri || preview ? 0 : 16 }}
              >
                {uri ? (
                  // Hele foto, niet bijgesneden: dit is waar je kiest wat je
                  // plaatst, en een kader dat de randen wegsnijdt laat je
                  // denken dat je foto zo verminkt online komt.
                  <SafeImage uri={uri} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                ) : preview ? (
                  preview
                ) : (
                  <Serif variant="aside" tone="dim" style={{ textAlign: "center" }}>
                    {placeholder}
                  </Serif>
                )}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
      <View
        style={{
          height: 36,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          paddingHorizontal: 8,
          borderTopWidth: BORDER,
          borderTopColor: line(),
        }}
      >
        <Text numberOfLines={1} style={[bar, { flex: 1, minWidth: 0, color: color("ink", "inkDim") }]}>
          {n > 1 ? `${two(current + 1)} / ${two(n)} · ${t.dropMany}` : t.dropMany}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {n > 1 ? <BarBtn label="−" onPress={() => { removePhoto(); setIdx(0); }} style={bar} /> : null}
          {n < MAX_PHOTOS ? <BarBtn label={`+ ${t.addPhoto}`} onPress={addPhotos} style={bar} /> : null}
        </View>
      </View>
    </View>
  );
}

function BarBtn({ label, onPress, style }: { label: string; onPress: () => void; style: object }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      hitSlop={6}
      style={{ borderWidth: BORDER, borderColor: line(), paddingVertical: 2, paddingHorizontal: 6 }}
    >
      <Text style={[style, { color: color("ink") }]}>{label}</Text>
    </Pressable>
  );
}

function two(n: number): string {
  return String(n).padStart(2, "0");
}
