import { useEffect, useRef, useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";

import { SafeImage } from "@/components/SafeImage";
import { ON_LIGHT, color, friendColor, line, type Hue, useScheme } from "@/lib/design/theme";
import { lincinType, sans, serif } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { waveform, type CardMedia } from "@/lib/lincin/model";

import { Carousel } from "./Carousel";
import { openLightbox, type LightboxPayload } from "./Lightbox";
import { BORDER, Head, Mono, Serif } from "./ui";

/** Wat de lichtbak over een foto vertelt, naast de foto's zelf. */
type ZoomMeta = Omit<LightboxPayload, "uris" | "cacheKeys" | "index">;

/**
 * De mediasoorten van een kaart (README §Media kinds).
 *
 * 150px hoog op een kaart, 300px op de bladzijde. Elke soort tekent
 * zichzelf op het tweede vlak (`paper2`); een foto vult het vlak.
 */
/** Hoe lang een tik wacht op een tweede, voor hij als enkele tik telt. */
const DOUBLE_TAP_MS = 280;

/**
 * Een tik: zonder `onDouble` meteen `single`. Met: wacht of er een tweede
 * komt — dan `onDouble` en geen `single` — anders na `DOUBLE_TAP_MS`
 * alsnog `single`.
 */
export function useDoubleTap(onDouble?: () => void) {
  const last = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);
  return (single: () => void) => {
    if (!onDouble) return single();
    const now = Date.now();
    if (now - last.current < DOUBLE_TAP_MS) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      last.current = 0;
      onDouble();
      return;
    }
    last.current = now;
    timer.current = setTimeout(() => {
      timer.current = null;
      single();
    }, DOUBLE_TAP_MS);
  };
}

export function Media({
  media,
  height,
  hue,
  postId,
  myUserId,
  size = "card",
  zoom,
  photoFit,
  maxPhotoH,
  onDoubleTap,
}: {
  media: CardMedia;
  height: number;
  hue: Hue;
  postId: string;
  myUserId: string;
  /** Kaart (150) of bladzijde (300): de maat van teller en streepjes. */
  size?: "card" | "page";
  /** Gegeven: een tik op de foto opent de lichtbak (HANDOFF 2.1). */
  zoom?: ZoomMeta;
  /**
   * `ratio`: een foto krijgt zijn eigen verhouding (Instagram, 4:5–1.91:1)
   * in plaats van `height`. De andere soorten houden `height`.
   */
  photoFit?: "ratio";
  /** Met `photoFit`: de foto nooit hoger dan dit. */
  maxPhotoH?: number;
  /**
   * Dubbeltik op de foto (HANDOFF: dubbeltik = like). Gegeven, dan wacht
   * een enkele tik even of er een tweede komt, en opent pas daarna de
   * lichtbak.
   */
  onDoubleTap?: () => void;
}) {
  const zoomTo = useDoubleTap(onDoubleTap);
  switch (media.kind) {
    case "foto":
      return (
        <Carousel
          uris={media.uris}
          cacheKeys={media.cacheKeys}
          height={photoFit === "ratio" ? "ratio" : height}
          maxHeight={maxPhotoH}
          size={size}
          video={media.video}
          onZoom={
            zoom || onDoubleTap
              ? (index) => zoomTo(() => (zoom ? openLightbox({ ...zoom, uris: media.uris, cacheKeys: media.cacheKeys, index }) : undefined))
              : undefined
          }
        />
      );
    case "tekst":
      return <TextBlock text={media.text} height={height} />;
    case "poll":
      return <Poll media={media} height={height} hue={hue} myUserId={myUserId} />;
    case "muziek":
      return (
        <Duo
          cover={media.cover}
          title={media.track}
          sub={media.artist}
          url={media.url}
          glyph="▶"
          height={height}
          italicSub
        />
      );
    case "link":
      return <Duo cover={media.image} title={media.title} sub={media.site} url={media.url} glyph="→" height={height} />;
    case "kleur":
      return (
        <View style={{ height, backgroundColor: media.hex, justifyContent: "flex-end", padding: 10 }}>
          <Mono variant="tiny" style={{ color: ON_LIGHT, opacity: 0.7 }}>
            {media.hex}
          </Mono>
        </View>
      );
    case "plek":
      return <Place place={media.place} coords={media.coords} height={height} hue={hue} />;
    case "spraak":
      return <Voice duration={media.duration} height={height} seed={postId} />;
    default:
      return <View style={{ height, backgroundColor: color("paper2") }} />;
  }
}

function TextBlock({ text, height }: { text: string; height: number }) {
  const lines = Math.max(1, Math.floor((height - 28) / lincinType.quote.lineHeight!));
  return (
    <View style={{ height, backgroundColor: color("paper2"), paddingVertical: 14, paddingHorizontal: 16, justifyContent: "center" }}>
      <Serif variant="quote" numberOfLines={lines}>
        {text}
      </Serif>
    </View>
  );
}

/** De ronde afspeelknop: de enige ronding naast de avatar. */
export function PlayGlyph({ size, glyph, onPress }: { size: number; glyph: string; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={onPress ? "Afspelen" : undefined}
      onPress={onPress}
      hitSlop={6}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color("ink"),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: color("paper"), fontSize: Math.round(size * 0.36), lineHeight: Math.round(size * 0.45) }}>{glyph}</Text>
    </Pressable>
  );
}

/** Muziek en link: hoes links, tekst en een knop rechts. */
function Duo({
  cover,
  title,
  sub,
  url,
  glyph,
  height,
  italicSub = false,
}: {
  cover: string | null;
  title: string;
  sub: string;
  url: string | null;
  glyph: string;
  height: number;
  italicSub?: boolean;
}) {
  const open = () => {
    if (url) Linking.openURL(url).catch(() => {});
  };
  return (
    <View style={{ height, flexDirection: "row" }}>
      {cover ? (
        <View style={{ width: height, borderRightWidth: BORDER, borderRightColor: line(), backgroundColor: color("paper2") }}>
          <SafeImage uri={cover} style={{ width: "100%", height: "100%" }} contentFit="cover" fallbackBg="bg-paper2" />
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0, backgroundColor: color("paper2"), padding: 12, justifyContent: "space-between" }}>
        <View>
          <Head variant="track" numberOfLines={2}>
            {title}
          </Head>
          {sub ? (
            <Serif variant={italicSub ? "asideSmall" : "asideSmall"} numberOfLines={1} style={{ marginTop: 4 }}>
              {sub}
            </Serif>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <PlayGlyph size={32} glyph={glyph} onPress={open} />
          <View style={{ flex: 1, height: BORDER, backgroundColor: color("ink", "postRule") }} />
        </View>
      </View>
    </View>
  );
}

/** Stemmen op een kaart: balken, de eigen stem in de vriendkleur. */
/**
 * Een poll op een kaart (Poll-spec, okt 2026): alleen de vraag en "N stemmen
 * · stem". Stemmen gebeurt op de bladzijde zelf — een tik op de kaart opent
 * hem. Hier stonden de keuzes als donkere rijen met tellers, en de vraag en
 * de voetregel stonden er dubbel.
 */
function Poll({
  media,
  height,
  hue,
  myUserId,
}: {
  media: Extract<CardMedia, { kind: "poll" }>;
  height: number;
  hue: Hue;
  myUserId: string;
}) {
  const t = useT();
  const scheme = useScheme();
  const fc = friendColor(hue, scheme);
  const poll = media.poll;
  const closed = !!poll.ends_at && new Date(poll.ends_at).getTime() <= Date.now();
  const voted = poll.my_vote_option_ids.length > 0 || poll.options.some((o) => o.voters.some((v) => v.id === myUserId));
  const n = poll.voter_count ?? poll.total_votes;
  const people = n === 1 ? t.oneVoter : `${n} ${t.votesWord}`;
  return (
    <View pointerEvents="none" style={{ height, backgroundColor: color("paper2"), padding: 16, justifyContent: "flex-end", gap: 10 }}>
      <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: voted ? fc.fill : color("ink"), backgroundColor: voted ? fc.fill : "transparent" }} />
      <Text numberOfLines={4} style={[serif(), { fontSize: 22, lineHeight: 26, color: color("ink") }]}>
        {poll.question}
      </Text>
      <Text style={[sans(700), { fontSize: 10, lineHeight: 13, letterSpacing: 1.2, textTransform: "uppercase", color: color("ink", "inkDim") }]}>
        {closed ? `${t.closedC} · ${people}` : voted ? `${people} · ${t.youVoted}` : `${people} · ${t.voteC} →`}
      </Text>
    </View>
  );
}

/** Een plek: raster, gestreepte route, een speld met de naam. */
function Place({ place, coords, height, hue }: { place: string; coords: string; height: number; hue: Hue }) {
  const scheme = useScheme();
  const fc = friendColor(hue, scheme);
  const [w, setW] = useState(0);
  const cols = Math.ceil(w / 28);
  const rowsN = Math.ceil(height / 28);
  const grid = color("ink", "postRule");
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height, backgroundColor: color("paper2"), overflow: "hidden" }}
    >
      {Array.from({ length: cols }, (_, i) => (
        <View key={`c${i}`} style={{ position: "absolute", left: i * 28, top: 0, bottom: 0, width: 1, backgroundColor: grid }} />
      ))}
      {Array.from({ length: rowsN }, (_, i) => (
        <View key={`r${i}`} style={{ position: "absolute", top: i * 28, left: 0, right: 0, height: 1, backgroundColor: grid }} />
      ))}
      <View
        style={{
          position: "absolute",
          left: "8%",
          right: "30%",
          top: "40%",
          height: 0,
          borderTopWidth: 2,
          borderStyle: "dashed",
          borderColor: color("ink"),
          transform: [{ rotate: "-12deg" }],
        }}
      />
      <View style={{ position: "absolute", left: "58%", top: "36%", alignItems: "center", transform: [{ translateX: -40 }, { translateY: -40 }] }}>
        <View style={{ backgroundColor: fc.fill, borderWidth: BORDER, borderColor: line(), paddingVertical: 4, paddingHorizontal: 8 }}>
          <Mono variant="action" color={fc.ink} numberOfLines={1}>
            {place}
          </Mono>
        </View>
        <View style={{ width: BORDER, height: 14, backgroundColor: color("ink") }} />
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color("ink") }} />
      </View>
      <Mono variant="tiny" tone="dim" style={{ position: "absolute", left: 10, bottom: 8, textTransform: "none" }}>
        {coords}
      </Mono>
    </View>
  );
}

/** Een spraakclip: afspeelknop, 28 balken, duur. */
function Voice({ duration, height, seed }: { duration: string; height: number; seed: string }) {
  const [playing, setPlaying] = useState(false);
  const bars = waveform(seed);
  return (
    <View style={{ height, backgroundColor: color("paper2"), flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14 }}>
      <PlayGlyph size={44} glyph={playing ? "❚❚" : "▶"} onPress={() => setPlaying((p) => !p)} />
      <View style={{ flex: 1, height: 60, flexDirection: "row", alignItems: "center", gap: 3 }}>
        {bars.map((h, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              backgroundColor: playing && i >= 11 ? color("ink", "inkDim") : color("ink"),
            }}
          />
        ))}
      </View>
      <Mono variant="meta" style={{ textTransform: "none", fontFamily: lincinType.action.fontFamily }}>
        {duration}
      </Mono>
    </View>
  );
}
