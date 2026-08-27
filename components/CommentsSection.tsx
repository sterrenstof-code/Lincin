import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import type { Tone } from "@/components/Editorial";
import { carbon, feed, page } from "@/lib/design/type";
import { useAuth } from "@/lib/auth/provider";
import {
  addEntityComment,
  deleteEntityComment,
  listEntityComments,
  subscribeToEntityComments,
  type EntityComment,
  type EntityType,
} from "@/lib/api/entity-comments";
import { listMyFriendships } from "@/lib/api/friends";
import { useMentions, type MentionCandidate } from "@/lib/useMentions";
import { supabase } from "@/lib/supabase/client";

/**
 * Kleuren per toon. De standaard blijft `page` (inkt op gebroken wit),
 * zodat `app/post/[id].tsx` en de andere aanroepers niet verschuiven; de
 * feed geeft `feed` (op lavendel) of `post` (op het plum-vlak) mee.
 */
type Palette = {
  text: string;
  dim: string;
  /** Vlak van een reactiebubbel en het invoerveld. */
  fill: string;
  /** De scheidingslijn bovenaan de sectie. */
  rule: string;
  /** Tekstkleur óp de gevulde verzendknop. */
  onSend: string;
};

function paletteFor(tone: Tone): Palette {
  switch (tone) {
    case "feed":
      return {
        text: feed.ink,
        dim: feed.inkDim,
        fill: "rgba(11,10,12,0.07)",
        rule: "rgba(11,10,12,0.22)",
        onSend: feed.text,
      };
    case "post":
      return {
        text: feed.text,
        dim: feed.textDim,
        fill: "rgba(243,237,228,0.09)",
        rule: feed.postRule,
        onSend: feed.post,
      };
    case "dark":
      return {
        text: page.DEFAULT,
        dim: feed.inkDim,
        fill: "rgba(242,241,238,0.10)",
        rule: "#3A3936",
        onSend: carbon.DEFAULT,
      };
    default:
      return {
        text: carbon.DEFAULT,
        dim: carbon.muted,
        fill: feed.panel,
        rule: feed.panel,
        onSend: page.DEFAULT,
      };
  }
}

export function CommentsSection({
  entityType,
  entityId,
  ownerId,
  initialCount = 0,
  tone = "page",
}: {
  entityType: EntityType;
  entityId: string;
  /** user_id van de eigenaar, voor notificaties */
  ownerId?: string;
  initialCount?: number;
  tone?: Tone;
}) {
  const c = paletteFor(tone);
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const inputRef = useRef<TextInput>(null);

  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<EntityComment[]>([]);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [friendCandidates, setFriendCandidates] = useState<MentionCandidate[]>([]);

  const { mentionList, onChangeText, applyMention } = useMentions({
    draft,
    setDraft,
    candidates: friendCandidates,
  });

  useEffect(() => {
    listMyFriendships(myUserId).then((fs) => {
      setFriendCandidates(
        fs
          .filter((f) => f.status === "accepted")
          .map((f) => ({
            id: f.other.id,
            display: f.other.display_name ?? f.other.username,
            username: f.other.username,
            avatarUrl: f.other.avatar_url ?? null,
          }))
      );
    });
  }, [myUserId]);

  // Laad comments als sectie opent
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listEntityComments(entityType, entityId).then((rows) => {
      if (!cancelled) {
        setComments(rows);
        setCount(rows.length);
        setLoading(false);
      }
    });
    const channel = subscribeToEntityComments(entityType, entityId, (c) => {
      if (cancelled) return;
      setComments((prev) =>
        prev.some((x) => x.id === c.id) ? prev : [...prev, c]
      );
      setCount((n) => n + 1);
    });
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [open, entityType, entityId]);

  async function onSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setDraft("");
    Keyboard.dismiss();
    try {
      const comment = await addEntityComment({
        entityType,
        entityId,
        userId: myUserId,
        body: text,
        ownerId,
      });
      setComments((prev) =>
        prev.some((x) => x.id === comment.id) ? prev : [...prev, comment]
      );
      setCount((n) => n + 1);
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: c.rule }} className="mt-1">
      {/* Toggle knop */}
      <Pressable
        onPress={() => {
          setOpen((o) => !o);
          if (!open) setTimeout(() => inputRef.current?.focus(), 300);
        }}
        className="flex-row items-center gap-1.5 px-3 py-2.5"
      >
        <Ionicons
          name={open ? "chatbubble" : "chatbubble-outline"}
          color={c.dim}
          size={14}
        />
        <Text style={{ fontSize: 14, color: c.dim }}>
          {count === 0 ? "Reageer" : count === 1 ? "1 reactie" : `${count} reacties`}
        </Text>
      </Pressable>

      {open && (
        <View className="px-3 pb-3">
          {/* Bestaande reacties */}
          {loading ? (
            <ActivityIndicator size="small" color={c.dim} style={{ marginVertical: 8 }} />
          ) : (
            <View className="gap-2 mb-2">
              {comments.map((row) => (
                <CommentRow
                  key={row.id}
                  comment={row}
                  palette={c}
                  isMine={row.user_id === myUserId}
                  onDelete={() => {
                    deleteEntityComment(row.id);
                    setComments((prev) => prev.filter((x) => x.id !== row.id));
                    setCount((n) => Math.max(0, n - 1));
                  }}
                />
              ))}
              {comments.length === 0 && (
                <Text style={{ fontSize: 12, color: c.dim }} className="py-1">
                  Nog geen reacties. Wees de eerste!
                </Text>
              )}
            </View>
          )}

          {/* @mention suggesties */}
          {mentionList && mentionList.length > 0 && (
            <View style={{ backgroundColor: c.fill }} className="overflow-hidden mb-2">
              {mentionList.map((m, i) => (
                <Pressable
                  key={m.username}
                  onPress={() => applyMention(m.username)}
                  style={
                    i < mentionList.length - 1
                      ? { borderBottomWidth: 1, borderBottomColor: c.rule }
                      : undefined
                  }
                  className="flex-row items-center px-3 py-2 gap-2"
                >
                  <Avatar name={m.display} avatarUrl={m.avatarUrl} size="xs" />
                  <View className="flex-1">
                    <Text style={{ fontSize: 14, fontWeight: "600", color: c.text }}>
                      {m.display}
                    </Text>
                    <Text style={{ fontSize: 12, color: c.dim }}>@{m.username}</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {/* Invoerveld */}
          <View className="flex-row items-center gap-2">
            <View className="flex-1">
              {/* @mention + emoji suggesties worden afgehandeld in SmartTextInput,
                  maar we renderen die al hierboven — gebruik hier gewoon TextInput */}
              <TextInput
                ref={inputRef}
                value={draft}
                onChangeText={onChangeText}
                placeholder="Schrijf een reactie…"
                placeholderTextColor={c.dim}
                multiline
                maxLength={500}
                returnKeyType="send"
                onSubmitEditing={Platform.OS !== "web" ? onSend : undefined}
                className="px-1 py-2 text-sm"
                style={[
                  {
                    color: c.text,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: c.rule,
                  },
                  /**
                   * `outlineWidth: 0` alleen was niet genoeg: Chrome tekent
                   * zijn eigen ring via `:focus-visible`, en die stond als
                   * felblauw kader om het veld — het luidste ding in een
                   * gedeelte dat verder uit haarlijnen bestaat.
                   */
                  Platform.OS === "web"
                    ? ({ outlineWidth: 0, outlineStyle: "none" } as any)
                    : {},
                ]}
              />
            </View>
            <Pressable
              onPress={onSend}
              disabled={!draft.trim() || sending}
              style={{ backgroundColor: draft.trim() ? c.text : c.fill }}
              className="w-9 h-9 items-center justify-center"
            >
              {sending ? (
                <ActivityIndicator size="small" color={c.onSend} />
              ) : (
                <Ionicons
                  name="arrow-up"
                  color={draft.trim() ? c.onSend : c.dim}
                  size={16}
                />
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function CommentRow({
  comment,
  isMine,
  onDelete,
  palette,
}: {
  comment: EntityComment;
  isMine: boolean;
  onDelete: () => void;
  palette: Palette;
}) {
  const name =
    comment.author?.display_name ?? comment.author?.username ?? "Onbekend";
  const time = formatRelative(comment.created_at);

  return (
    <View className="flex-row gap-2">
      <Avatar
        name={name}
        avatarUrl={comment.author?.avatar_url ?? null}
        size="xs"
      />
      {/* Een kantlijn in plaats van een vlak — DESIGN.md §4: een kaart heeft
          geen vulling, de opbouw draagt hem. Vier grijze blokjes onder elkaar
          lazen als losse kaartjes op de pagina in plaats van als één gesprek. */}
      <View
        style={{
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderLeftColor: palette.rule,
        }}
        className="flex-1 pl-3 py-1"
      >
        <View className="flex-row items-center justify-between mb-0.5">
          <Text style={{ fontSize: 12, fontWeight: "600", color: palette.text }}>
            {name}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text style={{ fontSize: 10, color: palette.dim }}>{time}</Text>
            {isMine && (
              <Pressable onPress={onDelete} hitSlop={8}>
                <Ionicons name="trash-outline" color="#B23A1C" size={12} />
              </Pressable>
            )}
          </View>
        </View>
        <Text style={{ fontSize: 14, lineHeight: 20, color: palette.text }}>
          {comment.body}
        </Text>
      </View>
    </View>
  );
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  return `${Math.floor(hours / 24)}d`;
}
