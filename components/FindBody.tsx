import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Embed } from "@/components/Embed";
import { SafeImage } from "@/components/SafeImage";
import { Arrow, Meta, Rule, TagRow, useWide } from "@/components/Editorial";
import { carbon, page, rule, type } from "@/lib/design/type";
import {
  formatDuration,
  formatReadingTime,
  hostnameOf,
  type LinkPreview,
} from "@/lib/api/unfurl";
import type { PostWithAuthor } from "@/lib/api/posts";

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
