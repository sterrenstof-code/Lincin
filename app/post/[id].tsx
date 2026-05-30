import { Ionicons } from "@expo/vector-icons";
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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import {
  createComment,
  deleteComment,
  listPostComments,
  subscribeToPostComments,
  type CommentWithAuthor,
} from "@/lib/api/comments";
import { deletePost, type PostWithAuthor } from "@/lib/api/posts";
import { getProfile } from "@/lib/api/profiles";
import { confirm } from "@/lib/confirm";
import { emojiSuggestionsFor, replaceEmoticons } from "@/lib/emoji";
import { safeBack } from "@/lib/nav";
import { supabase } from "@/lib/supabase/client";

export default function PostDetailScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useAuth();
  const myUserId = session?.user.id;

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [comments, setComments] = useState<CommentWithAuthor[] | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<{ id: string; name: string } | null>(null);
  const [emojiList, setEmojiList] = useState<{ name: string; emoji: string }[] | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
      let imageUrl: string | null = null;
      if (data.image_path) {
        const { data: signed } = await supabase.storage
          .from("posts")
          .createSignedUrl(data.image_path, 60 * 60 * 24);
        imageUrl = signed?.signedUrl ?? null;
      }
      return { ...data, author, image_url: imageUrl };
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
      const list = await listPostComments(id);
      if (!cancelled) setComments(list);
    })();
    const channel = subscribeToPostComments(id, (c) => {
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
    // Emoji autocomplete
    const match = converted.match(/:([a-z0-9_+\-]{2,})$/i);
    if (match) {
      const suggestions = emojiSuggestionsFor(match[1]);
      setEmojiList(suggestions.length > 0 ? suggestions : null);
    } else {
      setEmojiList(null);
    }
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
    if (!text) return;
    setSending(true);
    setCommentError(null);
    // Replies: prefix met @naam
    const body = replyTo ? `@${replyTo.name} ${text}` : text;
    try {
      const created = await createComment({ postId: id, userId: myUserId, body });
      setDraft("");
      setReplyTo(null);
      setEmojiList(null);
      setComments((prev) => {
        if (!prev) return prev;
        if (prev.some((c) => c.id === created.id)) return prev;
        return [...prev, { ...created, author: null } as CommentWithAuthor];
      });
      qc.invalidateQueries({ queryKey: ["post-comments", id] });
      listPostComments(id).then((fresh) => setComments(fresh));
    } catch (e: any) {
      setCommentError(humanizeCommentError(e));
    } finally {
      setSending(false);
    }
  }

  async function onDeleteComment(commentId: string) {
    setCommentError(null);
    try {
      await deleteComment(commentId);
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

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top", "left", "right"]}>
      <ScreenContainer>
      <View className="flex-row items-center px-4 py-3">
        <Pressable
          onPress={() => safeBack(router, "/(app)/feed")}
          className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
        >
          <Ionicons name="chevron-back" color="#1A1714" size={20} />
        </Pressable>
        <Text className="flex-1 text-cream text-lg font-semibold ml-3">Foto</Text>
        {canModerate && (
          <Pressable
            onPress={() => setMenuOpen(true)}
            className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
          >
            <Ionicons name="ellipsis-horizontal" color="#1A1714" size={20} />
          </Pressable>
        )}
      </View>

      {deleteError && (
        <View className="bg-red-100 border border-red-300 rounded-2xl mx-5 mt-2 px-4 py-3">
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
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Post card */}
          {post.isLoading || !post.data ? (
            <View className="bg-paper-soft rounded-3xl overflow-hidden">
              <View className="flex-row items-center px-4 py-3">
                <Skeleton className="w-11 h-11 bg-paper-warm rounded-full" />
                <View className="flex-1 ml-3">
                  <Skeleton className="w-32 h-3.5 bg-paper-warm rounded-full" />
                  <View className="h-1.5" />
                  <Skeleton className="w-20 h-3 bg-paper-warm rounded-full" />
                </View>
              </View>
              <Skeleton style={{ width: "100%", aspectRatio: 1, borderRadius: 0 }} />
            </View>
          ) : (
            <View className="bg-paper-soft rounded-3xl overflow-hidden">
              <Pressable
                onPress={() =>
                  post.data?.author?.username &&
                  router.push(`/user/${post.data.author.username}`)
                }
                className="flex-row items-center px-4 py-3"
              >
                <Avatar
                  name={post.data.author?.display_name ?? post.data.author?.username}
                  size="md"
                  tint="warm"
                />
                <View className="flex-1 ml-3">
                  <Text className="text-ink font-semibold">
                    {post.data.author?.display_name ?? post.data.author?.username ?? "Onbekend"}
                  </Text>
                  <Text className="text-ink-muted text-xs">
                    @{post.data.author?.username ?? "?"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" color="#8A7E6C" size={18} />
              </Pressable>
              {post.data.image_path && post.data.image_url && (
                <View className="bg-shell">
                  <Image
                    source={{ uri: post.data.image_url, cacheKey: post.data.image_path }}
                    cachePolicy="disk"
                    style={{ width: "100%", aspectRatio: 1 }}
                    contentFit="contain"
                    transition={150}
                  />
                </View>
              )}
              {post.data.caption && (
                <View className="px-4 py-4">
                  <Text className={`text-ink leading-6 ${post.data.image_path ? "text-base" : "text-lg"}`}>
                    {post.data.caption}
                  </Text>
                </View>
              )}
              {post.data.link_url && (
                <Pressable
                  onPress={() =>
                    post.data?.link_url &&
                    require("expo-linking").openURL(post.data.link_url).catch(() => {})
                  }
                  className="mx-3 mb-3 mt-1 bg-paper-warm active:bg-paper rounded-2xl px-4 py-3 flex-row items-center"
                >
                  <View className="w-10 h-10 rounded-full bg-paper-light items-center justify-center">
                    <Ionicons name="link" color="#1A1714" size={18} />
                  </View>
                  <View className="flex-1 ml-3">
                    <Text className="text-ink font-semibold text-sm" numberOfLines={1}>
                      {(() => { try { return new URL(post.data.link_url).hostname.replace(/^www\./, ""); } catch { return post.data.link_url; } })()}
                    </Text>
                    <Text className="text-ink-muted text-xs" numberOfLines={1}>{post.data.link_url}</Text>
                  </View>
                  <Ionicons name="open-outline" color="#5A4F40" size={16} />
                </Pressable>
              )}
            </View>
          )}

          {/* Comments */}
          <Text className="text-xs uppercase tracking-wider text-cream-muted mt-6 mb-3 px-1">
            Reacties {comments && comments.length > 0 ? `(${comments.length})` : ""}
          </Text>

          {comments === null ? (
            <View className="bg-paper-soft rounded-2xl p-4 gap-3">
              <Skeleton className="bg-paper-warm h-4 rounded-full" style={{ width: "70%" }} />
              <Skeleton className="bg-paper-warm h-4 rounded-full" style={{ width: "55%" }} />
            </View>
          ) : comments.length === 0 ? (
            <View className="bg-paper-soft rounded-2xl p-5">
              <Text className="text-ink-soft text-sm leading-5">Nog geen reacties. Stuur de eerste hieronder.</Text>
            </View>
          ) : (
            <View className="bg-paper-soft rounded-2xl overflow-hidden">
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
        </ScrollView>

        {commentError && (
          <View className="bg-red-100 border border-red-300 rounded-2xl mx-5 mb-2 px-4 py-3">
            <Text className="text-red-800 text-sm font-semibold mb-1">Kon reactie niet plaatsen</Text>
            <Text className="text-red-800 text-xs leading-5">{commentError}</Text>
          </View>
        )}

        {/* Emoji autocomplete */}
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
                  className="bg-paper rounded-2xl px-3 py-2 flex-row items-center gap-2"
                >
                  <Text style={{ fontSize: 20 }}>{emoji}</Text>
                  <Text className="text-ink-muted text-xs">:{name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Reply bar */}
        {replyTo && (
          <View className="flex-row items-center px-4 py-2 gap-3 border-t border-line-paper/60">
            <View className="w-0.5 self-stretch bg-brand rounded-full" />
            <Text className="flex-1 text-ink-muted text-xs">
              Antwoorden aan <Text className="text-brand font-semibold">@{replyTo.name}</Text>
            </Text>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <Ionicons name="close" color="#8A7E6C" size={18} />
            </Pressable>
          </View>
        )}

        {/* Emoji picker */}
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

        {/* Composer */}
        <View className="px-3 py-3 border-t border-line bg-shell-soft">
          <View className="flex-row items-end gap-2">
            <Pressable
              onPress={() => {
                setShowEmojiPicker((v) => !v);
                if (!showEmojiPicker) {
                  inputRef.current?.blur();
                } else {
                  inputRef.current?.focus();
                }
              }}
              className="w-11 h-11 rounded-full bg-paper-warm items-center justify-center"
            >
              <Text style={{ fontSize: 20 }}>😊</Text>
            </Pressable>
            <View className="flex-1 bg-paper-light rounded-3xl border border-line-paper px-4 py-2 max-h-32">
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={onDraftChange}
                onKeyPress={onKeyPress}
                onFocus={() => setShowEmojiPicker(false)}
                placeholder="Schrijf een reactie…"
                placeholderTextColor="#8A7E6C"
                multiline
                maxLength={500}
                className="text-ink text-base"
                style={{ minHeight: 24, ...(Platform.OS === "web" ? { outlineWidth: 0 } as any : {}) }}
              />
            </View>
            <Pressable
              onPress={onSend}
              disabled={sending || !draft.trim()}
              className={`w-11 h-11 rounded-full items-center justify-center ${
                sending || !draft.trim() ? "bg-shell" : "bg-ink active:bg-ink-soft"
              }`}
            >
              <Ionicons
                name="arrow-up"
                color={sending || !draft.trim() ? "#5A4F40" : "#F5E8D3"}
                size={20}
              />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
      </ScreenContainer>
    </SafeAreaView>
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
  comment: CommentWithAuthor;
  isLast: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onAvatarPress: () => void;
  onReply: () => void;
}) {
  const time = formatCommentTime(comment.created_at);
  const name = comment.author?.display_name ?? comment.author?.username ?? "Onbekend";
  return (
    <View className={`flex-row px-4 py-3 ${isLast ? "" : "border-b border-line-paper/60"}`}>
      <Pressable onPress={onAvatarPress} hitSlop={6}>
        <Avatar name={name} size="sm" />
      </Pressable>
      <View className="flex-1 ml-3">
        <View className="flex-row items-baseline">
          <Text className="text-ink font-semibold text-sm">{name}</Text>
          <Text className="text-ink-muted text-xs ml-2">{time}</Text>
        </View>
        <Text className="text-ink text-sm leading-5 mt-0.5">{comment.body}</Text>
      </View>
      <View className="flex-row items-center gap-1 ml-2">
        <Pressable onPress={onReply} hitSlop={8} className="p-1">
          <Ionicons name="return-down-back-outline" color="#8A7E6C" size={16} />
        </Pressable>
        {canDelete && (
          <Pressable onPress={onDelete} hitSlop={8} className="p-1">
            <Ionicons name="trash-outline" color="#8A7E6C" size={16} />
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
    return "De `comments` tabel bestaat nog niet. Run migratie 0007_comments.sql.";
  if (code === "42501" || /row-level security/i.test(msg))
    return "Server-beveiliging weigerde de reactie. Check migratie 0007.";
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
