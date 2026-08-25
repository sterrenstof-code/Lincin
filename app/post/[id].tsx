import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useIsFocused } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { MentionsText } from "@/components/MentionsText";
import { useWide } from "@/components/Editorial";
import {
  AppChrome,
  CHROME_COMPACT_H,
  PageScroll,
  useChromeScroll,
} from "@/components/AppChrome";
import { InteractionPeople } from "@/components/InteractionPeople";
import { PostCarousel } from "@/components/PostCarousel";
import { SafeImage } from "@/components/SafeImage";
import { Scrim } from "@/components/Scrim";
import { PostReactions } from "@/components/PostReactions";
import { PostSignalBar } from "@/components/PostSignalBar";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import {
  announce,
  CONTROL_H,
  feed,
  FEED_BORDER,
  feedType,
  flameDeep,
  gutter,
  space,
} from "@/lib/design/type";
import {
  addEntityComment,
  deleteEntityComment,
  listEntityComments,
  subscribeToEntityComments,
  type EntityComment,
} from "@/lib/api/entity-comments";
import { deletePost, getAlbumUrls, type PostWithAuthor } from "@/lib/api/posts";
import { getProfile } from "@/lib/api/profiles";
import { confirm } from "@/lib/confirm";
import { emojiSuggestionsFor, replaceEmoticons } from "@/lib/emoji";
import { asideTag, useHeroTag } from "@/lib/hero-transition";
import { markSeen } from "@/lib/read-state";
import { safeBack } from "@/lib/nav";
import { useMentions } from "@/lib/useMentions";
import { IMG, signedImageUrl } from "@/lib/media";
import { supabase } from "@/lib/supabase/client";

export default function PostDetailScreen() {
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();

  /** De verhouding van de foto, zodra hij binnen is. */
  const [imageRatio, setImageRatio] = useState<number | null>(null);

  /**
   * Breedte van de gesprekskolom, afgeleid van de foto.
   *
   * ---------------------------------------------------------------
   * WAAROM DE FOTO DE VERDELING BEPAALT
   * ---------------------------------------------------------------
   * De plaat vult de hoogte van het venster en wordt niet bijgesneden. Een
   * staande foto heeft bij die hoogte dus maar wéinig breedte nodig; geef
   * je hem meer, dan staat die ruimte leeg naast de foto — precies wat er
   * gebeurde: een portret in het midden van een kolom van zeventig procent,
   * met lavendel aan weerszijden.
   *
   * Dus rekenen we terug: bij deze hoogte is de foto zó breed, en wat
   * overblijft is voor het gesprek. Een liggende foto vraagt vanzelf meer
   * en houdt het gesprek smal; een staande vraagt weinig en geeft het
   * gesprek de ruimte.
   *
   * De grenzen zijn er voor de uitersten. Een panorama mag de kolom niet
   * opeten (hoogstens 62%), een heel smal portret mag de foto niet tot een
   * strookje knijpen (minstens 28%), en het gesprek blijft tussen een
   * leesbare 320 en 620 — daarboven worden regels te lang om te lezen.
   */
  const conversationWidth = (() => {
    const available = windowWidth - gutter(true) - space.xxl;
    // Wat de plaat aan hoogte krijgt: het venster min de balk en de marge.
    const plateHeight = windowHeight - CHROME_COMPACT_H - gutter(true);
    const natural = imageRatio ? plateHeight * imageRatio : available * 0.6;
    const plateWidth = Math.min(
      Math.max(natural, available * 0.28),
      available * 0.62
    );
    return Math.round(Math.min(Math.max(available - plateWidth, 320), 620));
  })();

  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  // Alleen het scherm dat je aankijkt draagt de naam van het gedeelde
  // element — zie useHeroTag.
  const heroStyle = useHeroTag(String(id));
  // Alleen het scherm dat je aankijkt draagt de naam; twee elementen met
  // dezelfde naam laat de browser de hele overgang overslaan.
  const asideStyle = asideTag(useIsFocused());
  const { session } = useAuth();
  const myUserId = session?.user.id;

  // Zodra je een vondst opent telt hij als gezien; de feed dimt hem daarna.
  // Lokaal opgeslagen — zie lib/read-state.ts voor waarom niet op de server.
  useEffect(() => {
    if (id) markSeen(String(id));
  }, [id]);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [comments, setComments] = useState<EntityComment[] | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [emojiList, setEmojiList] = useState<{ name: string; emoji: string }[] | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  /**
   * Een gif of een meme die klaarstaat om mee te gaan met je reactie.
   * Beeld is hier geen bijlage maar het antwoord zelf — daarom mag de
   * tekst leeg blijven zolang dit gevuld is.
   */
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  // @-suggesties. Zonder vriendenlijst als startpunt: op een vondst noem
  // je net zo goed iemand die je nog niet hebt toegevoegd, en de zoektocht
  // op de server dekt beide.
  const {
    mentionList,
    onChangeText: onMentionChange,
    applyMention,
  } = useMentions({ draft, setDraft, candidates: [] });
  const inputRef = useRef<TextInput>(null);

  const post = useQuery({
    queryKey: ["post", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("posts")
        .select("id, user_id, image_path, caption, link_url, created_at")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const author = await getProfile(data.user_id);
      const [imageUrl, albumUrls] = await Promise.all([
        signedImageUrl("posts", data.image_path, IMG.hero),
        getAlbumUrls(String(id)),
      ]);
      // `album_urls` blijft optioneel, net als op PostWithAuthor: de feed
      // in de cache dient als beginwaarde en moet dezelfde vorm hebben.
      return {
        ...data,
        author,
        image_url: imageUrl,
        ...(albumUrls.length > 0 ? { album_urls: albumUrls } : null),
      } as PostWithAuthor;
    },
    enabled: !!id,
    initialData: () => {
      if (!id || !myUserId) return undefined;
      const sources = [
        qc.getQueryData<PostWithAuthor[]>(["feed", myUserId]),
        qc.getQueryData<PostWithAuthor[]>(["posts-by-user", myUserId]),
      ];
      for (const list of sources) {
        const match = list?.find((p) => p.id === id);
        if (match) return match;
      }
      return undefined;
    },
    initialDataUpdatedAt: () =>
      qc.getQueryState(["feed", myUserId])?.dataUpdatedAt,
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      const list = await listEntityComments("post", id);
      if (!cancelled) setComments(list);
    })();
    const channel = subscribeToEntityComments("post", id, (c) => {
      setComments((prev) => {
        if (!prev) return [c];
        if (prev.some((x) => x.id === c.id)) return prev;
        return [...prev, c];
      });
    });
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Focus input bij reply
  useEffect(() => {
    if (!replyTo) return;
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [replyTo]);

  function onDraftChange(text: string) {
    const converted = replaceEmoticons(text);
    setDraft(converted);
    onMentionChange(converted);
    // Emoji autocomplete
    const match = converted.match(/:([a-z0-9_+\-]{2,})$/i);
    if (match) {
      const suggestions = emojiSuggestionsFor(match[1]);
      setEmojiList(suggestions.length > 0 ? suggestions : null);
    } else {
      setEmojiList(null);
    }
  }

  /**
   * Een gif of meme kiezen. Uit je bibliotheek, want een gif die je ergens
   * ziet bewaar je daar ook — en een eigen zoekdienst zou een sleutel en
   * een account bij een derde vragen voor iets wat je toestel al kan.
   */
  async function onPickCommentImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setCommentError("Geen toegang tot je foto's.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      // Niet comprimeren: dat maakt van een bewegende gif één beeld.
      quality: 1,
      allowsEditing: false,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    setPendingImage(result.assets[0].uri);
  }

  function applyEmoji(name: string, emoji: string) {
    const replaced = draft.replace(/:([a-z0-9_+\-]{2,})$/i, emoji + " ");
    setDraft(replaced);
    setEmojiList(null);
  }

  function onKeyPress(e: any) {
    if (Platform.OS !== "web") return;
    const key = e?.nativeEvent?.key;
    if (key === "Tab") {
      e.preventDefault?.();
      if (emojiList && emojiList.length > 0) {
        applyEmoji(emojiList[0].name, emojiList[0].emoji);
      }
      return;
    }
    if (key === "Enter" && !e?.nativeEvent?.shiftKey) {
      e.preventDefault?.();
      if (!sending && draft.trim()) onSend();
    }
  }

  async function onSend() {
    if (!myUserId || !id) return;
    const text = draft.trim();
    if (!text && !pendingImage) return;
    setSending(true);
    setCommentError(null);
    // Replies: prefix met @naam
    const body = replyTo && text ? `@${replyTo.name} ${text}` : text;
    try {
      const created = await addEntityComment({
        entityType: "post",
        entityId: id,
        userId: myUserId,
        body,
        ownerId: post.data?.user_id,
        imageUri: pendingImage,
      });
      setPendingImage(null);
      setDraft("");
      setReplyTo(null);
      setEmojiList(null);
      setComments((prev) => {
        if (!prev) return [created];
        if (prev.some((c) => c.id === created.id)) return prev;
        return [...prev, created];
      });
      qc.invalidateQueries({ queryKey: ["feed", myUserId] });
    } catch (e: any) {
      setCommentError(humanizeCommentError(e));
    } finally {
      setSending(false);
    }
  }

  async function onDeleteComment(commentId: string) {
    setCommentError(null);
    try {
      await deleteEntityComment(commentId);
      setComments((prev) => prev?.filter((c) => c.id !== commentId) ?? null);
    } catch (e: any) {
      setCommentError(humanizeCommentError(e));
    }
  }

  const canModerate = post.data?.user_id === myUserId;

  async function onDeletePost() {
    if (!post.data) return;
    const confirmed = await confirm(
      "Foto verwijderen",
      "Deze foto wordt definitief verwijderd, samen met alle reacties.",
      { affirmativeLabel: "Verwijder", destructive: true }
    );
    if (!confirmed) return;
    setDeleteError(null);
    try {
      await deletePost({
        id: post.data.id,
        user_id: post.data.user_id,
        image_path: post.data.image_path,
        caption: post.data.caption,
        link_url: post.data.link_url ?? null,
        created_at: post.data.created_at,
      });
      await qc.invalidateQueries({ queryKey: ["feed"] });
      await qc.invalidateQueries({ queryKey: ["posts-by-user"] });
      safeBack(router, "/(app)/feed");
    } catch (e: any) {
      setDeleteError(e?.message ?? "Kon foto niet verwijderen.");
    }
  }

  /** Naam, avatar en doorklik naar het profiel — op de foto of ernaast. */
  const authorRow = (onPaper: boolean) => (
    <Pressable
      onPress={() => post.data?.author?.username && router.push(`/user/${post.data.author.username}`)}
      className="flex-row items-center"
    >
      <Avatar
        name={post.data?.author?.display_name ?? post.data?.author?.username}
        avatarUrl={post.data?.author?.avatar_url}
        size="md"
        tint="warm"
      />
      <View className="flex-1 ml-3">
        <Text
          style={[
            feedType.label,
            { fontSize: 15, fontWeight: "700", color: onPaper ? feed.ink : "#FFFFFF" },
          ]}
        >
          {post.data?.author?.display_name ?? post.data?.author?.username ?? "Onbekend"}
        </Text>
        <Text
          style={[feedType.label, { color: onPaper ? feed.inkDim : "rgba(255,255,255,0.7)" }]}
        >
          @{post.data?.author?.username ?? "?"}
        </Text>
      </View>
      <Ionicons
        name="chevron-forward"
        color={onPaper ? feed.inkDim : "rgba(255,255,255,0.7)"}
        size={18}
      />
    </Pressable>
  );

  // ---------------------------------------------------------------
  // De stukken van deze pagina
  // ---------------------------------------------------------------
  //
  // Ze staan hier als losse blokken en niet als één boom, omdat de
  // pagina twee indelingen heeft: op een telefoon staat het gesprek
  // ónder de foto, op een breed scherm ernáást. Zelfde stukken, andere
  // volgorde — zie de twee `return`s onderaan.

  const loading = post.isLoading || !post.data;

  /**
   * Heeft deze vondst iets te tónen?
   *
   * Zonder beeld is er niets om de halve pagina mee te vullen: een link,
   * een notitie of een fragment is tekst, en tekst naast een leeg vlak
   * zetten maakt het niet leesbaarder. Dan krijgt het gesprek de hele
   * bladspiegel, op zijn eigen leesmaat gecentreerd.
   */
  const hasPlate =
    !!post.data?.image_url || (post.data?.album_urls?.length ?? 0) > 0 || loading;

  /** De plaat zelf. Op breed vult hij de kolom, op smal de bladbreedte. */
  const heroBlock = (fill: boolean) => (
    <View
      style={{
        width: "100%",
        /**
         * Op breed vult de plaat de hoogte van het venster. Op smal krijgt
         * hij de volle breedte en bepaalt de fóto hoe hoog hij wordt: een
         * vaste hoogte van 62% van het scherm sneed elke staande foto af
         * precies waar het onderwerp stond. Zolang de verhouding nog niet
         * binnen is houden we 4:5 aan — de maat van een telefoonfoto, dus
         * de sprong bij aankomst is klein.
         */
        ...(fill
          ? { height: "100%" as const }
          : { aspectRatio: imageRatio ?? 4 / 5 }),
        // Naast het gesprek staat de foto op de pagina zelf. Een plum vlak
        // eronder werd bij een staande foto een rand aan weerszijden — een
        // kader dat niemand gevraagd had. Onder een gesprek (smal) vult de
        // foto zijn vlak wél, en dan is het vlak zijn achtergrond.
        backgroundColor: fill ? "transparent" : feed.post,
        justifyContent: "flex-end",
        // Zelfde naam als de tegel in de feed: de browser morpht het ene
        // vlak naar het andere.
        ...heroStyle,
      }}
    >
      {(post.data?.album_urls?.length ?? 0) > 1 ? (
        // Een album: blader erdoorheen op de plek waar anders de ene foto
        // staat. Zelfde vlak, zelfde maat, alleen meer om te zien.
        <PostCarousel
          urls={post.data!.album_urls!}
          style={{ position: "absolute", width: "100%", height: "100%" }}
          contentFit={fill ? "contain" : "cover"}
        />
      ) : post.data?.image_path && post.data.image_url ? (
        <Image
          source={{ uri: post.data.image_url, cacheKey: post.data.image_path }}
          cachePolicy="disk"
          style={{ position: "absolute", width: "100%", height: "100%" }}
          // Naast het gesprek is de foto het onderwerp en niet de vulling
          // van een vlak: hij moet hélemaal te zien zijn. Onder een gesprek
          // is hij de kop van de pagina en mag hij bijsnijden.
          contentFit={fill ? "contain" : "cover"}
          transition={150}
          onLoad={(e) => {
            const { width, height } = (e as any).source ?? {};
            if (width && height) setImageRatio(width / height);
          }}
        />
      ) : null}

      {/* Op smal ligt de naam op de foto; op breed staat hij rechts. */}
      {!fill && post.data ? (
        <>
          {post.data.image_url ? <Scrim height={260} /> : null}
          <View style={{ padding: space.xl }}>
            {authorRow(false)}
            {post.data.caption ? (
              <Text
                style={[
                  post.data.image_path ? feedType.pullSmall : feedType.pull,
                  { color: "#FFFFFF", marginTop: 16 },
                ]}
              >
                {post.data.caption}
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </View>
  );

  /** De bron-strook onder een link-vondst. */
  const linkBlock = post.data?.link_url ? (
    <Pressable
      onPress={() =>
        post.data?.link_url && require("expo-linking").openURL(post.data.link_url).catch(() => {})
      }
      style={{
        borderTopWidth: FEED_BORDER,
        borderBottomWidth: FEED_BORDER,
        borderColor: feed.ink,
        backgroundColor: feed.panel,
        paddingHorizontal: 20,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>BRON</Text>
        <Text style={[feedType.tile, { color: feed.ink, marginTop: 4 }]} numberOfLines={1}>
          {(() => {
            try {
              return new URL(post.data!.link_url!).hostname.replace(/^www\./, "");
            } catch {
              return post.data!.link_url;
            }
          })()}
        </Text>
      </View>
      <Text style={[feedType.label, { color: feed.ink }]}>Openen ↗</Text>
    </Pressable>
  ) : null;

  /** Reacties — de lijst zelf, zonder omhulsel. */
  const commentsBlock = (
    <>
      <Text
        style={[
          feedType.kicker,
          {
            color: feed.inkDim,
            letterSpacing: 0.6,
            paddingTop: space.lg,
            paddingBottom: space.md,
            borderTopWidth: FEED_BORDER,
            borderTopColor: feed.ink,
          },
        ]}
      >
        {`REACTIES${comments && comments.length > 0 ? ` (${comments.length})` : ""}`}
      </Text>

      {/* Geen paneel eromheen. Een reactie is geen kaartje: wie het zei
          staat vooraan, wat er staat springt in tot onder die naam, en een
          lijn op diezelfde inspringing scheidt de een van de ander. Vlak,
          uitlijning en ruimte doen het werk dat een achtergrondkleur deed. */}
      {comments === null ? (
        <View style={{ gap: space.md, paddingVertical: space.md }}>
          <Skeleton className="bg-paper-warm h-4" style={{ width: "70%" }} />
          <Skeleton className="bg-paper-warm h-4" style={{ width: "55%" }} />
        </View>
      ) : comments.length === 0 ? (
        <Text style={[feedType.body, { color: feed.inkDim, paddingVertical: space.md }]}>
          Nog geen reacties. Stuur de eerste hieronder.
        </Text>
      ) : (
        <View>
          {comments.map((c, i) => (
            <CommentRow
              key={c.id}
              comment={c}
              isLast={i === comments.length - 1}
              canDelete={canModerate || c.user_id === myUserId}
              onDelete={() => onDeleteComment(c.id)}
              onAvatarPress={() => c.author?.username && router.push(`/user/${c.author.username}`)}
              onReply={() => {
                const name = c.author?.username ?? c.author?.display_name ?? "reactie";
                setReplyTo({ id: c.id, name });
              }}
            />
          ))}
        </View>
      )}
    </>
  );

  /** Alles wat onder de tekstregel hangt: fout, emoji's, antwoord-op. */
  const composerBlock = (
    <>
      {commentError && (
        <View className="bg-red-100 border border-red-300  mx-5 mb-2 px-4 py-3">
          <Text className="text-red-800 text-sm font-semibold mb-1">Kon reactie niet plaatsen</Text>
          <Text className="text-red-800 text-xs leading-5">{commentError}</Text>
        </View>
      )}

      {mentionList && mentionList.length > 0 && (
        <View className="px-3 pb-1">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ gap: 6, paddingVertical: 6 }}
          >
            {mentionList.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => applyMention(c.username)}
                className="bg-paper px-3 py-2 flex-row items-center gap-2"
              >
                <Avatar name={c.display} avatarUrl={c.avatarUrl} size="xs" />
                <Text className="text-ink text-sm font-semibold">{c.display}</Text>
                <Text className="text-ink-muted text-xs">@{c.username}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {emojiList && emojiList.length > 0 && (
        <View className="px-3 pb-1">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            contentContainerStyle={{ gap: 6, paddingVertical: 6 }}
          >
            {emojiList.map(({ name, emoji }) => (
              <Pressable
                key={name}
                onPress={() => applyEmoji(name, emoji)}
                className="bg-paper  px-3 py-2 flex-row items-center gap-2"
              >
                <Text style={{ fontSize: 20 }}>{emoji}</Text>
                <Text className="text-ink-muted text-xs">:{name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {replyTo && (
        <View className="flex-row items-center px-4 py-2 gap-3 border-t border-line-paper/60">
          <View className="w-0.5 self-stretch bg-brand" />
          <Text className="flex-1 text-ink-muted text-xs">
            Antwoorden aan <Text className="text-brand font-semibold">@{replyTo.name}</Text>
          </Text>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
            <Ionicons name="close" color={feed.inkDim} size={18} />
          </Pressable>
        </View>
      )}

      {showEmojiPicker && (
        <View className="bg-paper-soft border-t border-line-paper" style={{ height: 200 }}>
          <ScrollView
            contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", padding: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {POST_EMOJIS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => {
                  setDraft((d) => d + emoji);
                  inputRef.current?.focus();
                }}
                style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={{ fontSize: 22 }}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/*
          De tekstregel.

          Hier stonden drie oppervlakken naast elkaar op een vierde: een
          lila vierkant met een emoji, een bijna-wit veld, en een zwarte
          knop die in uitgeschakelde stand een zwart vlak op plum werd met
          een pijl die je niet zag. Vier vlakken die niets met elkaar te
          maken hadden.

          Nu: één vlak (plum), en daarop drie kaders van dezelfde hoogte in
          dezelfde lijn. Vlak en lijn dragen de hiërarchie — de knop die iets
          dóet is de enige die gevuld is, en alleen wanneer hij ook echt iets
          kan doen.
      */}
      <View
        style={{
          backgroundColor: feed.post,
          borderTopWidth: FEED_BORDER,
          borderTopColor: feed.ink,
          padding: space.md,
        }}
      >
        {/* Wat je zo meestuurt: een gif of een meme, met een kruisje om
            hem weer weg te halen. */}
        {pendingImage ? (
          <View style={{ marginBottom: space.md, alignSelf: "flex-start" }}>
            <Image
              source={{ uri: pendingImage }}
              style={{ width: 120, height: 120, borderWidth: FEED_BORDER, borderColor: feed.postRule }}
              contentFit="cover"
            />
            <Pressable
              onPress={() => setPendingImage(null)}
              hitSlop={8}
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                width: 28,
                height: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: feed.panel,
              }}
            >
              <Ionicons name="close" size={16} color={feed.text} />
            </Pressable>
          </View>
        ) : null}

        {/*
            Eén regel, vier dingen, en maar één ervan is een vlak.

            Hier stonden vier omkaderde vakjes naast elkaar: twee icoontjes,
            een veld en een pijl, allemaal even luid. Een kader betekent
            "hier hoort iets in"; bij een icoon is dat niet zo. Dus dragen
            de icoontjes zichzelf, houdt het veld een zachte vulling omdat
            je er wél in typt, en is de knop die de reactie wegstuurt het
            enige gevulde vlak — in het oranje van de primaire actie, en
            alleen zolang er iets te versturen valt.
        */}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space.xs }}>
          <Pressable
            onPress={onPickCommentImage}
            style={{
              width: CONTROL_H,
              height: CONTROL_H,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="images-outline"
              size={20}
              color={pendingImage ? announce : feed.textDim}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              setShowEmojiPicker((v) => !v);
              if (!showEmojiPicker) {
                inputRef.current?.blur();
              } else {
                inputRef.current?.focus();
              }
            }}
            style={{
              width: CONTROL_H,
              height: CONTROL_H,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name="happy-outline"
              size={20}
              color={showEmojiPicker ? announce : feed.textDim}
            />
          </Pressable>

          <View
            style={{
              flex: 1,
              minHeight: CONTROL_H,
              maxHeight: 128,
              justifyContent: "center",
              paddingHorizontal: space.md,
              backgroundColor: "rgba(243,237,228,0.08)",
            }}
          >
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={onDraftChange}
              onKeyPress={onKeyPress}
              onFocus={() => setShowEmojiPicker(false)}
              placeholder="Schrijf een reactie…"
              placeholderTextColor={feed.textDim}
              multiline
              maxLength={500}
              style={[
                feedType.body,
                {
                  color: feed.text,
                  minHeight: 22,
                  ...(Platform.OS === "web" ? ({ outlineWidth: 0 } as any) : {}),
                },
              ]}
            />
          </View>

          {(() => {
            const canSend = !sending && (!!draft.trim() || !!pendingImage);
            return (
              <Pressable
                onPress={onSend}
                disabled={!canSend}
                style={{
                  width: CONTROL_H,
                  height: CONTROL_H,
                  borderRadius: CONTROL_H / 2,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: canSend ? announce : "transparent",
                }}
              >
                <Ionicons
                  name="arrow-up"
                  color={canSend ? feed.text : feed.textDim}
                  size={20}
                />
              </Pressable>
            );
          })()}
        </View>
      </View>
    </>
  );

  const shell = (children: React.ReactNode) => (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top", "left", "right"]}>
      {deleteError && (
        <View className="bg-red-100 border border-red-300  mx-5 mt-2 px-4 py-3">
          <Text className="text-red-800 text-sm">{deleteError}</Text>
        </View>
      )}

      <ActionSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Foto opties"
        actions={[
          { label: "Foto verwijderen", icon: "trash-outline", destructive: true, onPress: onDeletePost },
        ]}
      />

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );

  // ---------------------------------------------------------------
  // BREED — de foto links, het gesprek ernaast
  // ---------------------------------------------------------------
  //
  // Onder de foto is een gesprek een voetnoot: je moet erheen scrollen en
  // de foto is dan weg. Ernáást staat het naast het onderwerp waar het
  // over gaat, en blijft de foto in beeld terwijl je meeleest en typt.
  // De pagina zelf scrolt hier niet; alleen de kolom met reacties.
  if (wide) {
    return shell(
      <View style={{ flex: 1 }}>
        <AppChrome
          wide
          progress={chrome.progress}
          compact
          backLabel="Terug naar de feed"
          onBack={() => safeBack(router, "/(app)/feed")}
          actionLabel={canModerate ? "Opties" : undefined}
          onAction={canModerate ? () => setMenuOpen(true) : undefined}
        />

        {/* De foto loopt tot de rand van het venster: links geen marge, geen
            vlak eronder. Een lijst met marges eromheen maakt van een foto
            een kaartje, en dit is geen kaartje — dit ís de pagina. De
            gesprekskolom rechts houdt zijn eigen marge, want tekst tegen een
            vensterrand leest niet. */}
        <View
          style={{
            flex: 1,
            flexDirection: "row",
            gap: hasPlate ? space.xxl : 0,
            paddingRight: gutter(true),
            paddingBottom: gutter(true),
            ...(hasPlate ? null : { paddingLeft: gutter(true) }),
          }}
        >
          {hasPlate ? (
            <View style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <Skeleton style={{ width: "100%", height: "100%", borderRadius: 0 }} />
              ) : (
                heroBlock(true)
              )}
            </View>
          ) : null}

          <View
            style={{
              ...(hasPlate
                ? { width: conversationWidth }
                : { flex: 1, maxWidth: 760, alignSelf: "center" }),
              backgroundColor: feed.lav,
              // Schuift van rechts naar binnen terwijl de foto uitgroeit —
              // zie de keyframes in app/+html.tsx.
              ...asideStyle,
            }}
          >
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            >
              {/*
                  Geen paneel om de kop van het gesprek.

                  Wat het vlak deed, doet de opbouw nu zelf: de naam
                  bovenaan, het onderschrift eronder ingesprongen tot naast
                  de avatar — dezelfde inspringing als een reactie verderop,
                  zodat de kolom één maatlijn heeft — en een lijn onder elk
                  deel in plaats van een kleur eromheen.
              */}
              {post.data ? (
                <View style={{ paddingVertical: space.lg }}>
                  {authorRow(true)}
                  {post.data.caption ? (
                    <MentionsText
                      text={post.data.caption}
                      style={[
                        feedType.pullSmall,
                        {
                          color: feed.ink,
                          marginTop: space.md,
                          // Tot naast de avatar: 36 breed plus de marge
                          // ernaast, gelijk aan een reactie.
                          marginLeft: 36 + space.md,
                        },
                      ]}
                    />
                  ) : null}
                </View>
              ) : null}
              {linkBlock}
              <View
                style={{
                  gap: space.sm,
                  paddingVertical: space.lg,
                  borderTopWidth: FEED_BORDER,
                  borderTopColor: feed.ink,
                }}
              >
                <PostSignalBar postId={String(id)} ownerId={post.data?.user_id} />
                {/* Pillen en gezichten op één regel: het is één ding —
                    wat er met deze vondst gedaan is. */}
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    alignItems: "center",
                    gap: space.sm,
                  }}
                >
                  <PostReactions postId={String(id)} tone="feed" padded={false} />
                  <InteractionPeople postId={String(id)} />
                </View>
              </View>
              {commentsBlock}
            </ScrollView>
            {composerBlock}
          </View>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------
  // SMAL — de foto bovenaan, het gesprek eronder
  // ---------------------------------------------------------------
  return shell(
    <>
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        backLabel="Terug naar de feed"
        onBack={() => safeBack(router, "/(app)/feed")}
        actionLabel={canModerate ? "Opties" : undefined}
        onAction={canModerate ? () => setMenuOpen(true) : undefined}
        contentStyle={{ padding: gutter(wide), paddingBottom: space.section }}
        gutter={false}
        // De plaat begint aan de bovenrand van het venster, met de balk
        // erover — niet pas onder een strook paginavlak.
        underChrome
      >
        <View>
          {loading ? (
            <View className="bg-paper-soft  overflow-hidden">
              <View className="flex-row items-center px-4 py-3">
                <Skeleton className="w-11 h-11 bg-paper-warm" />
                <View className="flex-1 ml-3">
                  <Skeleton className="w-32 h-3.5 bg-paper-warm" />
                  <View className="h-1.5" />
                  <Skeleton className="w-20 h-3 bg-paper-warm" />
                </View>
              </View>
              <Skeleton style={{ width: "100%", aspectRatio: 1, borderRadius: 0 }} />
            </View>
          ) : (
            // De plaat loopt tot de rand: precies de marge van de pagina
            // terug, zodat hij op de kop erboven uitlijnt.
            <View style={{ marginHorizontal: -gutter(wide), marginTop: -gutter(wide) }}>
              {heroBlock(false)}
              {linkBlock}
            </View>
          )}

          <View style={{ marginTop: space.lg, gap: space.sm }}>
            <PostSignalBar postId={String(id)} ownerId={post.data?.user_id} />
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                alignItems: "center",
                gap: space.sm,
              }}
            >
              <PostReactions postId={String(id)} tone="feed" padded={false} />
              <InteractionPeople postId={String(id)} />
            </View>
          </View>

          {commentsBlock}
        </View>
      </PageScroll>

      {composerBlock}
    </>
  );
}



function CommentRow({
  comment,
  isLast,
  canDelete,
  onDelete,
  onAvatarPress,
  onReply,
}: {
  comment: EntityComment;
  isLast: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onAvatarPress: () => void;
  onReply: () => void;
}) {
  const time = formatCommentTime(comment.created_at);
  const name = comment.author?.display_name ?? comment.author?.username ?? "Onbekend";

  /**
   * Bestaat de reactie uit niets dan een link naar een plaatje, dan is dat
   * plaatje de reactie — en niet een blauwe regel waar je op moet klikken
   * om te zien wat iemand bedoelde. Precies wat er gebeurt als je een gif
   * van het web plakt.
   */
  const linkedImage = /^https?:\/\/\S+\.(gif|png|jpe?g|webp)(\?\S*)?$/i.test(
    comment.body.trim()
  )
    ? comment.body.trim()
    : null;
  return (
    <View
      style={{
        flexDirection: "row",
        paddingVertical: space.md,
        ...(isLast
          ? null
          : { borderBottomWidth: 1, borderBottomColor: "rgba(11,10,12,0.12)" }),
      }}
    >
      <Pressable onPress={onAvatarPress} hitSlop={6}>
        <Avatar name={name} avatarUrl={comment.author?.avatar_url} size="sm" />
      </Pressable>

      {/* De tekst springt in tot naast de avatar en blijft daar: naam en
          reactie staan op dezelfde lijn onder elkaar, en die lijn is wat
          een reactie van de volgende scheidt. */}
      <View style={{ flex: 1, minWidth: 0, marginLeft: space.md }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: space.sm }}>
          <Text
            style={[feedType.label, { fontSize: 14, fontWeight: "700", color: feed.ink }]}
            numberOfLines={1}
          >
            {name}
          </Text>
          <Text style={[feedType.label, { color: feed.inkDim }]}>{time}</Text>
        </View>
        {comment.body && !linkedImage ? (
          <MentionsText
            text={comment.body}
            style={[feedType.body, { fontSize: 14, lineHeight: 20, color: feed.ink, marginTop: 2 }]}
          />
        ) : null}
        {linkedImage ? (
          <SafeImage
            uri={linkedImage}
            style={{ width: "100%", maxWidth: 260, aspectRatio: 1, marginTop: space.sm }}
            contentFit="contain"
            fallbackBg="bg-paper-warm"
          />
        ) : null}
        {comment.image_url ? (
          <SafeImage
            uri={comment.image_url}
            cacheKey={comment.image_path ?? undefined}
            style={{
              width: "100%",
              maxWidth: 260,
              aspectRatio: 1,
              marginTop: space.sm,
            }}
            contentFit="cover"
            fallbackBg="bg-paper-warm"
          />
        ) : null}
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", marginLeft: space.sm }}>
        <Pressable onPress={onReply} hitSlop={8} style={{ padding: space.xs }}>
          <Ionicons name="return-down-back-outline" color={feed.inkDim} size={16} />
        </Pressable>
        {canDelete && (
          <Pressable onPress={onDelete} hitSlop={8} style={{ padding: space.xs }}>
            <Ionicons name="trash-outline" color={feed.inkDim} size={16} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function humanizeCommentError(err: any): string {
  const code = err?.code ?? "";
  const msg = err?.message ?? String(err ?? "Onbekende fout");
  if (code === "42P01" || /relation .* does not exist/i.test(msg))
    return "De `entity_comments` tabel bestaat nog niet. Run migratie 0038_entity_comments.sql.";
  if (code === "42501" || /row-level security/i.test(msg))
    return "Server-beveiliging weigerde de reactie. Check migratie 0038.";
  if (code === "PGRST116" || code === "PGRST204")
    return "De reactie werd ingevoerd maar de server gaf hem niet terug — waarschijnlijk een RLS-issue.";
  if (/network|fetch/i.test(msg))
    return "Geen netwerkverbinding. Probeer opnieuw.";
  return msg;
}

const POST_EMOJIS = [
  "😀","😂","😍","🥰","😊","😎","🤔","😢","😱","😡",
  "🥺","😏","🤩","😇","🤗","😴","🥳","🤯","🫡","🤭",
  "👍","👎","❤️","💔","🔥","✨","🎉","🙏","💯","👋",
  "✌️","🤞","🤙","👌","💪","🫶","👏","🙌","🤜","🤛",
  "🌟","⭐","💫","🌈","☀️","🌙","❄️","🌊","🍀","🌸",
  "🍕","🍦","🎂","☕","🍺","🥂","🍷","🎵","🎶","🎮",
  "🐶","🐱","🐻","🦁","🐸","🦄","🦋","🐝","💀","👻",
  "👽","🤖","💩","🎭","🎲","🏆","💎","🔑","💡","🔥",
];

function formatCommentTime(iso: string): string {
  const date = new Date(iso);
  const diffMin = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMin < 1) return "net";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}u`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}
