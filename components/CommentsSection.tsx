import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Avatar } from "./Avatar";
import { useAuth } from "@/lib/auth/provider";
import {
  addEntityComment,
  deleteEntityComment,
  listEntityComments,
  subscribeToEntityComments,
  type EntityComment,
  type EntityType,
} from "@/lib/api/entity-comments";
import { supabase } from "@/lib/supabase/client";

export function CommentsSection({
  entityType,
  entityId,
  ownerId,
  initialCount = 0,
}: {
  entityType: EntityType;
  entityId: string;
  /** user_id van de eigenaar, voor notificaties */
  ownerId?: string;
  initialCount?: number;
}) {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const inputRef = useRef<TextInput>(null);

  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<EntityComment[]>([]);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

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
    <View className="border-t border-paper mt-1">
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
          color="#8A7E6C"
          size={14}
        />
        <Text className="text-ink-muted text-sm">
          {count === 0 ? "Reageer" : count === 1 ? "1 reactie" : `${count} reacties`}
        </Text>
      </Pressable>

      {open && (
        <View className="px-3 pb-3">
          {/* Bestaande reacties */}
          {loading ? (
            <ActivityIndicator size="small" color="#8A7E6C" style={{ marginVertical: 8 }} />
          ) : (
            <View className="gap-2 mb-2">
              {comments.map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  isMine={c.user_id === myUserId}
                  onDelete={() => {
                    deleteEntityComment(c.id);
                    setComments((prev) => prev.filter((x) => x.id !== c.id));
                    setCount((n) => Math.max(0, n - 1));
                  }}
                />
              ))}
              {comments.length === 0 && (
                <Text className="text-ink-muted text-xs py-1">
                  Nog geen reacties. Wees de eerste!
                </Text>
              )}
            </View>
          )}

          {/* Invoerveld */}
          <View className="flex-row items-center gap-2">
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Schrijf een reactie…"
              placeholderTextColor="#8A7E6C"
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={Platform.OS !== "web" ? onSend : undefined}
              className="flex-1 bg-paper rounded-2xl px-3 py-2 text-ink text-sm"
              style={Platform.OS === "web" ? { outlineWidth: 0 } as any : {}}
            />
            <Pressable
              onPress={onSend}
              disabled={!draft.trim() || sending}
              className={`w-9 h-9 rounded-full items-center justify-center ${
                draft.trim() ? "bg-flame" : "bg-paper"
              }`}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#F5E8D3" />
              ) : (
                <Ionicons
                  name="arrow-up"
                  color={draft.trim() ? "#F5E8D3" : "#8A7E6C"}
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
}: {
  comment: EntityComment;
  isMine: boolean;
  onDelete: () => void;
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
      <View className="flex-1 bg-paper rounded-2xl rounded-tl-sm px-3 py-2">
        <View className="flex-row items-center justify-between mb-0.5">
          <Text className="text-ink text-xs font-semibold">{name}</Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-ink-muted text-[10px]">{time}</Text>
            {isMine && (
              <Pressable onPress={onDelete} hitSlop={8}>
                <Ionicons name="trash-outline" color="#B23A1C" size={12} />
              </Pressable>
            )}
          </View>
        </View>
        <Text className="text-ink text-sm leading-5">{comment.body}</Text>
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
