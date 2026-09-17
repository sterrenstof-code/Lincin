import { useEffect, useState, useSyncExternalStore } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SafeImage } from "@/components/SafeImage";
import { mono, serif } from "@/lib/design/type";
import { useT } from "@/lib/i18n";

import { LB_PAPER } from "./Carousel";

/**
 * De lichtbak (HANDOFF 2.1 §Lightbox).
 *
 * Een tik op een foto of krabbel — op een kaart, op de bladzijde — legt hem
 * schermvullend over de app: een inktgrond op 92%, bovenaan een mono-regel
 * `№ 01 · Noor · foto · 22:41` met een omlijnd ×, in het midden het beeld,
 * onderaan de titel en `3024 × 4032 px · staand`.
 *
 * Het kader is ALTIJD de volle breedte, rand tot rand. Zijn hoogte komt uit
 * de echte pixelverhouding van het beeld, gelezen zodra het geladen is
 * (terugval: 3:2 voor een foto, 3:4 voor een krabbel, 1:1 voor een hoes).
 * Liggend blijft dus laag, staand hoog, en er komt nooit een zwarte rand
 * naast: `cover` in een kader met precies de verhouding van het beeld.
 * Te hoog voor het scherm? Dan scrolt het midden.
 *
 * Met meerdere foto's wordt het een diavoorstelling: ‹ › over het beeld,
 * `01 / 03` in de bovenbalk, een filmstrook van 52px onder het bijschrift,
 * ← → op het toetsenbord, en hij opent op de foto waarop je tikte.
 * Sluiten: tik op de grond, ×, of Escape.
 *
 * Eén exemplaar voor de hele app (`LightboxHost` in `app/_layout.tsx`);
 * wie hem opent roept `openLightbox()`.
 */

export type LightboxPayload = {
  uris: (string | null)[];
  cacheKeys?: (string | undefined)[];
  index?: number;
  /** "01" — het nummer van de bijdrage; weggelaten als het er niet is. */
  number?: string | null;
  author: string;
  /** "foto", "krabbel", "muziek"… — ook voor de terugvalverhouding. */
  kind: string;
  time: string;
  title: string;
};

// ---- de toestand, buiten React: elke kaart kan hem openen ----

let current: LightboxPayload | null = null;
const listeners = new Set<() => void>();

export function openLightbox(p: LightboxPayload) {
  current = { ...p, index: Math.max(0, Math.min((p.uris.length || 1) - 1, p.index ?? 0)) };
  listeners.forEach((fn) => fn());
}

/** Staat de lichtbak open? De desktopbladzijde sluit dan niet mee op Escape. */
export function isLightboxOpen(): boolean {
  return current !== null;
}

export function closeLightbox() {
  current = null;
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const read = () => current;

// ---- het beeld ----

const GROUND = "rgba(10,10,9,.92)";
const FRAME_BG = "#141413";
const PAPER_DIM = "rgba(242,239,232,.6)";

function fallbackRatio(kind: string): number {
  if (kind === "krabbel") return 3 / 4;
  if (kind === "muziek") return 1;
  return 3 / 2;
}

export function LightboxHost() {
  const payload = useSyncExternalStore(subscribe, read, read);
  if (!payload) return null;
  // Een sleutel per opening: de index en de gemeten maten beginnen opnieuw.
  return <LightboxView key={`${payload.uris.join("|")}#${payload.index}`} p={payload} />;
}

function LightboxView({ p }: { p: LightboxPayload }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const n = Math.max(1, p.uris.length);
  const multi = n > 1;
  const [idx, setIdx] = useState(p.index ?? 0);
  const [dims, setDims] = useState<Record<number, { w: number; h: number }>>({});

  const step = (d: number) => setIdx((i) => (i + d + n) % n);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox();
      else if (multi && e.key === "ArrowRight") step(1);
      else if (multi && e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [multi, n]);

  const d = dims[idx];
  const ratio = d && d.w && d.h ? d.w / d.h : fallbackRatio(p.kind);
  const orient = d
    ? d.w > d.h * 1.04
      ? t.landscape
      : d.h > d.w * 1.04
        ? t.portrait
        : t.square
    : t.noImage;
  const meta = [p.number ? `№ ${p.number}` : null, p.author, p.kind, p.time].filter(Boolean).join(" · ");
  const counter = multi ? `${two(idx + 1)} / ${two(n)}` : "";

  const metaStyle = {
    ...mono(500),
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1,
    textTransform: "uppercase" as const,
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={closeLightbox} statusBarTranslucent>
      <Pressable
        accessibilityLabel="Sluit"
        onPress={closeLightbox}
        style={[
          { flex: 1, backgroundColor: GROUND, paddingTop: Math.max(insets.top, 12) + 10 },
          Platform.OS === "web" ? ({ cursor: "zoom-out" } as object) : null,
        ]}
      >
        {/* bovenbalk */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
            paddingBottom: 12,
          }}
        >
          <Text numberOfLines={1} style={[metaStyle, { color: LB_PAPER, flex: 1, minWidth: 0 }]}>
            {meta}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {counter ? <Text style={[metaStyle, { color: PAPER_DIM }]}>{counter}</Text> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sluit"
              onPress={closeLightbox}
              hitSlop={8}
              style={{ width: 30, height: 30, borderWidth: 1.5, borderColor: LB_PAPER, alignItems: "center", justifyContent: "center" }}
            >
              <Text style={{ color: LB_PAPER, fontSize: 15, lineHeight: 18 }}>×</Text>
            </Pressable>
          </View>
        </View>

        {/* het beeld: volle breedte, hoogte uit de eigen verhouding */}
        <View style={{ flex: 1, minHeight: 0 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              onPress={() => {}}
              style={[
                { width, height: width / ratio, backgroundColor: FRAME_BG },
                Platform.OS === "web" ? ({ cursor: "default" } as object) : null,
              ]}
            >
              <SafeImage
                key={idx}
                uri={p.uris[idx]}
                cacheKey={p.cacheKeys?.[idx]}
                style={{ width: "100%", height: "100%" }}
                contentFit="cover"
                fallbackBg="bg-ink"
                fallbackColor={PAPER_DIM}
                onLoad={(e) => {
                  const { width: w, height: h } = e.source ?? { width: 0, height: 0 };
                  if (w && h) setDims((m) => (m[idx]?.w === w && m[idx]?.h === h ? m : { ...m, [idx]: { w, h } }));
                }}
              />
            </Pressable>
          </ScrollView>
          {multi ? (
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 10,
              }}
            >
              <StepBtn glyph="‹" label="Vorige" onPress={() => step(-1)} />
              <StepBtn glyph="›" label="Volgende" onPress={() => step(1)} />
            </View>
          ) : null}
        </View>

        {/* onderaan: filmstrook, titel, maten */}
        <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: Math.max(insets.bottom, 16) + 14, gap: 10 }}>
          {multi ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {p.uris.map((uri, j) => {
                const on = j === idx;
                return (
                  <Pressable
                    key={j}
                    accessibilityRole="button"
                    accessibilityLabel={`Foto ${j + 1}`}
                    accessibilityState={{ selected: on }}
                    onPress={() => setIdx(j)}
                    style={{
                      width: 52,
                      height: 52,
                      borderWidth: 1.5,
                      borderColor: on ? LB_PAPER : "rgba(242,239,232,.28)",
                      opacity: on ? 1 : 0.5,
                      backgroundColor: FRAME_BG,
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {uri ? (
                      <SafeImage uri={uri} cacheKey={p.cacheKeys?.[j]} style={{ width: "100%", height: "100%" }} contentFit="cover" skeleton={false} />
                    ) : (
                      <Text style={{ ...mono(600), fontSize: 10, color: "rgba(242,239,232,.7)" }}>{two(j + 1)}</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <View style={{ gap: 6 }}>
            {p.title ? <Text style={{ ...serif(), fontSize: 24, lineHeight: 25, color: LB_PAPER }}>{p.title}</Text> : null}
            <Text style={[metaStyle, { color: PAPER_DIM }]}>
              {d ? `${d.w} × ${d.h} px · ` : ""}
              {orient}
            </Text>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function StepBtn({ glyph, label, onPress }: { glyph: string; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: 40,
        height: 40,
        borderWidth: 1.5,
        borderColor: "rgba(242,239,232,.6)",
        backgroundColor: "rgba(10,10,9,.5)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: LB_PAPER, fontSize: 17, lineHeight: 20 }}>{glyph}</Text>
    </Pressable>
  );
}

function two(n: number): string {
  return String(n).padStart(2, "0");
}
