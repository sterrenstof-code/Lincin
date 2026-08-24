import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useState, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { CHROME_COMPACT_H } from "@/components/AppChrome";
import { Embed } from "@/components/Embed";
import { PostCarousel } from "@/components/PostCarousel";
import { SafeImage } from "@/components/SafeImage";
import { Scrim } from "@/components/Scrim";
import { SpreadBlock, StickySpread } from "@/components/StickySpread";
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
  space,
  type,
} from "@/lib/design/type";
import {
  formatDuration,
  formatReadingTime,
  hostnameOf,
  type LinkPreview,
} from "@/lib/api/unfurl";
import { KIND_LABELS, type PostWithAuthor } from "@/lib/api/posts";
import { useHeroTag } from "@/lib/hero-transition";

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
      {(post.album_urls?.length ?? 0) > 1 ? (
        <View className="mt-4 bg-page-alt">
          <PostCarousel
            urls={post.album_urls!}
            style={{ width: "100%", aspectRatio: 1 }}
            onPressImage={onPress}
          />
        </View>
      ) : (
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
      )}
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
// het feed-systeem. De tegelmaat komt uit de POSITIE en het
// SOORT, nooit uit populariteit: er wordt hier nergens geteld,
// gesorteerd of geschaald op basis van reacties. "Geen ranking,
// geen bereiktellers, je vrienden zijn het algoritme."
// ===============================================================

/** Wat een vondst aan de tegels aanbiedt, ongeacht haar `kind`. */
type FindParts = {
  kicker: string;
  /**
   * De kop van de vondst, of `null` als er niets is om te zetten.
   *
   * Hier stond eerder "Zonder titel". Dat is een label voor een ontbrekend
   * veld in een formulier, geen kop: bij een reeks foto's zonder tekst
   * stond het zes keer naast elkaar op het scherm, en het zei van geen
   * enkele foto iets. Geen titel is nu géén regel.
   */
  title: string | null;
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
    meta.title ||
    post.source_title ||
    post.caption?.trim() ||
    post.body_text?.trim() ||
    (url ? hostnameOf(url) : null);

  /**
   * De tekst van de vondst zelf.
   *
   * Beide velden vallen terug op `caption`, en bij een beeldpost is dat
   * vaak het enige wat er is: dan stond dezelfde regel twee keer op het
   * scherm, één keer als kop en één keer als citaatblok eronder. Is de
   * tekst gelijk aan de kop, dan is er geen tweede tekst — dan laten we
   * het blok gewoon weg.
   */
  const bodyText =
    post.body_text?.trim() ||
    meta.description?.trim() ||
    post.caption?.trim() ||
    "";

  return {
    kicker: KIND_LABELS[post.kind ?? "note"] ?? "Notitie",
    title,
    body: isSameText(bodyText, title ?? "") ? "" : bodyText,
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

/**
 * Twee stukken tekst die hetzelfde zeggen. Hoofdletters en witruimte
 * tellen niet mee: "Zonnengloed" en "zonnengloed " zijn één regel, geen
 * twee.
 */
function isSameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
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
 * teal en gold zijn de twee secundaire accenten; zie DESIGN.md §2.
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
 * cirkel van 6px, maar het systeem en Toms briefing zeggen allebei
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
  footer,
}: {
  post: PostWithAuthor;
  wide: boolean;
  /** Wordt gebruikt als het tweeluik terugvalt op één kolom. */
  minHeight: number;
  onPress?: () => void;
  onMenu?: () => void;
  /**
   * Wat onderaan de tekstkolom komt — in de praktijk de reacties.
   *
   * Die stonden eerder over de volle breedte ónder het tweeluik, waar ze
   * los kwamen te staan van de vondst waar ze bij horen terwijl de kolom
   * naast het beeld halfleeg bleef. Als laatste blok in die kolom staan ze
   * waar het gesprek hoort: naast het beeld, in dezelfde leesmaat.
   */
  footer?: ReactNode;
}) {
  const p = partsOf(post);

  const album = post.album_urls ?? [];
  const heroTagForPost = useHeroTag(post.id);

  const media = (
    <Pressable
      onPress={onPress}
      // De uitgelichte plaat droeg geen naam, en dus morphte juist de
      // grootste foto van de feed níet naar de detailpagina: die wisselde
      // hard terwijl elke kleine tegel wél groeide. Zelfde naam als daar.
      style={{ flex: 1, ...heroTagForPost }}
    >
      {album.length > 1 ? (
        // Een reeks foto's bij één vondst: blader erdoor in plaats van
        // alleen de omslag te tonen. De tik op een foto opent de vondst,
        // net als bij één foto.
        <PostCarousel urls={album} style={{ flex: 1 }} onPressImage={onPress} />
      ) : (
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
      )}
      {/* Het onderschrift over het beeld — maar niet als het woordelijk de
          kop hiernaast is. Bij een beeldpost zonder eigen tekst zijn dat
          allebei de `caption`, en dan stond dezelfde regel drie keer op
          het scherm. */}
      {post.caption?.trim() && !isSameText(post.caption, p.title ?? "") ? (
        <Text
          style={{
            position: "absolute",
            left: space.xl,
            bottom: space.xl,
            right: space.xl,
            fontFamily: feedType.caption.fontFamily,
            fontSize: 13,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.88)",
          }}
          numberOfLines={3}
        >
          {`“${post.caption.trim()}”`}
        </Text>
      ) : null}
    </Pressable>
  );

  return (
    <View
      style={{
        borderBottomWidth: FEED_BORDER,
        borderBottomColor: feed.ink,
      }}
    >
      {/* Het beeld plakt onder de kop en niet onder de bovenrand van het
          venster: de kop zweeft absoluut over de pagina, dus op `0` schoof
          de bovenkant van het beeld eronder weg. */}
      <StickySpread media={media} stickyTop={CHROME_COMPACT_H} ratio={1.15}>
        {/* Blok 1 — waar het over gaat, en van wie.
            Dit waren twee blokken: kop, en daaronder een tweede vlak met de
            naam, de tijd en een omkaderde knop "Delen". Drie dingen die bij
            elkaar horen, uit elkaar getrokken over twee kaders en zo'n
            driehonderd pixels. Nu één blok: kicker, kop, en één regel
            eronder met wie het deelde, wanneer, en waar het vandaan komt. */}
        <SpreadBlock last={!p.body && !footer}>
          <Text
            style={[
              feedType.kicker,
              { color: flameDeep, letterSpacing: 0.55, fontSize: 11, marginBottom: space.sm },
            ]}
          >
            {`VONDST · ${p.kicker.toUpperCase()}`}
          </Text>

          {p.title ? (
            <Pressable onPress={onPress}>
              <Text style={[wide ? feedType.hero : feedType.heroSmall, { color: feed.ink }]}>
                {p.title}
              </Text>
            </Pressable>
          ) : null}

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: space.sm,
              marginTop: space.lg,
            }}
          >
            <Text
              style={[feedType.label, { fontSize: 14, fontWeight: "700", color: feed.ink }]}
              numberOfLines={1}
            >
              {p.sharer}
            </Text>
            <Text style={[feedType.label, { color: feed.inkDim }]} numberOfLines={1}>
              {[p.time, p.source ?? p.host, p.reading].filter(Boolean).join(" · ")}
            </Text>
            {/* Delen is één van de dingen die je met een vondst kunt doen,
                niet dé actie: een regel, geen kader. */}
            <Pressable onPress={onMenu ?? onPress} style={{ marginLeft: "auto" }}>
              <Text style={[feedType.label, { color: flameDeep, fontWeight: "700" }]}>
                Delen ↗
              </Text>
            </Pressable>
          </View>
        </SpreadBlock>

        {/* Blok 3 — de tekst van de vondst zelf, op plum zodat de kolom
            niet als één egale lap leest. */}
        {p.body ? (
          <SpreadBlock filled last={!footer}>
            <Text style={[feedType.pullSmall, { color: feed.text }]}>{p.body}</Text>
          </SpreadBlock>
        ) : null}

        {/* Blok 4 — het gesprek over deze vondst. De reactiepillen en de
            reactielijst dragen hun eigen binnenmarge; zonder deze
            compensatie springen ze twee keer in en staan ze niet meer op
            dezelfde lijn als de kop erboven. */}
        {footer ? (
          <SpreadBlock last>
            <View style={{ marginHorizontal: -16 }}>{footer}</View>
          </SpreadBlock>
        ) : null}
      </StickySpread>
    </View>
  );
}

// ---------------------------------------------------------------
// De compacte tegels
// ---------------------------------------------------------------

export type TileVariant =
  | "cover"
  | "tall"
  | "text"
  | "stat"
  | "caption"
  | "quote"
  /** Alleen een kop, of een kop met een bron. Geen beeld, geen lopende tekst. */
  | "note"
  /** Deel van een mozaïekblok — de tegel vult zijn cel volledig. */
  | "mosaic"
  /** Eén cel in het chronologische overzicht: overal exact dezelfde vorm. */
  | "grid";

/**
 * Eén vondst in de compacte sectie.
 *
 * `variant` komt uit `feed.tsx`, dat per blok van zes eerst probeert het
 * soort aan de gepaste maat te koppelen en anders terugvalt op het vaste
 * ritme. De tegel zelf beslist niets over haar eigen maat.
 */
/**
 * Welke vorm past bij deze vondst?
 *
 * ---------------------------------------------------------------
 * WAAROM DIT NIET MEER OM DE BEURT GAAT
 * ---------------------------------------------------------------
 * De vorm van een tegel werd bepaald door zijn plaats in de rij: eerste
 * tall, tweede text, derde stat, vierde caption. Dat gaf een mooi ritme
 * zolang elke vondst toevallig had wat die vorm nodig heeft — en dat is
 * precies wat een vondst niet altijd heeft.
 *
 * Wat je dan kreeg, en wat er ook stond: een foto zonder onderschrift die
 * in de tekstvorm viel werd een leeg vlak met alleen "Beeld · Waveman"
 * erboven. Een notitie zonder cijfers in de cijfervorm kreeg het
 * volgnummer van de tegel als getal — 04 — alsof dat iets betekende. En
 * een artikel zonder voorbeeld-afbeelding in de beeldvorm werd een grijs
 * plaatshoudertje.
 *
 * Dus kiest de inhoud de vorm, en niet de plaats. `alt` wisselt alleen
 * nog tussen twee vormen die állebei kunnen: het ritme blijft, de lege
 * vlakken zijn weg.
 */
export function tileShapeFor(post: PostWithAuthor, alt: number): TileVariant {
  const p = partsOf(post);
  const hasImage = !!p.image;
  const hasBody = p.body.trim().length > 0;
  // Een écht getal in de tekst — niet het volgnummer van de tegel.
  const hasNumber = /\b\d{1,4}\s*%?\b/.test(p.body);

  if (hasImage) return alt % 2 === 0 ? "tall" : "caption";
  if (hasNumber) return "stat";
  if (hasBody) return "text";
  return "note";
}

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
      return <CaptionTile p={p} post={post} onPress={onPress} />;
    case "note":
      return <NoteTile p={p} post={post} onPress={onPress} />;
    case "mosaic":
      return <MosaicTile p={p} post={post} onPress={onPress} />;
    case "grid":
      return <GridTile p={p} post={post} onPress={onPress} />;
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
            {(p.title ?? "").toUpperCase()}
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
          ...useHeroTag(post.id),
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
/**
 * t-a: staand beeld dat de hele cel vult.
 *
 * Hier stond een kleine foto met een marge van zestien rondom, op een plum
 * vlak. Wat je zag was vooral dat vlak: de foto haalde nog geen twee derde
 * van de cel, en de rest was kleur die met de foto botste. Een tegel over
 * een foto hóórt de foto te zijn — dus vult hij de cel, en staat wat je
 * erover moet weten eroverheen.
 */
function TallTile({
  p,
  post,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  onPress?: () => void;
}) {
  return <ImageCell p={p} post={post} onPress={onPress} />;
}

/** t-d: gelijk aan de staande — de rij bepaalt de hoogte, niet de tegel. */
function CaptionTile({
  p,
  post,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  onPress?: () => void;
}) {
  return <ImageCell p={p} post={post} onPress={onPress} />;
}

/**
 * De gedeelde vorm van een beeldtegel: de foto vult de cel, met een sluier
 * onderaan waarop de herkomst staat en — als die er is — de kop.
 *
 * Geen eigen verhouding meer. Die had elke tegel wel (staand 3:4, vierkant
 * 1:1), maar in een rij van vier is de hoogste de baas: onder de kortere
 * foto's bleef een lap paginavlak liggen, en dan is de tegel niet de foto
 * maar een foto op een vlak. De rij geeft de hoogte, elke foto vult hem.
 */
function ImageCell({
  p,
  post,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  onPress?: () => void;
}) {
  const heroStyle = useHeroTag(post.id);
  const album = post.album_urls ?? [];

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, width: "100%", backgroundColor: feed.post, ...heroStyle }}
    >
      {/* Absoluut en niet `height: "100%"`. Een percentage heeft een ouder
          met een vástgelegde hoogte nodig; deze cel krijgt de zijne van
          flexbox, en dan valt zo'n percentage terug op de eigen hoogte van
          het beeld — vandaar de strook paginavlak die onder sommige foto's
          bleef liggen. */}
      <SafeImage
        uri={p.image}
        cacheKey={p.imageKey}
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        contentFit="cover"
        transition={150}
        fallbackBg="bg-feed-post"
        fallbackColor={feed.textDim}
      />

      <Scrim height={p.title ? 130 : 78} />

      <View
        style={{
          position: "absolute",
          left: space.md,
          right: space.md,
          bottom: space.md,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1 }}>
            <FeedKicker text={`${p.kicker} · ${p.sharer}`} kind={post.kind} />
          </View>
          {album.length > 1 ? (
            <Text style={[feedType.label, { color: feed.text, marginLeft: space.sm }]}>
              {`${album.length} ▦`}
            </Text>
          ) : null}
        </View>
        {p.title ? (
          <Text
            style={{
              fontFamily: feedType.tile.fontFamily,
              fontSize: 15,
              lineHeight: 18,
              fontWeight: "800",
              color: feed.text,
              marginTop: space.xs,
            }}
            numberOfLines={2}
          >
            {p.title}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/**
 * t-e: alleen een kop, en wat er verder over de vondst te zeggen valt.
 *
 * Voor de vondst die niets heeft om te tónen: een link zonder
 * voorbeeldbeeld, een korte notitie, een gedeeld artikel waarvan alleen de
 * titel bekend is. Die viel eerder in een beeldvorm en werd een grijs
 * plaatshoudertje. Hier is de tekst het beeld: de kop groot, de bron
 * eronder, en de kicker erboven zodat je nog steeds ziet wat voor soort
 * vondst het is.
 */
function NoteTile({
  p,
  post,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, padding: TILE_PAD, justifyContent: "space-between" }}
    >
      <FeedKicker text={`${p.kicker} · ${p.sharer}`} kind={post.kind} tone="feed" />

      <Text
        style={[
          feedType.tile,
          {
            fontSize: 20,
            lineHeight: 24,
            fontWeight: "800",
            color: feed.ink,
            marginTop: space.md,
          },
        ]}
        numberOfLines={5}
      >
        {p.title ?? p.body ?? ""}
      </Text>

      {p.host || p.source ? (
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: space.md }}>
          <Text
            style={[feedType.label, { color: feed.inkDim, flex: 1 }]}
            numberOfLines={1}
          >
            {p.source ?? p.host}
          </Text>
          {p.url ? <Text style={[feedType.label, { color: flameDeep }]}>↗</Text> : null}
        </View>
      ) : (
        <Text style={[feedType.label, { color: feed.inkDim, marginTop: space.md }]}>
          {p.time}
        </Text>
      )}
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
      <View style={{ marginBottom: space.md }}>
        <FeedKicker text={`${p.kicker} · ${p.sharer}`} kind={post.kind} tone="feed" />
      </View>
      {p.title ? (
        <Text
          style={[
            feedType.tile,
            {
              fontSize: 20,
              lineHeight: 23,
              fontWeight: "800",
              color: feed.ink,
              marginBottom: space.sm,
            },
          ]}
          numberOfLines={3}
        >
          {p.title}
        </Text>
      ) : null}
      {p.body ? (
        <Text
          style={[feedType.body, { fontSize: 12, lineHeight: 18, color: feed.inkDim }]}
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
  /**
   * Het getal moet uit de vondst zelf komen. Stond hier niets, dan viel
   * dit terug op het volgnummer van de tegel — "04" in koeienletters
   * boven een notitie die niets met vier te maken had. `tileShapeFor`
   * kiest deze vorm nu alleen als er écht een getal staat; de leestijd
   * blijft als tweede keus, en anders is er geen cijferregel.
   */
  const inText = p.body.match(/\b(\d{1,4})\s*(%)?\b/);
  const numeral = inText ? `${inText[1]}${inText[2] ?? ""}` : p.reading ?? null;
  void index;

  return (
    <Pressable
      onPress={onPress}
      style={{ flex: 1, padding: TILE_PAD, justifyContent: "center" }}
    >
      <View style={{ marginBottom: space.md }}>
        <FeedKicker text={`${p.kicker} · ${p.sharer}`} kind={post.kind} tone="feed" />
      </View>
      {numeral ? (
        <Text
          style={[
            feedType.numeral,
            {
              fontSize: 32,
              lineHeight: 36,
              letterSpacing: -1.2,
              color: flameDeep,
              marginBottom: space.sm,
            },
          ]}
          numberOfLines={1}
        >
          {numeral}
        </Text>
      ) : null}
      <Text
        style={[
          feedType.body,
          { fontSize: 13, lineHeight: 18, fontWeight: "600", color: feed.inkDim },
        ]}
        numberOfLines={4}
      >
        {p.body || p.title}
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
  const quote = p.body || p.title || "";
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

/**
 * De kaart van het chronologische overzicht.
 *
 * ---------------------------------------------------------------
 * WAAROM DEZE ER NAAST DE ANDERE TEGELS IS
 * ---------------------------------------------------------------
 * De andere tegels wisselen bewust van maat en vorm: dat is het ritme van
 * een uitgave, en het hoort bij de thematische indeling waar een redactie
 * kiest wat groot mag. Het chronologische overzicht heeft juist géén
 * redactie — het is alles, nieuwste eerst — en dan is wisselende maat geen
 * ritme meer maar ruis: je gaat betekenis zoeken in een grootte die alleen
 * uit de volgorde volgt.
 *
 * Deze kaart is daarom overal identiek: beeld op 4:3, dan kicker, kop van
 * hoogstens twee regels, en wanneer. Vaste hoogte voor het tekstdeel, zodat
 * een kop van één regel dezelfde kaart oplevert als een kop van twee.
 */
function GridTile({
  p,
  post,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  onPress?: () => void;
}) {
  const heroStyle = useHeroTag(post.id);

  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        backgroundColor: feed.post,
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
      }}
    >
      <View style={{ width: "100%", aspectRatio: 4 / 3, ...heroStyle }}>
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

      <View style={{ padding: 14, minHeight: 118 }}>
        <FeedKicker text={p.kicker} kind={post.kind} />
        {p.title ? (
          <Text
            style={[feedType.tile, { fontSize: 16, color: feed.text, marginTop: 8 }]}
            numberOfLines={2}
          >
            {p.title}
          </Text>
        ) : null}
        <Text
          style={[feedType.label, { color: feed.textDim, marginTop: 6 }]}
          numberOfLines={1}
        >
          {`${p.sharer} · ${p.time}`}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Een cel in een mozaïek: beeld tot de rand, tekst eroverheen.
 *
 * Anders dan de andere tegels heeft deze géén eigen binnenmarge — het
 * mozaïek dankt zijn ritme aan beelden die tegen elkaar aan liggen, met
 * alleen de kaderlijn ertussen. De hoogte komt van de cel waar hij in zit,
 * niet van de tegel zelf, zodat rijen van verschillende hoogte kunnen
 * bestaan zonder dat de inhoud gaat zwemmen.
 */
function MosaicTile({
  p,
  post,
  onPress,
}: {
  p: FindParts;
  post: PostWithAuthor;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      // Ankerpunt van de morph naar de detailpagina — ook de mozaïekcellen
      // groeien uit tot de volledige plaat.
      style={{ flex: 1, backgroundColor: feed.post, ...useHeroTag(post.id) }}
    >
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
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

      {/* De sluier loopt door tot achter de tekst in plaats van erin over te
          gaan: eerst twee vlakken en dan een derde met een eigen kleur zag je
          als drie banden over de foto liggen. Zie components/Scrim.tsx. */}
      <Scrim height={140} />

      {/* Eén tekstblok, altijd op dezelfde plek en met dezelfde marge —
          ongeacht of er een titel is. Zonder titel schuift de naam van de
          uploader dus niet naar onderen. */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          padding: space.md,
        }}
      >
        <Text
          style={[
            feedType.kicker,
            { color: feed.text, opacity: 0.72, letterSpacing: 0.5 },
          ]}
          numberOfLines={1}
        >
          {`${p.kicker} · ${p.sharer}`.toUpperCase()}
        </Text>
        {p.title ? (
          <Text
            style={{
              fontFamily: feedType.tile.fontFamily,
              fontSize: 14,
              lineHeight: 17,
              fontWeight: "800",
              color: feed.text,
              marginTop: space.xs,
            }}
            numberOfLines={2}
          >
            {p.title}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
