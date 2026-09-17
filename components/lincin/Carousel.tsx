import { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";

import { SafeImage } from "@/components/SafeImage";
import { color } from "@/lib/design/theme";
import { mono } from "@/lib/design/type";
import { useImageRatio } from "@/lib/lincin/ratio";

import { PlayGlyph } from "./Media";

/**
 * Meerdere foto's onder één bijdrage (HANDOFF 2.1 §Photo carousel).
 *
 * Rand tot rand, één foto per beeld, vastklikkend op elke foto
 * (`scroll-snap-type: x mandatory` — op web maakt react-native-web dat van
 * `pagingEnabled`). Rechtsboven een teller `01 / 03`, onderaan in het
 * midden streepjes: het actieve 16px, de rest 6px.
 *
 * Een tik op een foto opent de lichtbak op díe foto (`onZoom`). Met één
 * foto is er geen teller en geen streepjes, en is het gewoon het beeld.
 *
 * `size` volgt het prototype: op een kaart zitten teller en streepjes op
 * 8px van de rand (teller 9px), op de bladzijde op 10px (teller 10px).
 *
 * `height="ratio"` (Instagram): de hoogte volgt uit de breedte en de
 * verhouding van de eerste foto, begrensd tussen 4:5 en 1.91:1; de andere
 * foto's krijgen hetzelfde kader. Zie lib/lincin/ratio.ts.
 *
 * Desktop (Lincin Desktop.dc.html, bijdrage op volle breedte) stuurt de
 * carrousel zelf met ‹ ›: `index` scrolt naar die foto, `bare` laat teller
 * en streepjes weg omdat de bladzijde ze zelf tekent.
 */

export const CHIP_BG = "rgba(10,10,9,.74)";
export const LB_PAPER = "#F2EFE8";

export function Carousel({
  uris,
  cacheKeys,
  height: heightProp,
  size = "card",
  video = false,
  onZoom,
  onIndex,
  index,
  bare = false,
}: {
  uris: (string | null)[];
  cacheKeys?: (string | undefined)[];
  /** Vast, of `"ratio"`: uit de verhouding van de eerste foto. */
  height: number | "ratio";
  size?: "card" | "page";
  /** Het voorblad van een clip: een afspeelknop erover, geen lichtbak. */
  video?: boolean;
  onZoom?: (index: number) => void;
  onIndex?: (index: number) => void;
  /** Gegeven: de carrousel scrolt naar deze foto (gestuurd van buiten). */
  index?: number;
  /** Geen teller en geen streepjes. */
  bare?: boolean;
}) {
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState(0);
  const ratio = useImageRatio(heightProp === "ratio" ? uris[0] : null, cacheKeys?.[0]);
  // Zolang de breedte niet gemeten is: vierkant op wat er is (geen hoogte 0).
  const height = heightProp === "ratio" ? (w ? Math.round(w / ratio) : undefined) : heightProp;
  const n = Math.max(1, uris.length);
  const multi = n > 1;
  const page = size === "page";
  const inset = page ? 10 : 8;
  const scroller = useRef<ScrollView>(null);
  /** Waar een gestuurde scroll heen gaat; tot hij er is tellen de tussenstanden niet. */
  const target = useRef<number | null>(null);

  useEffect(() => {
    if (index == null || !w || index === idx) return;
    target.current = index;
    scroller.current?.scrollTo({ x: index * w, animated: true });
    setIdx(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, w]);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const width = e.nativeEvent.layoutMeasurement.width || w;
    const i = Math.max(0, Math.min(n - 1, Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width))));
    if (target.current != null) {
      if (i !== target.current) return;
      target.current = null;
    }
    if (i !== idx) {
      setIdx(i);
      onIndex?.(i);
    }
  }

  const zoomable = !!onZoom && !video;
  const slide = (uri: string | null, i: number) => {
    const style = { width: w || "100%", height: height ?? "100%", backgroundColor: color("paper2") } as const;
    const image = (
      <SafeImage
        uri={uri}
        cacheKey={cacheKeys?.[i]}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        fallbackBg="bg-paper2"
        fallbackColor={color("ink", "inkDim")}
      />
    );
    // Zonder lichtbak geen knop: dan gaat de tik door naar de kaart eromheen.
    if (!zoomable) {
      return (
        <View key={`${uri ?? "leeg"}-${i}`} style={style}>
          {image}
        </View>
      );
    }
    return (
      <Pressable
        key={`${uri ?? "leeg"}-${i}`}
        accessibilityRole="imagebutton"
        accessibilityLabel={multi ? `Foto ${i + 1} van ${n}` : "Foto"}
        onPress={() => onZoom!(i)}
        style={[style, { cursor: "zoom-in" } as object]}
      >
        {image}
      </Pressable>
    );
  };

  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[
        { height, overflow: "hidden", backgroundColor: color("paper2") },
        height === undefined ? { aspectRatio: ratio } : null,
      ]}
    >
      {multi && w > 0 ? (
        <ScrollView
          ref={scroller}
          horizontal
          pagingEnabled
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={32}
          style={{ width: w, height }}
        >
          {uris.map(slide)}
        </ScrollView>
      ) : (
        slide(uris[0] ?? null, 0)
      )}

      {video ? (
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
        >
          <PlayGlyph size={44} glyph="▶" />
        </View>
      ) : null}

      {multi && !bare ? (
        <>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: inset,
              right: inset,
              backgroundColor: CHIP_BG,
              paddingVertical: page ? 4 : 3,
              paddingHorizontal: page ? 7 : 6,
            }}
          >
            <Text
              style={{
                ...mono(600),
                fontSize: page ? 10 : 9,
                lineHeight: page ? 13 : 12,
                letterSpacing: (page ? 10 : 9) * 0.08,
                color: LB_PAPER,
              }}
            >
              {two(idx + 1)} / {two(n)}
            </Text>
          </View>
          <Dashes n={n} active={idx} bottom={inset} gap={page ? 5 : 4} />
        </>
      ) : null}
    </View>
  );
}

/** De streepjes: actief 16px breed, de rest 6px, 3px hoog. */
export function Dashes({
  n,
  active,
  bottom,
  gap,
  activeW = 16,
  restW = 6,
}: {
  n: number;
  active: number;
  bottom: number;
  gap: number;
  /** Desktop tekent ze breder: 20 en 7. */
  activeW?: number;
  restW?: number;
}) {
  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", left: 0, right: 0, bottom, flexDirection: "row", justifyContent: "center", gap }}
    >
      {Array.from({ length: n }, (_, i) => (
        <View
          key={i}
          style={{ width: i === active ? activeW : restW, height: 3, backgroundColor: i === active ? LB_PAPER : "rgba(242,239,232,.45)" }}
        />
      ))}
    </View>
  );
}

function two(n: number): string {
  return String(n).padStart(2, "0");
}
