import { Ionicons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { Embed } from "@/components/Embed";
import { SafeImage } from "@/components/SafeImage";
import { Arrow, Meta, Rule, TagRow } from "@/components/Editorial";
import { cream, flame, ink, line, type } from "@/lib/design/type";
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
 * De feed is een *gedrukte pagina*: warm papier, inkt, haarlijnen van rand
 * tot rand. Fragmenten zijn de uitzondering — die keren om naar de donkere
 * schil, zoals een affiche dat één blok zwart zet om het te laten opvallen.
 *
 * Eén regel houdt alles samen: **de bron krijgt de serif, de deler de sans.**
 * Wat iemand gevonden heeft weegt zwaarder dan wat die erover zegt.
 *
 * De chrome eromheen (kicker, reacties, menu) zit in de feed zelf.
 */

type FindMeta = Partial<LinkPreview>;

async function openUrl(url: string) {
  try {
    if (Platform.OS === "web") {
      await Linking.openURL(url);
    } else {
      await WebBrowser.openBrowserAsync(url, {
        toolbarColor: "#F5EFE2",
        controlsColor: "#1A1714",
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
      return <StatementBody post={post} accent={post.kind === "idea"} />;
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
// De toelichting van de deler — altijd sans, altijd ondergeschikt
// ---------------------------------------------------------------

function SharerNote({ text }: { text?: string | null }) {
  if (!text || !text.trim()) return null;
  return (
    <View className="px-5 pt-3">
      <Text style={[type.body, { color: ink.soft }]}>{text.trim()}</Text>
    </View>
  );
}

function TagsBlock({ tags }: { tags?: string[] | null }) {
  if (!tags || tags.length === 0) return null;
  return (
    <View className="px-5">
      <TagRow tags={tags} tone="paper" />
    </View>
  );
}

// ---------------------------------------------------------------
// FRAGMENT — de omkering: zwart blok op de pagina
// ---------------------------------------------------------------

function FragmentBody({ post }: { post: PostWithAuthor }) {
  const body = post.body_text?.trim() || post.caption?.trim() || "";
  const long = body.length > 220;
  const attribution = [post.source_author, post.source_title].filter(Boolean).join(", ");

  return (
    <View>
      <View className="bg-shell px-5 pt-6 pb-6 mt-3">
        {/* Het aanhalingsteken als grafisch element, niet als leesteken */}
        <Text
          style={{
            fontFamily: type.display.fontFamily,
            fontSize: 52,
            lineHeight: 42,
            color: cream.muted,
            marginBottom: 8,
          }}
        >
          {"“"}
        </Text>

        <Text style={[long ? type.quote : type.quoteLarge, { color: cream.DEFAULT }]}>
          {body}
        </Text>

        {attribution ? (
          <View className="mt-5">
            <View style={{ width: 44 }}>
              <Rule tone="shell" />
            </View>
            <Text style={[type.caption, { color: cream.soft, marginTop: 10 }]}>
              {attribution}
            </Text>
          </View>
        ) : null}

        {post.link_url ? (
          <Pressable
            onPress={() => openUrl(post.link_url!)}
            className="flex-row items-center mt-4"
          >
            <Meta tone="shell" dim>
              {hostnameOf(post.link_url)}
            </Meta>
            <View className="ml-2">
              <Arrow tone="shell" size={12} dim />
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
// WEETJE / IDEE — serif met een verticale lijn ernaast
// ---------------------------------------------------------------

function StatementBody({ post, accent }: { post: PostWithAuthor; accent: boolean }) {
  const body = post.body_text?.trim() || post.caption?.trim() || "";
  const attribution = [post.source_author, post.source_title].filter(Boolean).join(", ");

  return (
    <View>
      <View className="flex-row px-5 pt-3">
        <View
          style={{
            width: accent ? 2 : StyleSheet.hairlineWidth,
            backgroundColor: accent ? flame : line.paper,
            marginRight: 16,
          }}
        />
        <View className="flex-1">
          <Text style={[type.quote, { color: ink.DEFAULT }]}>{body}</Text>
          {attribution ? (
            <Text style={[type.caption, { color: ink.muted, marginTop: 10 }]}>
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
// VIDEO — beeld van rand tot rand, onderschrift eronder
// ---------------------------------------------------------------

function VideoBody({ post, meta }: { post: PostWithAuthor; meta: FindMeta }) {
  const [playing, setPlaying] = useState(false);
  const url = post.link_url ?? meta.canonical_url ?? null;
  const duration = formatDuration(meta.duration_s);
  const title = meta.title ?? post.source_title ?? null;

  return (
    <View>
      {playing && meta.embed_url ? (
        <View className="mt-3">
          <Embed url={meta.embed_url} aspectRatio={16 / 9} />
        </View>
      ) : (
        <Pressable
          onPress={() => {
            if (meta.embed_url) setPlaying(true);
            else if (url) openUrl(url);
          }}
          className="mt-3"
        >
          <View className="bg-paper-warm" style={{ width: "100%", aspectRatio: 16 / 9 }}>
            <SafeImage
              uri={meta.image_url ?? null}
              cacheKey={meta.canonical_url ?? url ?? undefined}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={150}
              fallbackIcon="play-outline"
              fallbackBg="bg-paper-warm"
              fallbackColor="#5A4F40"
            />
            {/* Dunne speelknop — een affiche schreeuwt niet */}
            <View className="absolute inset-0 items-center justify-center">
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  borderWidth: 1,
                  borderColor: cream.DEFAULT,
                  backgroundColor: "rgba(10,10,11,0.32)",
                }}
                className="items-center justify-center"
              >
                <Ionicons name="play" size={20} color={cream.DEFAULT} style={{ marginLeft: 3 }} />
              </View>
            </View>
            {duration ? (
              <View className="absolute bottom-0 right-0 bg-shell px-2 py-1">
                <Meta tone="shell">{duration}</Meta>
              </View>
            ) : null}
          </View>
        </Pressable>
      )}

      <View className="px-5 pt-3">
        <Meta tone="paper" dim>
          {[meta.site_name ?? (url ? hostnameOf(url) : ""), meta.author ?? ""]
            .filter(Boolean)
            .join("  ·  ")}
        </Meta>
        {title ? (
          <Pressable onPress={() => url && openUrl(url)} className="flex-row items-start mt-1.5">
            <Text style={[type.headline, { color: ink.DEFAULT, flex: 1 }]}>{title}</Text>
            <View className="pt-1.5 pl-3">
              <Arrow tone="paper" dim />
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
// MUZIEK — hoes links, speler klapt uit
// ---------------------------------------------------------------

function MusicBody({ post, meta }: { post: PostWithAuthor; meta: FindMeta }) {
  const [playing, setPlaying] = useState(false);
  const url = post.link_url ?? meta.canonical_url ?? null;

  if (playing && meta.embed_url) {
    return (
      <View>
        <View className="mt-3">
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
        className="flex-row items-center px-5 pt-3.5"
      >
        <SafeImage
          uri={meta.image_url ?? null}
          cacheKey={meta.canonical_url ?? url ?? undefined}
          style={{ width: 76, height: 76 }}
          contentFit="cover"
          fallbackIcon="musical-notes-outline"
          fallbackBg="bg-paper-warm"
          fallbackColor="#5A4F40"
        />
        <View className="flex-1 px-4">
          <Text style={[type.headlineSmall, { color: ink.DEFAULT }]} numberOfLines={2}>
            {meta.title ?? post.source_title ?? (url ? hostnameOf(url) : "Muziek")}
          </Text>
          <View className="mt-1.5">
            <Meta tone="paper" dim numberOfLines={1}>
              {[meta.author ?? post.source_author ?? "", meta.site_name ?? ""]
                .filter(Boolean)
                .join("  ·  ")}
            </Meta>
          </View>
        </View>
        <View
          style={{ borderWidth: StyleSheet.hairlineWidth, borderColor: flame }}
          className="w-10 h-10 items-center justify-center"
        >
          <Ionicons name="play" size={15} color={flame} style={{ marginLeft: 2 }} />
        </View>
      </Pressable>

      <SharerNote text={post.caption} />
      <TagsBlock tags={post.tags} />
    </View>
  );
}

// ---------------------------------------------------------------
// ARTIKEL / LINK — bron, kop, aanzet
// ---------------------------------------------------------------

function ArticleBody({ post, meta }: { post: PostWithAuthor; meta: FindMeta }) {
  const url = post.link_url ?? meta.canonical_url ?? null;
  const readingTime = formatReadingTime(meta.word_count);
  const source = meta.site_name ?? (url ? hostnameOf(url) : null);
  const title = meta.title ?? post.source_title ?? null;

  return (
    <View>
      {meta.image_url ? (
        <Pressable onPress={() => url && openUrl(url)} className="mt-3">
          <SafeImage
            uri={meta.image_url}
            cacheKey={meta.canonical_url ?? url ?? undefined}
            style={{ width: "100%", aspectRatio: 2 }}
            contentFit="cover"
            transition={150}
            fallbackBg="bg-paper-warm"
            fallbackColor="#5A4F40"
          />
        </Pressable>
      ) : null}

      <Pressable onPress={() => url && openUrl(url)} className="px-5 pt-3">
        <Meta tone="paper" dim>
          {[source, meta.author, readingTime].filter(Boolean).join("  ·  ")}
        </Meta>

        <View className="flex-row items-start mt-1.5">
          <Text style={[type.headline, { color: ink.DEFAULT, flex: 1 }]}>
            {title ?? (url ? hostnameOf(url) : "Link")}
          </Text>
          <View className="pt-1.5 pl-3">
            <Arrow tone="paper" dim />
          </View>
        </View>

        {meta.description ? (
          <Text
            style={[type.bodySmall, { color: ink.muted, marginTop: 6 }]}
            numberOfLines={3}
          >
            {meta.description}
          </Text>
        ) : null}

        {/* Onderstreepte URL als voetnoot, alleen als er geen titel is */}
        {!title && url ? (
          <Text
            style={[
              type.bodySmall,
              { color: ink.muted, marginTop: 4, textDecorationLine: "underline" },
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
// FOTO — beeld met onderschrift in cursieve serif
// ---------------------------------------------------------------

function ImageBody({ post, onPress }: { post: PostWithAuthor; onPress?: () => void }) {
  const [ratio, setRatio] = useState<number | undefined>(undefined);
  return (
    <View>
      <Pressable onPress={onPress} className="mt-3 bg-paper-warm">
        <SafeImage
          uri={post.image_url}
          cacheKey={post.image_path ?? undefined}
          style={{
            width: "100%",
            aspectRatio: ratio ? Math.min(Math.max(ratio, 0.66), 1.9) : 1,
          }}
          contentFit="cover"
          transition={150}
          fallbackBg="bg-paper-warm"
          fallbackColor="#5A4F40"
          onLoad={(e) => {
            const { width, height } = (e as any).source ?? {};
            if (width && height) setRatio(width / height);
          }}
        />
      </Pressable>
      {post.caption?.trim() ? (
        <View className="px-5 pt-2.5">
          <Text style={[type.caption, { color: ink.soft }]}>{post.caption.trim()}</Text>
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
      <View className="px-5 pt-3">
        <Text
          style={[short ? type.quote : type.body, { color: short ? ink.DEFAULT : ink.soft }]}
        >
          {text}
        </Text>
      </View>
      {post.image_path ? (
        <View className="mt-3">
          <SafeImage
            uri={post.image_url}
            cacheKey={post.image_path}
            style={{ width: "100%", aspectRatio: 1.5 }}
            contentFit="cover"
            fallbackBg="bg-paper-warm"
            fallbackColor="#5A4F40"
          />
        </View>
      ) : null}
      <TagsBlock tags={post.tags} />
    </View>
  );
}
