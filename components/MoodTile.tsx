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
      {cover ? (
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
