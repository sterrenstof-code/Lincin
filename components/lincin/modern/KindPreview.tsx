import { Text, View } from "react-native";

import { SafeImage } from "@/components/SafeImage";
import { color, friendColor, hueFor, type Scheme } from "@/lib/design/theme";
import { mono, sans, serif } from "@/lib/design/type";
import type { CardPost } from "@/lib/lincin/model";

/**
 * Wat een bijdrage laat zien als er geen foto is (2.2 §1 en §5).
 *
 * "Niet-fotobijdragen tonen hun eigen preview": een golfvorm voor spraak,
 * balken voor een poll, een plattegrondraster voor een plek, een
 * tekstfragment voor tekst. Zo is een tegel of een beeldkolom nooit een
 * leeg vlak met alleen een soortnaam.
 *
 * De vlakken staan in de kleur van de vriend, en de tekst erop in de INKT
 * DIE BIJ DIE KLEUR HOORT — nooit de globale inkt (2.2 §5: contrast). Op
 * blauw en groen is dat papier, op oker en zuur is het zwart; `friendColor`
 * weet het per stand.
 *
 * `variant` bepaalt het papier waarop de preview staat:
 *   `kleur`  het kleurvlak zelf draagt de preview — modern.
 *   `papier` de preview staat op papier naast het kleurvlak — magazine,
 *            waar de spread al in de vriendkleur is.
 */

export type PreviewVariant = "kleur" | "papier";

export function KindPreview({
  post,
  scheme,
  fill = false,
  variant = "kleur",
}: {
  post: CardPost;
  scheme: Scheme;
  /** Het beeld vult het hele vlak (het hero). */
  fill?: boolean;
  variant?: PreviewVariant;
}) {
  const fc = friendColor(hueFor(post.authorId), scheme);
  const m = post.media;

  // Op een kleurvlak: het vlak van de vriend met zijn eigen inkt erop.
  // Op papier: het papier met de globale inkt, en het kleurvlak als accent.
  const bg = variant === "kleur" ? fc.fill : color("paper");
  const fg = variant === "kleur" ? fc.ink : color("ink");
  const accent = variant === "kleur" ? fc.ink : fc.fill;

  if (m.kind === "foto" && m.uri) {
    return <SafeImage uri={m.uri} cacheKey={m.cacheKey} style={{ width: "100%", height: "100%" }} contentFit="cover" />;
  }

  if (m.kind === "muziek") {
    return (
      <View style={{ flex: 1, flexDirection: "row" }}>
        <View style={{ flexBasis: "56%", flexGrow: 0 }}>
          {m.cover ? (
            <SafeImage uri={m.cover} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <View style={{ flex: 1, backgroundColor: bg }} />
          )}
        </View>
        <View style={{ flex: 1, minWidth: 0, padding: 12, backgroundColor: bg, justifyContent: "flex-end", gap: 5 }}>
          <Text numberOfLines={1} style={{ ...sans(500), fontSize: 12, lineHeight: 15, color: fg }}>
            {m.track}
          </Text>
          <Text numberOfLines={1} style={{ ...mono(500), fontSize: 8.5, lineHeight: 11, letterSpacing: 1.02, textTransform: "uppercase", color: fg, opacity: 0.75 }}>
            {m.artist}
          </Text>
        </View>
      </View>
    );
  }

  if (m.kind === "spraak") {
    // De hoogtes zijn afgeleid van het id, zodat dezelfde bijdrage altijd
    // dezelfde golf heeft (HANDOFF §Media kinds: "deterministic per post").
    const bars = waveform(post.id, 18);
    return (
      <View style={{ flex: 1, padding: 14, backgroundColor: bg, justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 2, height: fill ? 90 : 50 }}>
          {bars.map((h, i) => (
            <View key={i} style={{ flex: 1, height: `${h}%`, backgroundColor: fg, opacity: 0.75, borderRadius: 2 }} />
          ))}
        </View>
        <Text style={{ ...mono(500), fontSize: 9, lineHeight: 12, letterSpacing: 1.26, textTransform: "uppercase", color: fg }}>
          ▶ {m.duration}
        </Text>
      </View>
    );
  }

  if (m.kind === "poll") {
    // Dezelfde rekensom als de pollbalken op een kaart (`Media.tsx`): het
    // aandeel per keuze, afgerond, met de twee grootste vooraan.
    const total = m.poll.total_votes || m.poll.options.reduce((n, o) => n + o.vote_count, 0);
    const shares = m.poll.options
      .map((o) => ({ label: o.label, pct: total ? Math.round((o.vote_count / total) * 100) : 0 }))
      .slice(0, 2);
    return (
      <View style={{ flex: 1, padding: 14, backgroundColor: bg, justifyContent: "center", gap: 9 }}>
        {shares.map((o, i) => (
          <View key={i} style={{ gap: 4 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text numberOfLines={1} style={{ flex: 1, ...mono(500), fontSize: 9, lineHeight: 12, letterSpacing: 0.9, textTransform: "uppercase", color: fg }}>
                {o.label}
              </Text>
              <Text style={{ ...mono(500), fontSize: 9, lineHeight: 12, letterSpacing: 0.9, color: fg }}>{o.pct}%</Text>
            </View>
            <View style={{ height: 4, borderRadius: 2, backgroundColor: fg, opacity: 0.28, width: `${Math.max(4, o.pct)}%` }} />
          </View>
        ))}
      </View>
    );
  }

  if (m.kind === "plek") {
    return (
      <View style={{ flex: 1, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
        <MapGrid tone={fg} />
        <View style={{ width: 13, height: 13, borderRadius: 6.5, backgroundColor: fg }} />
      </View>
    );
  }

  if (m.kind === "tekst") {
    return (
      <View style={{ flex: 1, padding: 14, backgroundColor: bg }}>
        <Text
          numberOfLines={fill ? 10 : 6}
          style={
            variant === "papier"
              ? { ...serif(), fontSize: 13, lineHeight: 17.5, color: fg }
              : { ...sans(400), fontSize: 12, lineHeight: 16.5, color: fg }
          }
        >
          {m.text}
        </Text>
      </View>
    );
  }

  if (m.kind === "kleur") {
    return <View style={{ flex: 1, backgroundColor: m.hex }} />;
  }

  if (m.kind === "link" && m.image) {
    return <SafeImage uri={m.image} style={{ width: "100%", height: "100%" }} contentFit="cover" />;
  }

  // Alles wat geen eigen vorm heeft: de soort boven, een fragment onder.
  const excerpt = (post.body || post.caption || post.title || "").slice(0, 150);
  return (
    <View style={{ flex: 1, padding: 14, backgroundColor: bg, justifyContent: "space-between" }}>
      <Text style={{ ...mono(500), fontSize: 9, lineHeight: 12, letterSpacing: 1.26, textTransform: "uppercase", color: fg, opacity: 0.8 }}>
        {post.kind}
      </Text>
      <Text numberOfLines={fill ? 6 : 3} style={{ ...sans(400), fontSize: 12, lineHeight: 16.2, color: fg }}>
        {excerpt}
      </Text>
      {/* `accent` houdt de kleur van de vriend ook op papier in beeld. */}
      <View style={{ height: 3, backgroundColor: accent, opacity: variant === "papier" ? 1 : 0.4 }} />
    </View>
  );
}

/** Het raster van een plattegrond: lijnen om de 18 px. */
function MapGrid({ tone }: { tone: string }) {
  const lines = [] as React.ReactNode[];
  for (let i = 1; i < 10; i++) {
    lines.push(
      <View key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: i * 18, height: 1, backgroundColor: tone, opacity: 0.16 }} />,
    );
    lines.push(
      <View key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: i * 18, width: 1, backgroundColor: tone, opacity: 0.16 }} />,
    );
  }
  return <View style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0 }}>{lines}</View>;
}

/**
 * Een golfvorm die bij één bijdrage hoort en niet per beeld verspringt:
 * dezelfde hash als `defaultHueFor`, uitgerold over `n` staven.
 */
function waveform(id: string, n: number): number[] {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    h = (h * 1103515245 + 12345) >>> 0;
    out.push(24 + (h % 76));
  }
  return out;
}
