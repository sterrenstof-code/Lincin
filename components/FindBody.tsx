import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { Embed } from "@/components/Embed";
import { SafeImage } from "@/components/SafeImage";
import { Arrow, Meta, Rule, TagRow, useWide } from "@/components/Editorial";
import {
  carbon,
  feed,
  FEED_BORDER,
  feedType,
  flame,
  flameDeep,
  page,
  rule,
  type,
} from "@/lib/design/type";
import {
  formatDuration,
  formatReadingTime,
  hostnameOf,
  type LinkPreview,
} from "@/lib/api/unfurl";
import { KIND_LABELS, type PostWithAuthor } from "@/lib/api/posts";
import { heroTag } from "@/lib/hero-transition";

/**
 * De inhoud van één vondst, per soort anders gezet.
 *
 * Monochroom, zoals de referentie: gebroken wit, zwarte inkt, haarlijnen.
 * Geen accentkleur — hiërarchie komt uit schaal en witruimte, niet uit
 * kleur. Rechthoeken waar het kan; de enige ronding die overblijft is
 * er geen.
 *
 * Eén regel houdt alles samen: **de bron krijgt de serif, de deler de
 * sans.** Wat iemand gevonden heeft weegt zwaarder dan wat die erover zegt.
 */

type FindMeta = Partial<LinkPreview>;

/** Horizontale inspringing van tekst. Beeld loopt door tot de rand. */
const PAD = "px-6";

async function openUrl(url: string) {
  try {
    if (Platform.OS === "web") {
      await Linking.openURL(url);
    } else {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: page.DEFAULT,
        controlsColor: carbon.DEFAULT,
        dismissButtonStyle: "close",
      });
    }
  } catch {
    Linking.openURL(url).catch(() => {});
  }
}

export function FindBody({
  post,
  onPress,
}: {
  post: PostWithAuthor;
  onPress?: () => void;
}) {
  const meta = (post.meta ?? {}) as FindMeta;

  switch (post.kind ?? "note") {
    case "fragment":
      return <FragmentBody post={post} />;
    case "fact":
    case "idea":
      return <StatementBody post={post} />;
    case "video":
      return <VideoBody post={post} meta={meta} />;
    case "music":
      return <MusicBody post={post} meta={meta} />;
    case "link":
      return <ArticleBody post={post} meta={meta} />;
    case "image":
      return <ImageBody post={post} onPress={onPress} />;
    default:
      return <NoteBody post={post} />;
  }
}

// ---------------------------------------------------------------
// Gedeelde stukjes
// ---------------------------------------------------------------

/** De toelichting van de deler — altijd sans, altijd ondergeschikt. */
function SharerNote({ text }: { text?: string | null }) {
  if (!text || !text.trim()) return null;
  return (
    <View className={`${PAD} pt-4`}>
      <Text style={[type.body, { color: carbon.soft }]}>{text.trim()}</Text>
    </View>
  );
}

function TagsBlock({ tags }: { tags?: string[] | null }) {
  if (!tags || tags.length === 0) return null;
  return (
    <View className={PAD}>
      <TagRow tags={tags} />
    </View>
  );
}

/** Bron · auteur · leestijd — het regeltje boven een kop. */
function SourceLine({ parts }: { parts: (string | null | undefined)[] }) {
  const text = parts.filter(Boolean).join("   ·   ");
  if (!text) return null;
  return <Meta dim>{text}</Meta>;
}

// ---------------------------------------------------------------
// FRAGMENT — de omkering: zwart blok op de pagina
// ---------------------------------------------------------------

function FragmentBody({ post }: { post: PostWithAuthor }) {
  const wide = useWide();
  const body = post.body_text?.trim() || post.caption?.trim() || "";
  const long = body.length > 220;
  const attribution = [post.source_author, post.source_title].filter(Boolean).join(", ");

  return (
    <View>
      <View className="bg-carbon px-7 pt-9 pb-8 mt-4">
        <Text
          style={[
            long || !wide ? type.quote : type.quoteLarge,
            { color: page.DEFAULT },
          ]}
        >
          {body}
        </Text>

        {attribution ? (
          <View className="mt-6">
            <View style={{ width: 40 }}>
              <Rule tone="dark" />
            </View>
            <Text style={[type.caption, { color: "#B8B6B0", marginTop: 12 }]}>
              {attribution}
            </Text>
          </View>
        ) : null}

        {post.link_url ? (
          <Pressable
            onPress={() => openUrl(post.link_url!)}
            className="flex-row items-center mt-5"
          >
            <Meta tone="dark" dim>
              {hostnameOf(post.link_url)}
            </Meta>
            <View className="ml-2">
              <Arrow tone="dark" size={13} dim />
            </View>
          </Pressable>
        ) : null}
      </View>

      {post.body_text ? <SharerNote text={post.caption} /> : null}
      <TagsBlock tags={post.tags} />
    </View>
  );
}

// ---------------------------------------------------------------
// WEETJE / IDEE — serif met een lijn ernaast
// ---------------------------------------------------------------

function StatementBody({ post }: { post: PostWithAuthor }) {
  const body = post.body_text?.trim() || post.caption?.trim() || "";
  const attribution = [post.source_author, post.source_title].filter(Boolean).join(", ");

  return (
    <View>
      <View className={`flex-row ${PAD} pt-4`}>
        <View
          style={{
            width: StyleSheet.hairlineWidth,
            backgroundColor: rule.strong,
            marginRight: 20,
          }}
        />
        <View className="flex-1">
          <Text style={[type.quote, { color: carbon.DEFAULT }]}>{body}</Text>
          {attribution ? (
            <Text style={[type.caption, { color: carbon.muted, marginTop: 12 }]}>
              {attribution}
            </Text>
          ) : null}
        </View>
      </View>
      {post.body_text ? <SharerNote text={post.caption} /> : null}
      <TagsBlock tags={post.tags} />
    </View>
  );
}

// ---------------------------------------------------------------
// VIDEO
// ---------------------------------------------------------------

function VideoBody({ post, meta }: { post: PostWithAuthor; meta: FindMeta }) {
  const wide = useWide();
  const [playing, setPlaying] = useState(false);
  const url = post.link_url ?? meta.canonical_url ?? null;
  const duration = formatDuration(meta.duration_s);
  const title = meta.title ?? post.source_title ?? null;

  return (
    <View>
      {playing && meta.embed_url ? (
        <View className="mt-4">
          <Embed url={meta.embed_url} aspectRatio={16 / 9} />
        </View>
      ) : (
        <Pressable
          onPress={() => {
            if (meta.embed_url) setPlaying(true);
            else if (url) openUrl(url);
          }}
          className="mt-4"
        >
          <View className="bg-page-alt" style={{ width: "100%", aspectRatio: 16 / 9 }}>
            <SafeImage
              uri={meta.image_url ?? null}
              cacheKey={meta.canonical_url ?? url ?? undefined}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={150}
              fallbackIcon="play-outline"
              fallbackBg="bg-page-alt"
              fallbackColor={carbon.muted}
            />
            {/* Vierkante speelknop — geen cirkel. */}
            <View className="absolute inset-0 items-center justify-center">
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderWidth: 1,
                  borderColor: page.DEFAULT,
                  backgroundColor: "rgba(18,17,15,0.42)",
                }}
                className="items-center justify-center"
              >
                <Ionicons name="play" size={19} color={page.DEFAULT} style={{ marginLeft: 3 }} />
              </View>
            </View>
            {duration ? (
              <View className="absolute bottom-0 right-0 bg-carbon px-2.5 py-1.5">
                <Meta tone="dark">{duration}</Meta>
              </View>
            ) : null}
          </View>
        </Pressable>
      )}

      <View className={`${PAD} pt-4`}>
        <SourceLine parts={[meta.site_name ?? (url ? hostnameOf(url) : null), meta.author]} />
        {title ? (
          <Pressable onPress={() => url && openUrl(url)} className="flex-row items-start mt-2">
            <Text
              style={[wide ? type.headlineWide : type.headline, { color: carbon.DEFAULT, flex: 1 }]}
            >
              {title}
            </Text>
            <View className="pt-2 pl-4">
              <Arrow dim />
            </View>
          </Pressable>
        ) : null}
      </View>

      <SharerNote text={post.caption} />
      <TagsBlock tags={post.tags} />
    </View>
  );
}

// ---------------------------------------------------------------
// MUZIEK
// ---------------------------------------------------------------

function MusicBody({ post, meta }: { post: PostWithAuthor; meta: FindMeta }) {
  const [playing, setPlaying] = useState(false);
  const url = post.link_url ?? meta.canonical_url ?? null;

  if (playing && meta.embed_url) {
    return (
      <View>
        <View className="mt-4">
          <Embed url={meta.embed_url} aspectRatio={2.35} />
        </View>
        <SharerNote text={post.caption} />
        <TagsBlock tags={post.tags} />
      </View>
    );
  }

  return (
    <View>
      <Pressable
        onPress={() => {
          if (meta.embed_url) setPlaying(true);
          else if (url) openUrl(url);
        }}
        className={`flex-row items-center ${PAD} pt-4`}
      >
        <SafeImage
          uri={meta.image_url ?? null}
          cacheKey={meta.canonical_url ?? url ?? undefined}
          style={{ width: 84, height: 84 }}
          contentFit="cover"
          fallbackIcon="musical-notes-outline"
          fallbackBg="bg-page-alt"
          fallbackColor={carbon.muted}
        />
        <View className="flex-1 px-5">
          <Text style={[type.headlineSmall, { color: carbon.DEFAULT }]} numberOfLines={2}>
            {meta.title ?? post.source_title ?? (url ? hostnameOf(url) : "Muziek")}
          </Text>
          <View className="mt-1.5">
            <Meta dim numberOfLines={1}>
              {[meta.author ?? post.source_author ?? "", meta.site_name ?? ""]
                .filter(Boolean)
                .join("   ·   ")}
            </Meta>
          </View>
        </View>
        <View
          style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: carbon.DEFAULT }}
          className="w-11 h-11 items-center justify-center"
        >
          <Ionicons name="play" size={15} color={carbon.DEFAULT} style={{ marginLeft: 2 }} />
        </View>
      </Pressable>

      <SharerNote text={post.caption} />
      <TagsBlock tags={post.tags} />
    </View>
  );
}

// ---------------------------------------------------------------
// ARTIKEL / LINK
// ---------------------------------------------------------------

function ArticleBody({ post, meta }: { post: PostWithAuthor; meta: FindMeta }) {
  const wide = useWide();
  const url = post.link_url ?? meta.canonical_url ?? null;
  const readingTime = formatReadingTime(meta.word_count);
  const source = meta.site_name ?? (url ? hostnameOf(url) : null);
  const title = meta.title ?? post.source_title ?? null;

  return (
    <View>
      {meta.image_url ? (
        <Pressable onPress={() => url && openUrl(url)} className="mt-4">
          <SafeImage
            uri={meta.image_url}
            cacheKey={meta.canonical_url ?? url ?? undefined}
            style={{ width: "100%", aspectRatio: wide ? 2.4 : 1.9 }}
            contentFit="cover"
            transition={150}
            fallbackBg="bg-page-alt"
            fallbackColor={carbon.muted}
          />
        </Pressable>
      ) : null}

      <Pressable onPress={() => url && openUrl(url)} className={`${PAD} pt-4`}>
        <SourceLine parts={[source, meta.author, readingTime]} />

        <View className="flex-row items-start mt-2">
          <Text
            style={[wide ? type.headlineWide : type.headline, { color: carbon.DEFAULT, flex: 1 }]}
          >
            {title ?? (url ? hostnameOf(url) : "Link")}
          </Text>
          <View className="pt-2 pl-4">
            <Arrow dim />
          </View>
        </View>

        {meta.description ? (
          <Text
            style={[type.bodySmall, { color: carbon.muted, marginTop: 8 }]}
            numberOfLines={3}
          >
            {meta.description}
          </Text>
        ) : null}

        {!title && url ? (
          <Text
            style={[
              type.bodySmall,
              { color: carbon.muted, marginTop: 5, textDecorationLine: "underline" },
            ]}
            numberOfLines={1}
          >
            {url}
          </Text>
        ) : null}
      </Pressable>

      <SharerNote text={post.caption} />
      <TagsBlock tags={post.tags} />
    </View>
  );
}

// ---------------------------------------------------------------
// FOTO
// ---------------------------------------------------------------

function ImageBody({ post, onPress }: { post: PostWithAuthor; onPress?: () => void }) {
  const [ratio, setRatio] = useState<number | undefined>(undefined);
  return (
    <View>
      <Pressable onPress={onPress} className="mt-4 bg-page-alt">
        <SafeImage
          uri={post.image_url}
          cacheKey={post.image_path ?? undefined}
          style={{
            width: "100%",
            aspectRatio: ratio ? Math.min(Math.max(ratio, 0.7), 1.9) : 1,
          }}
          contentFit="cover"
          transition={150}
          fallbackBg="bg-page-alt"
          fallbackColor={carbon.muted}
          onLoad={(e) => {
            const { width, height } = (e as any).source ?? {};
            if (width && height) setRatio(width / height);
          }}
        />
      </Pressable>
      {post.caption?.trim() ? (
        <View className={`${PAD} pt-3`}>
          <Text style={[type.caption, { color: carbon.soft }]}>{post.caption.trim()}</Text>
        </View>
      ) : null}
      <TagsBlock tags={post.tags} />
    </View>
  );
}

// ---------------------------------------------------------------
// NOTITIE — korte tekst krijgt de serif, lange de sans
// ---------------------------------------------------------------

function NoteBody({ post }: { post: PostWithAuthor }) {
  const text = post.caption?.trim() || post.body_text?.trim() || "";
  const short = text.length <= 140;
  return (
    <View>
      <View className={`${PAD} pt-4`}>
        <Text
          style={[short ? type.quote : type.body, { color: short ? carbon.DEFAULT : carbon.soft }]}
        >
          {text}
        </Text>
      </View>
      {post.image_path ? (
        <View className="mt-4">
          <SafeImage
            uri={post.image_url}
            cacheKey={post.image_path}
            style={{ width: "100%", aspectRatio: 1.6 }}
            contentFit="cover"
            fallbackBg="bg-page-alt"
            fallbackColor={carbon.muted}
          />
        </View>
      ) : null}
      <TagsBlock tags={post.tags} />
    </View>
  );
}

// ===============================================================
// FEED V3 — de hero-post en de compacte tegels
//
// Dit blok staat NAAST de `FindBody`-varianten hierboven, die
// ongewijzigd blijven: `app/post/[id].tsx` en alle niet-omgezette
// aanroepers blijven het affiche-systeem (page/carbon, serif) zien.
// Alleen `app/(app)/feed.tsx` gebruikt wat hieronder staat.
//
// Maatvoering volgt `feed-v3-merged.html` (de pixelreferentie) en
// `DESIGN_V3_FEED.md`. De tegelmaat komt uit de POSITIE en het
// SOORT, nooit uit populariteit: er wordt hier nergens geteld,
// gesorteerd of geschaald op basis van reacties. "Geen ranking,
// geen bereiktellers, je vrienden zijn het algoritme."
// ===============================================================

/** Wat een vondst aan de tegels aanbiedt, ongeacht haar `kind`. */
type FindParts = {
  kicker: string;
  title: string;
  body: string;
  image: string | null;
  imageKey: string | undefined;
  source: string | null;
  host: string | null;
  reading: string | null;
  url: string | null;
  sharer: string;
  time: string;
};

function partsOf(post: PostWithAuthor): FindParts {
  const meta = (post.meta ?? {}) as FindMeta;
  const url = post.link_url ?? meta.canonical_url ?? null;
  const title =
    meta.title ??
    post.source_title ??
    post.caption?.trim() ??
    post.body_text?.trim() ??
    (url ? hostnameOf(url) : "Zonder titel");

  return {
    kicker: KIND_LABELS[post.kind ?? "note"] ?? "Notitie",
    title,
    body:
      post.body_text?.trim() ||
      meta.description?.trim() ||
      post.caption?.trim() ||
      "",
    image: meta.image_url ?? post.image_url ?? null,
    imageKey: post.image_path ?? meta.canonical_url ?? url ?? undefined,
    source: post.source_author ?? meta.author ?? meta.site_name ?? null,
    host: url ? hostnameOf(url) : null,
    reading: formatReadingTime(meta.word_count) ?? formatDuration(meta.duration_s),
    url,
    sharer: post.author?.display_name ?? post.author?.username ?? "Onbekend",
    time: formatFeedTime(post.created_at),
  };
}

/** "2 uur geleden" — voluit, zoals in de mockup. */
export function formatFeedTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins} ${mins === 1 ? "minuut" : "minuten"} geleden`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} uur geleden`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} ${days === 1 ? "dag" : "dagen"} geleden`;
  return new Date(iso).toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
}

/**
 * De categoriekleur van een soort — het stipje voor de kicker.
 * `flame-deep` is de klein-tekst-veilige variant en draagt de kickers zelf;
 * teal en gold zijn de twee secundaire accenten uit `DESIGN_V3_FEED.md`.
 */
function categoryColor(kind: PostWithAuthor["kind"]): string {
  switch (kind) {
    case "video":
    case "link":
      return flameDeep;
    case "fragment":
    case "fact":
    case "idea":
      return feed.teal;
    default:
      return feed.gold;
  }
}

/**
 * De kickerregel: soort · deler, met een gekleurd blokje ervoor.
 *
 * Let op: het blokje is vierkant, niet rond. De mockup tekent hier een
 * cirkel van 6px, maar `DESIGN_V3_FEED.md` en Toms briefing zeggen allebei
 * expliciet "radii 0 overal behalve de avatar — niet oprekken". De
 * geschreven regel wint; dit is de enige plek waar hij en de mockup elkaar
 * tegenspreken.
 */
function FeedKicker({
  text,
  kind,
  tone = "post",
}: {
  text: string;
  kind: PostWithAuthor["kind"];
  tone?: "feed" | "post";
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 6,
          height: 6,
          backgroundColor: categoryColor(kind),
          marginRight: 6,
        }}
      />
      <Text
        style={[
          feedType.kicker,
          { color: tone === "post" ? feed.text : flameDeep, letterSpacing: 0.5 },
        ]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------
// De uitgelichte vondst — ~88vh
// ---------------------------------------------------------------

/**
 * De hero heeft géén kaartachtergrond: kop en metadata staan direct op het
 * lavendel paginavlak. Alleen het beeld krijgt een kader. Dat is wat de hero
 * onderscheidt van de tegels eronder, die allemaal op `feed-post` staan.
 */
export function FindHero({
  post,
  wide,
  minHeight,
  onPress,
  onMenu,
}: {
  post: PostWithAuthor;
  wide: boolean;
  /** ~88% van de vensterhoogte — de hero vult bijna het scherm. */
  minHeight: number;
  onPress?: () => void;
  onMenu?: () => void;
}) {
  const p = partsOf(post);

  return (
    <View
      style={{
        minHeight,
        paddingHorizontal: wide ? 32 : 18,
        paddingTop: 28,
        paddingBottom: 32,
        borderBottomWidth: FEED_BORDER,
        borderBottomColor: feed.ink,
      }}
    >
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          justifyContent: "space-between",
          alignItems: wide ? "flex-start" : "stretch",
          marginBottom: 22,
        }}
      >
        {/* Links — kicker + kop */}
        <Pressable onPress={onPress} style={wide ? { flex: 1, maxWidth: 640, paddingRight: 24 } : undefined}>
          <Text
            style={[
              feedType.kicker,
              { color: flameDeep, letterSpacing: 0.55, fontSize: 11, marginBottom: 10 },
            ]}
          >
            {`Vondst · ${p.kicker}`}
          </Text>
          <Text style={[wide ? feedType.hero : feedType.heroSmall, { color: feed.ink }]}>
            {p.title}
          </Text>
        </Pressable>

        {/* Rechts — deler, tijd, bron, en de deelknop */}
        <View
          style={
            wide
              ? { alignItems: "flex-end", paddingTop: 4 }
              : { marginTop: 18, alignItems: "flex-start" }
          }
        >
          <Text
            style={[
              feedType.label,
              { fontSize: 15, fontWeight: "700", color: feed.ink, marginBottom: 6 },
            ]}
            numberOfLines={1}
          >
            {p.sharer}
          </Text>
          <Text
            style={[
              feedType.label,
              { color: "#3A3540", lineHeight: 16, textAlign: wide ? "right" : "left" },
            ]}
          >
            {`Gedeeld · ${p.time}`}
          </Text>
          {p.host || p.source || p.reading ? (
            <Text
              style={[
                feedType.label,
                { color: "#3A3540", lineHeight: 16, textAlign: wide ? "right" : "left" },
              ]}
              numberOfLines={1}
            >
              {[p.source ?? p.host, p.reading].filter(Boolean).join(" · ")}
            </Text>
          ) : null}
          <Pressable
            onPress={onMenu ?? onPress}
            style={{
              marginTop: 14,
              borderWidth: FEED_BORDER,
              borderColor: feed.ink,
              paddingVertical: 6,
              paddingHorizontal: 12,
            }}
          >
            <Text style={[feedType.kicker, { color: feed.ink, letterSpacing: 0.55 }]}>
              Delen ↗
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Beeld — vult de rest van de hero. */}
      <Pressable
        onPress={onPress}
        style={{
          flex: 1,
          minHeight: 220,
          borderWidth: FEED_BORDER,
          borderColor: feed.ink,
          backgroundColor: feed.post,
          // Ankerpunt van de morph naar de detailpagina.
          ...heroTag(post.id),
        }}
      >
        <SafeImage
          uri={p.image}
          cacheKey={p.imageKey}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
          fallbackIcon="sparkles-outline"
          fallbackBg="bg-feed-post"
          fallbackColor={feed.textDim}
        />
        {post.caption?.trim() ? (
          <Text
            style={{
              position: "absolute",
              left: 16,
              bottom: 16,
              right: 16,
              fontFamily: feedType.caption.fontFamily,
              fontSize: 12,
              fontStyle: "italic",
              color: "rgba(255,255,255,0.85)",
            }}
            numberOfLines={2}
          >
            {`“${post.caption.trim()}”`}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------
// De compacte tegels
// ---------------------------------------------------------------

export type TileVariant = "cover" | "tall" | "text" | "stat" | "caption" | "quote";

/**
 * Eén vondst in de compacte sectie.
 *
 * `variant` komt uit `feed.tsx`, dat per blok van zes eerst probeert het
 * soort aan de gepaste maat te koppelen en anders terugvalt op het vaste
 * ritme. De tegel zelf beslist niets over haar eigen maat.
 */
export function FindTile({
  post,
  variant,
  index,
  wide,
  onPress,
}: {
  post: PostWithAuthor;
  variant: TileVariant;
  /** Volgnummer binnen de uitgave — puur redactioneel, geen ranking. */
  index: number;
  wide: boolean;
  onPress?: () => void;
}) {
  const p = partsOf(post);

  switch (variant) {
    case "cover":
      return <CoverBand p={p} post={post} index={index} wide={wide} onPress={onPress} />;
    case "quote":
      return <QuoteBand p={p} post={post} wide={wide} onPress={onPress} />;
    case "tall":
      return <TallTile p={p} post={post} onPress={onPress} />;
    case "stat":
      return <StatTile p={p} post={post} index={index} onPress={onPress} />;
    case "caption":
      return <CaptionTile p={p} id={post.id} onPress={onPress} />;
    default:
      return <TextTile p={p} post={post} onPress={onPress} />;
  }
}

/** Binnenwerk van een tegel in de vierkolomsrij. */
const TILE_PAD = 16;

/**
 * De cover-band: tekstvlak links (1.1fr), beeld rechts (1fr).
 * Onder het breekpunt stapelt hij, tekst eerst.
 */
function CoverBand({
  p,
  post,
  index,
  wide,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  index: number;
  wide: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        overflow: "hidden",
        flexDirection: wide ? "row" : "column",
      }}
    >
      <View
        style={{
          backgroundColor: feed.post,
          padding: 30,
          justifyContent: "space-between",
          ...(wide ? { flex: 1.1 } : null),
        }}
      >
        <View>
          <View style={{ marginBottom: 14 }}>
            <FeedKicker text={`${p.kicker} · ${p.sharer}`} kind={post.kind} />
          </View>
          <Text
            style={[
              wide ? feedType.cover : feedType.coverSmall,
              { color: feed.text },
            ]}
            numberOfLines={4}
          >
            {p.title.toUpperCase()}
          </Text>
        </View>
        <Text
          style={[
            feedType.numeral,
            { fontSize: 24, lineHeight: 28, color: flame, marginTop: 18 },
          ]}
        >
          {`(${String(index).padStart(2, "0")})`}
        </Text>
      </View>

      <View
        style={{
          minHeight: 200,
          backgroundColor: "#3A2A46",
          ...heroTag(post.id),
          ...(wide
            ? { flex: 1, borderLeftWidth: FEED_BORDER, borderLeftColor: feed.ink }
            : { borderTopWidth: FEED_BORDER, borderTopColor: feed.ink }),
        }}
      >
        <SafeImage
          uri={p.image}
          cacheKey={p.imageKey}
          style={{ width: "100%", height: "100%", minHeight: 200 }}
          contentFit="cover"
          transition={150}
          fallbackBg="bg-feed-post"
          fallbackColor={feed.textDim}
        />
      </View>
    </Pressable>
  );
}

/** t-a: hoge beeldtegel met de kop over een scrim. */
function TallTile({
  p,
  post,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, padding: TILE_PAD }}>
      <View style={{ marginBottom: 10 }}>
        <FeedKicker text={`${p.kicker} · ${p.sharer}`} kind={post.kind} />
      </View>
      <View style={{ width: "100%", aspectRatio: 3 / 4, marginBottom: 12, ...heroTag(post.id) }}>
        <SafeImage
          uri={p.image}
          cacheKey={p.imageKey}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
          fallbackBg="bg-feed-post"
          fallbackColor={feed.textDim}
        />
        {/* Scrim. Geen gradient-dependency: drie gestapelde vlakken met
            oplopende dekking lezen op deze maat identiek. */}
        <View
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
        >
          <View style={{ height: 26, backgroundColor: "rgba(0,0,0,0.22)" }} />
          <View style={{ height: 26, backgroundColor: "rgba(0,0,0,0.44)" }} />
          <View style={{ backgroundColor: "rgba(0,0,0,0.62)", padding: 10 }}>
            <Text
              style={{
                fontFamily: feedType.tile.fontFamily,
                fontSize: 15,
                lineHeight: 17,
                fontWeight: "800",
                color: "#FFFFFF",
              }}
              numberOfLines={3}
            >
              {p.title}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** t-b: kop plus aanzet, geen beeld. */
function TextTile({
  p,
  post,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, padding: TILE_PAD }}>
      <View style={{ marginBottom: 10 }}>
        <FeedKicker text={`${p.kicker} · ${p.sharer}`} kind={post.kind} />
      </View>
      <Text
        style={[
          feedType.tile,
          { fontSize: 20, lineHeight: 23, fontWeight: "800", color: feed.text, marginBottom: 8 },
        ]}
        numberOfLines={3}
      >
        {p.title}
      </Text>
      {p.body ? (
        <Text
          style={[feedType.body, { fontSize: 12, lineHeight: 18, color: feed.textDim }]}
          numberOfLines={5}
        >
          {p.body}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * t-c: cijfertegel, verticaal gecentreerd.
 *
 * Het cijfer komt uit de vondst zélf — een getal in de tekst, anders de
 * leestijd of de duur, anders het volgnummer in de uitgave. Nadrukkelijk
 * NIET uit reacties of bereik: dit ontwerp telt geen publiek.
 */
function StatTile({
  p,
  post,
  index,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  index: number;
  onPress?: () => void;
}) {
  const inText = p.body.match(/\b(\d{1,4})\s*(%)?\b/);
  const numeral = inText
    ? `${inText[1]}${inText[2] ?? ""}`
    : p.reading
    ? p.reading
    : String(index).padStart(2, "0");

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, padding: TILE_PAD, justifyContent: "center" }}
    >
      <Text
        style={[
          feedType.numeral,
          { fontSize: 32, lineHeight: 36, letterSpacing: -1.2, color: feed.teal, marginBottom: 8 },
        ]}
        numberOfLines={1}
      >
        {numeral}
      </Text>
      <Text
        style={[
          feedType.body,
          { fontSize: 13, lineHeight: 18, fontWeight: "600", color: feed.textDim },
        ]}
        numberOfLines={4}
      >
        {p.body || p.title}
      </Text>
    </Pressable>
  );
}

/** t-d: kleine vierkante foto met onderschrift eronder. */
function CaptionTile({ p, id, onPress }: { p: FindParts; id: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flex: 1, padding: TILE_PAD }}>
      <View style={{ width: "100%", aspectRatio: 1, marginBottom: 10, ...heroTag(id) }}>
        <SafeImage
          uri={p.image}
          cacheKey={p.imageKey}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
          fallbackBg="bg-feed-post"
          fallbackColor={feed.textDim}
        />
      </View>
      <Text
        style={[
          feedType.tile,
          { fontSize: 14, lineHeight: 18, fontWeight: "700", color: feed.text, marginBottom: 4 },
        ]}
        numberOfLines={2}
      >
        {p.title}
      </Text>
      <Text style={[feedType.label, { color: feed.textDim }]} numberOfLines={1}>
        {`${p.kicker} · ${p.sharer}`}
      </Text>
    </Pressable>
  );
}

/** De brede citaatband met het grote aanhalingsteken in flame. */
function QuoteBand({
  p,
  post,
  wide,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  wide: boolean;
  onPress?: () => void;
}) {
  const quote = p.body || p.title;
  const attribution = [p.source, post.source_title].filter(Boolean).join(", ");

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: feed.post,
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        padding: 32,
        flexDirection: wide ? "row" : "column",
        alignItems: wide ? "center" : "flex-start",
      }}
    >
      <View style={wide ? { width: 110 } : { marginBottom: 8 }}>
        <Text
          style={[
            feedType.numeral,
            { fontSize: 56, lineHeight: 56, letterSpacing: -2, color: flame },
          ]}
        >
          {"“"}
        </Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            wide ? feedType.pull : feedType.pullSmall,
            { fontSize: wide ? 22 : 18, lineHeight: wide ? 29 : 24, fontWeight: "700", color: feed.text },
          ]}
        >
          {quote}
        </Text>
        <Text
          style={[
            feedType.caption,
            { fontSize: 12, fontStyle: "italic", color: feed.textDim, marginTop: 10 },
          ]}
        >
          {[attribution || p.kicker, p.sharer, p.time].filter(Boolean).join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}
