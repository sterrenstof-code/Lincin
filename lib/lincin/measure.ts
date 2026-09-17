import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, type LayoutChangeEvent, type View } from "react-native";

/**
 * De maat van een vlak, betrouwbaar op web én native.
 *
 * Op web bleef `onLayout` op de bladzijde van een bijdrage soms helemaal
 * uit — de maat bleef 0 × 0 en het beeld werd nooit getekend. Daar kijkt
 * een eigen ResizeObserver naar het element; native houdt `onLayout`.
 */
export function useMeasure() {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const ref = useRef<View>(null);

  const set = useCallback((w: number, h: number) => {
    const next = { w: Math.round(w), h: Math.round(h) };
    setSize((s) => (s.w === next.w && s.h === next.h ? s : next));
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof ResizeObserver === "undefined") return;
    const el = ref.current as unknown as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    set(r.width, r.height);
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) set(box.width, box.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  });

  const onLayout = useCallback((e: LayoutChangeEvent) => set(e.nativeEvent.layout.width, e.nativeEvent.layout.height), [set]);

  return { ref, size, onLayout };
}
