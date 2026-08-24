import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import { SafeImage } from "@/components/SafeImage";
import { Scrim } from "@/components/Scrim";
import { Skeleton } from "@/components/Skeleton";
import { feed, FEED_BORDER, feedType, space } from "@/lib/design/type";
import { heroTag, withHeroTransition } from "@/lib/hero-transition";
import type { PostWithAuthor } from "@/lib/api/posts";

/**
 * Alle vondsten van één persoon als raster.
 *
 * ---------------------------------------------------------------
 * WAAROM ÉÉN COMPONENT VOOR TWEE PAGINA'S
 * ---------------------------------------------------------------
 * Je eigen profiel en dat van iemand anders toonden hetzelfde raster op
 * twee manieren: één met afgeronde hoeken en losse hexwaarden, één dat er
 * helemaal niet was. Nu is het één ding, dus ook één maatvoering, en
 * groeit een tegel op beide plekken uit tot de volledige plaat — dezelfde
 * beweging als vanuit de feed.
 *
 * De cel is vierkant en de tegels raken elkaar met één maat ertussen; het
 * raster is de structuur, niet de kaartjes.
 */
export function PostGrid({
  posts,
  loading,
  emptyLabel,
}: {
  posts: PostWithAuthor[] | undefined;
  loading?: boolean;
  emptyLabel: string;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Een tegel mag nooit smaller dan ongeveer 150px worden: daaronder is een
  // foto geen foto meer maar een kleurvlak.
  const columns = width < 560 ? 2 : width < 900 ? 3 : 4;

  if (loading) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -space.xs }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ width: `${100 / columns}%`, padding: space.xs }}>
            <Skeleton style={{ width: "100%", aspectRatio: 1, borderRadius: 0 }} />
          </View>
        ))}
      </View>
    );
  }

  if (!posts || posts.length === 0) {
    return (
      <View style={{ backgroundColor: feed.panel, padding: space.xl }}>
        <Text style={[feedType.body, { color: feed.ink }]}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -space.xs }}>
      {posts.map((post) => (
        <View key={post.id} style={{ width: `${100 / columns}%`, padding: space.xs }}>
          <Pressable
            onPress={() => withHeroTransition(() => router.push(`/post/${post.id}`))}
            style={{
              width: "100%",
              aspectRatio: 1,
              backgroundColor: feed.post,
              borderWidth: FEED_BORDER,
              borderColor: feed.ink,
              // Ankerpunt van de morph: deze tegel groeit uit tot de plaat
              // op de detailpagina.
              ...heroTag(post.id),
            }}
          >
            <Cell post={post} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Cell({ post }: { post: PostWithAuthor }) {
  const album = post.album_urls ?? [];

  if (post.image_url) {
    return (
      <>
        <SafeImage
          uri={post.image_url}
          cacheKey={post.image_path ?? post.id}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
          fallbackBg="bg-feed-post"
          fallbackColor={feed.textDim}
        />
        <Scrim height={72} strength={0.6} steps={8} />
        <View
          style={{
            position: "absolute",
            left: space.sm,
            right: space.sm,
            bottom: space.sm,
            flexDirection: "row",
            alignItems: "center",
            gap: space.xs,
          }}
        >
          {album.length > 1 ? (
            <>
              <Ionicons name="copy-outline" size={12} color={feed.text} />
              <Text style={[feedType.label, { color: feed.text }]}>{album.length}</Text>
            </>
          ) : null}
          <Text
            style={[feedType.label, { color: feed.text, opacity: 0.8, flex: 1, textAlign: "right" }]}
            numberOfLines={1}
          >
            {post.interaction_count > 0 ? `${post.interaction_count}` : ""}
          </Text>
        </View>
      </>
    );
  }

  // Geen foto: dan is de tekst het beeld.
  const text = post.caption?.trim() || post.body_text?.trim() || post.link_url || "";
  return (
    <View style={{ flex: 1, padding: space.md, justifyContent: "space-between" }}>
      <Ionicons
        name={post.link_url ? "link-outline" : "text-outline"}
        size={14}
        color={feed.textDim}
      />
      <Text
        style={[
          feedType.tile,
          { fontSize: 13, lineHeight: 17, color: feed.text },
        ]}
        numberOfLines={4}
      >
        {text}
      </Text>
    </View>
  );
}
