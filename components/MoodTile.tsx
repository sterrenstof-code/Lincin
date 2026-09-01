import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

import { MoreDot, PinMark } from "@/components/MoodBoard";
import { coverUrlFor } from "@/components/PostGrid";
import { SafeImage } from "@/components/SafeImage";
import { KIND_LABELS, type PostWithAuthor } from "@/lib/api/posts";
import {
  creamOnDark,
  feed,
  feedType,
  flameDeep,
  rule,
  SERIF_FAMILY,
  space,
} from "@/lib/design/type";
import { useHeroTag, withHeroTransition } from "@/lib/hero-transition";
import { stripMarkdown } from "@/lib/richtext";

/**
 * Eén ding op het bord.
 *
 * ---------------------------------------------------------------
 * WAT ER OP EEN TEGEL STAAT
 * ---------------------------------------------------------------
 * Zo min mogelijk. Een moodboard werkt doordat de dingen zelf spreken; wie
 * er onder élke tegel een naam en een datum zet, maakt er een lijst van.
 * Dus: het beeld, en verder alleen wat je niet kúnt zien — dat er meer
 * achter zit (het stipje), dat hij vastgeprikt is, en dat het bewegend
 * beeld is.
 *
 * Een tegel zónder beeld is het andere geval: dan ís de tekst het beeld,
 * en dan mag hij de hele tegel hebben. Dat is dezelfde opbouw als een
 * colofon — waar het over gaat, een lijn, en dan het stuk zelf in de
 * serif.
 */
export function MoodTile({
  post,
  editable,
  onOpen,
  onOptions,
}: {
  post: PostWithAuthor;
  editable: boolean;
  onOpen: () => void;
  onOptions: () => void;
}) {
  const tag = useHeroTag(post.id);
  const cover = coverUrlFor(post);
  const hasClip = !!post.video_url;
  const album = post.album_urls ?? [];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={tileLabel(post)}
      onPress={() => withHeroTransition(onOpen)}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: feed.post,
        overflow: "hidden",
        ...tag,
      }}
    >
      {post.kind === "swatch" && post.swatch_hex ? (
        <SwatchFace hex={post.swatch_hex} name={post.caption?.trim() || null} />
      ) : post.kind === "quote" ? (
        <QuoteFace post={post} />
      ) : cover ? (
        <SafeImage
          uri={cover}
          cacheKey={post.image_path ?? post.meta?.image_url ?? post.id}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          fallbackBg="bg-feed-fill"
          fallbackColor={feed.textDim}
        />
      ) : (
        <TextFace post={post} />
      )}

      {/* Bewegend beeld is niet te zien aan een stilstaand voorblad, en dat
          is precies het geval waarin je het wél moet weten voordat je tikt. */}
      {hasClip ? <Badge icon="play" label="Clip" /> : null}
      {!hasClip && album.length > 1 ? (
        <Badge icon="copy-outline" label={String(album.length)} />
      ) : null}

      {post.pinned_at ? <PinMark /> : null}

      {/* Op je eigen bord is het stipje de knop naar de opties van deze
          tegel; op andermans bord zegt het alleen dát er meer achter zit.
          Zie MoreDot in components/MoodBoard.tsx. */}
      {editable ? (
        <MoreDot onPress={onOptions} label={`Opties voor ${tileLabel(post)}`} />
      ) : hasMoreThanCover(post) ? (
        <MoreDot label="Meer informatie" />
      ) : null}
    </Pressable>
  );
}

/** Zit er meer achter dan wat je ziet? Zie components/PostGrid.tsx. */
export function hasMoreThanCover(post: PostWithAuthor): boolean {
  // Een staal en een citaat tónen zichzelf al volledig; er is niets achter.
  if (post.kind === "swatch" || post.kind === "quote") return false;
  if (!coverUrlFor(post)) return false;
  return (
    !!post.caption?.trim() ||
    !!post.body_text?.trim() ||
    !!post.link_url ||
    !!post.video_url ||
    (post.album_urls?.length ?? 0) > 1
  );
}

function tileLabel(post: PostWithAuthor): string {
  return (
    post.caption?.trim() ||
    post.source_title?.trim() ||
    stripMarkdown(post.body_text).slice(0, 60) ||
    KIND_LABELS[post.kind ?? "note"] ||
    "Vondst"
  );
}

/**
 * Het merkje rechtsonder: een clip, of hoeveel foto's er nog volgen.
 *
 * Zwart met crème in béide standen (§2) — het ligt op een foto, en een
 * vlak op een foto kantelt niet mee met het blad eronder.
 */
function Badge({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        bottom: space.sm,
        right: space.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        backgroundColor: feed.ink,
        paddingHorizontal: 6,
        height: 20,
      }}
    >
      <Ionicons name={icon} size={10} color={creamOnDark.DEFAULT} />
      <Text style={[feedType.label, { fontSize: 9, color: creamOnDark.DEFAULT }]}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

/**
 * Een tegel zonder beeld.
 *
 * Dezelfde opbouw als in het raster van de feed — rubriek, lijn, en dan het
 * stuk in de serif — want het is hetzelfde ding op een andere plek, en twee
 * vormen voor één ding is precies waar §8 over gaat.
 */
function TextFace({ post }: { post: PostWithAuthor }) {
  const kicker = KIND_LABELS[post.kind ?? "note"] ?? "Notitie";
  const title = post.source_title?.trim() || post.caption?.trim() || null;
  const lead = stripMarkdown(post.body_text) || post.link_url || "";
  const body = title && lead === title ? "" : lead;

  return (
    <View style={{ flex: 1, padding: space.lg }}>
      <Text
        style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}
        numberOfLines={1}
      >
        {kicker.toUpperCase()}
      </Text>
      <View
        style={{
          height: 1,
          backgroundColor: rule.soft,
          marginTop: 5,
          marginBottom: 9,
        }}
      />
      {title ? (
        <Text
          style={{
            fontFamily: SERIF_FAMILY,
            fontSize: 16,
            lineHeight: 21,
            letterSpacing: -0.1,
            color: feed.text,
            marginBottom: body ? 6 : 0,
          }}
          numberOfLines={3}
        >
          {title}
        </Text>
      ) : null}
      {body ? (
        <Text
          style={{
            fontFamily: SERIF_FAMILY,
            fontSize: title ? 13 : 16,
            lineHeight: title ? 18 : 22,
            letterSpacing: -0.1,
            color: title ? feed.textDim : feed.text,
            flex: 1,
          }}
          numberOfLines={title ? 4 : 8}
        >
          {body}
        </Text>
      ) : null}
    </View>
  );
}


/**
 * Een kleur, en verder niets.
 *
 * Het hele vlak is de kleur — geen kader, geen kicker, geen naam tenzij je
 * er een gaf. Dat is de bedoeling van een staal: je kijkt ernaar en je ziet
 * de kleur, niet een kaartje waar een kleur op staat.
 *
 * De naam eronderin leest in inkt of crème, afhankelijk van hoe donker het
 * staal is. Dat is de enige plek in de app waar een tekstkleur uit een
 * berekening komt in plaats van uit een token — en dat kan niet anders,
 * want de ondergrond is hier door de gebruiker gekozen en niet door §2.
 */
function SwatchFace({ hex, name }: { hex: string; name: string | null }) {
  const onDark = isDarkHex(hex);
  return (
    <View style={{ flex: 1, backgroundColor: hex, justifyContent: "flex-end" }}>
      <View style={{ padding: space.lg }}>
        <Text
          style={[
            feedType.label,
            { color: onDark ? creamOnDark.DEFAULT : feed.ink, opacity: 0.85 },
          ]}
          numberOfLines={1}
        >
          {name ?? hex.toUpperCase()}
        </Text>
      </View>
    </View>
  );
}

/**
 * Hoe donker is deze kleur?
 *
 * De gewogen som van rood, groen en blauw zoals het oog ze ziet — groen
 * telt zwaarder dan blauw, want een fel groen leest lichter dan een even
 * "hoog" blauw. Onder de helft zetten we er crème op, erboven inkt.
 *
 * Geen `luminance`-bibliotheek voor drie vermenigvuldigingen, en geen
 * contrastberekening op WCAG-niveau: er staat één regel label op, en de
 * vraag is alleen of hij licht of donker moet zijn.
 */
export function isDarkHex(hex: string): boolean {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

/**
 * Een zin, groot gezet.
 *
 * De serif en niet de grotesk: dit is het redactionele moment waar §3 het
 * over heeft — een citaat is precies waarvoor het affiche-systeem bestaat.
 * Het aanhalingsteken staat er als teken en niet als leesteken in de tekst,
 * zodat de zin zelf op de kantlijn begint.
 */
function QuoteFace({ post }: { post: PostWithAuthor }) {
  const text = stripMarkdown(post.body_text) || post.caption?.trim() || "";
  const who = post.source_author?.trim() || post.source_title?.trim() || null;
  return (
    <View style={{ flex: 1, padding: space.lg, justifyContent: "center" }}>
      <Text
        style={{
          fontFamily: SERIF_FAMILY,
          fontSize: 34,
          lineHeight: 34,
          color: flameDeep,
          marginBottom: 2,
        }}
      >
        &#8220;
      </Text>
      <Text
        style={{
          fontFamily: SERIF_FAMILY,
          fontSize: 19,
          lineHeight: 25,
          letterSpacing: -0.2,
          color: feed.text,
        }}
        numberOfLines={7}
      >
        {text}
      </Text>
      {who ? (
        <Text
          style={[feedType.label, { color: feed.textDim, marginTop: space.md }]}
          numberOfLines={1}
        >
          {who}
        </Text>
      ) : null}
    </View>
  );
}
