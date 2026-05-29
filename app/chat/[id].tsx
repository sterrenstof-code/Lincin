import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Clipboard,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { VideoCallModal } from "@/components/VideoCallModal";
import { MentionsText } from "@/components/MentionsText";
import { ScreenContainer } from "@/components/ScreenContainer";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import { safeBack } from "@/lib/nav";
import {
  chatTitle,
  fetchMemberLastRead,
  listMyChats,
  markChatRead,
  otherMember,
  subscribeToChatMemberUpdates,
  type ChatWithMembers,
} from "@/lib/api/chats";
import {
  buildAttachmentInfo,
  deleteMessage,
  downloadEncryptedAttachment,
  editMessage,
  fetchEarlierMessages,
  fetchMessages,
  fetchMessagesByIds,
  sendMessage,
  subscribeToAllMyMessages,
  subscribeToChatMessages,
  uploadEncryptedAttachment,
  type AttachmentInfo,
  type DecryptedMessage,
  type ReplyInfo,
} from "@/lib/api/messages";
import { getProfile } from "@/lib/api/profiles";
import {
  addReaction,
  groupReactions,
  listReactionsForMessages,
  QUICK_REACTIONS,
  removeReaction,
  subscribeToReactions,
  type GroupedReaction,
  type ReactionRow,
} from "@/lib/api/reactions";
import { subscribeToTyping, TYPING_EXPIRY_MS } from "@/lib/api/typing";
import { supabase } from "@/lib/supabase/client";
import { base64ToBytes } from "@/lib/crypto/base64";
import {
  attachmentTypeFor,
  bytesToDisplayUri,
  decryptFileBytes,
  encryptFileBytes,
  uriToBytes,
} from "@/lib/crypto/file";
import { openJitsiCall, buildJitsiEmbedUrl } from "@/lib/jitsi";

export default function ChatDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session?.user.id;

  const [chat, setChat] = useState<ChatWithMembers | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[] | null>(null);
  const [failedMessages, setFailedMessages] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState<Map<string, { name: string; expiresAt: number }>>(
    new Map()
  );
  const [reactions, setReactions] = useState<ReactionRow[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [reactionPicker, setReactionPicker] = useState<{ msg: DecryptedMessage; onReply?: () => void; canEdit?: boolean; copyText?: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyInfo | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Read receipts: last_read_at per user_id van andere chat-leden.
  const [otherMembersLastRead, setOtherMembersLastRead] = useState<Map<string, string>>(new Map());
  const [mentionList, setMentionList] = useState<
    { display: string; username: string }[] | null
  >(null);
  const [emojiList, setEmojiList] = useState<{ name: string; emoji: string }[] | null>(null);
  const [reactionDetail, setReactionDetail] = useState<{ emoji: string; names: string[] } | null>(null);
  const listRef = useRef<FlatList<DecryptedMessage>>(null);
  const typingSendRef = useRef<((name: string) => void) | null>(null);
  // Zorg dat per sessie maar één call-notificatie verstuurd wordt.
  const callSentRef = useRef(false);
  const [showScrollDown, setShowScrollDown] = useState(false);

  const myProfile = useQuery({
    queryKey: ["profile", myUserId],
    queryFn: () => getProfile(myUserId!),
    enabled: !!myUserId,
  });
  const myName =
    myProfile.data?.display_name ?? myProfile.data?.username ?? "Iemand";

  // Zelfde query als in (app)/_layout — react-query dedupliceert automatisch
  // dus dit kost geen extra fetch. We gebruiken hem om te tonen op de back-
  // button hoeveel ongelezen berichten er in ANDERE chats wachten.
  const allChatsQuery = useQuery({
    queryKey: ["chats", myUserId],
    queryFn: () => listMyChats(myUserId!),
    enabled: !!myUserId,
  });
  const otherUnread = (allChatsQuery.data ?? [])
    .filter((c) => c.id !== id)
    .reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  // Initial load + realtime
  useEffect(() => {
    if (!myUserId || !id) return;
    let cancelled = false;

    (async () => {
      const [allChats, msgs] = await Promise.all([
        listMyChats(myUserId),
        fetchMessages(id, myUserId),
      ]);
      if (cancelled) return;
      const c = allChats.find((x) => x.id === id) ?? null;
      setChat(c);
      setMessages(msgs);
      const rxs = await listReactionsForMessages(msgs.map((m) => m.id));
      if (!cancelled) setReactions(rxs);
      // Belangrijk: await zodat de bottom-bar badge meteen 0 toont na opening.
      try {
        await markChatRead(id);
      } catch {}
      qc.invalidateQueries({ queryKey: ["chats", myUserId] });
    })();

    const channel = subscribeToChatMessages(id, myUserId, (msg) => {
      setMessages((prev) => {
        if (!prev) return [msg];
        // Al aanwezig met dezelfde echte id? Niets doen.
        if (prev.some((m) => m.id === msg.id)) return prev;
        // Vervang een matching optimistic-versie van mezelf door de echte rij.
        const optimisticIdx = prev.findIndex(
          (m) =>
            m.id.startsWith("optimistic-") &&
            m.sender_id === msg.sender_id &&
            (m.content?.text ?? null) === (msg.content?.text ?? null)
        );
        if (optimisticIdx >= 0) {
          const next = prev.slice();
          next[optimisticIdx] = msg;
          return next;
        }
        return [...prev, msg];
      });
      // Markeer gelezen + markeer de chats-query als stale.
      // refetchType:"none" voorkomt een onmiddellijke refetch die het keyboard
      // wegduwt via een re-render hoger in de boom.
      (async () => {
        try {
          await markChatRead(id);
        } catch {}
        qc.invalidateQueries({ queryKey: ["chats", myUserId], refetchType: "none" });
      })();
    });

    const rChannel = subscribeToReactions(id, async () => {
      const msgIds = (messages ?? []).map((m) => m.id);
      if (msgIds.length === 0) return;
      const rxs = await listReactionsForMessages(msgIds);
      setReactions(rxs);
    });

    // Read receipts: initieel laden + realtime updates
    fetchMemberLastRead(id)
      .then((map) => { if (!cancelled) setOtherMembersLastRead(map); })
      .catch(() => {});
    const readChannel = subscribeToChatMemberUpdates(id, (userId, lastReadAt) => {
      setOtherMembersLastRead((prev) => {
        const next = new Map(prev);
        next.set(userId, lastReadAt);
        return next;
      });
    });

    // Globale listener voor messages in ANDERE chats — zodat de
    // back-button-badge live updatet als er ergens een nieuw bericht
    // binnenkomt terwijl ik hier zit. De (app)-layout draait soms niet
    // mee als deze stack-screen actief is, dus we abonneren hier ook.
    const globalChannel = subscribeToAllMyMessages(myUserId, (row) => {
      if (row.chat_id === id) return; // eigen chat: al gecoverd
      qc.invalidateQueries({ queryKey: ["chats", myUserId] });
    });

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      supabase.removeChannel(rChannel);
      supabase.removeChannel(readChannel);
      supabase.removeChannel(globalChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, myUserId]);

  // Focus input zodra replyTo gezet wordt
  useEffect(() => {
    if (!replyTo) return;
    const t1 = setTimeout(() => inputRef.current?.focus(), 50);
    const t2 = setTimeout(() => inputRef.current?.focus(), 200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [replyTo]);

  // Typing channel
  useEffect(() => {
    if (!myUserId || !id) return;
    const handle = subscribeToTyping(id, myUserId, (evt) => {
      setTyping((prev) => {
        const next = new Map(prev);
        next.set(evt.user_id, {
          name: evt.name,
          expiresAt: Date.now() + TYPING_EXPIRY_MS,
        });
        return next;
      });
    });
    typingSendRef.current = handle.sendTyping;
    const interval = setInterval(() => {
      setTyping((prev) => {
        if (prev.size === 0) return prev;
        const now = Date.now();
        let changed = false;
        const next = new Map(prev);
        for (const [k, v] of next) {
          if (v.expiresAt < now) {
            next.delete(k);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);
    return () => {
      handle.unsubscribe();
      typingSendRef.current = null;
      clearInterval(interval);
    };
  }, [id, myUserId]);

  const title = useMemo(
    () => (chat && myUserId ? chatTitle(chat, myUserId) : "Chat"),
    [chat, myUserId]
  );

  // Bepaal het meest recente bericht van MIJ dat door alle andere leden gelezen is.
  // Toont ✓✓ Gelezen onder die bubble — alleen als er echt andere leden zijn.
  const readReceiptMessageId = useMemo(() => {
    if (!messages || !myUserId || !chat) return null;
    const otherIds = chat.members.filter((m) => m.id !== myUserId).map((m) => m.id);
    if (otherIds.length === 0) return null;
    // Loop van nieuwste naar oudste om het meest recente geval te vinden.
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.sender_id !== myUserId) continue;
      if (msg.id.startsWith("optimistic-")) continue;
      const allRead = otherIds.every((uid) => {
        const lastRead = otherMembersLastRead.get(uid);
        if (!lastRead) return false;
        return new Date(lastRead) >= new Date(msg.created_at);
      });
      if (allRead) return msg.id;
      // Als het nieuwste bericht van mij nog niet gelezen is, stop dan.
      break;
    }
    return null;
  }, [messages, myUserId, chat, otherMembersLastRead]);

  function onDraftChange(text: string) {
    const converted = replaceEmoticons(text);
    setDraft(converted);
    if (converted.trim().length > 0) typingSendRef.current?.(myName);
    updateMentionState(converted);
    updateEmojiState(converted);
  }

  function updateEmojiState(text: string) {
    const match = text.match(/:([a-z0-9_+\-]{2,})$/i);
    if (!match) { setEmojiList(null); return; }
    const q = match[1].toLowerCase();
    const results = EMOJI_SHORTCODES
      .filter(({ name }) => name.includes(q))
      .slice(0, 8);
    setEmojiList(results.length > 0 ? results : null);
  }

  function applyEmoji(name: string, emoji: string) {
    const replaced = draft.replace(/:([a-z0-9_+\-]{2,})$/i, emoji + " ");
    setDraft(replaced);
    setEmojiList(null);
  }

  function updateMentionState(text: string) {
    // Detecteer of de cursor net na een @-token zit en toon autocomplete
    const match = text.match(/(?:^|\s)@([a-z0-9._]*)$/i);
    if (!match || !chat || !myUserId) {
      setMentionList(null);
      return;
    }
    const query = match[1].toLowerCase();
    const candidates = chat.members
      .filter((m) => m.id !== myUserId)
      .filter((m) => !query || m.username.toLowerCase().startsWith(query))
      .slice(0, 5)
      .map((m) => ({
        display: m.display_name ?? m.username,
        username: m.username,
      }));
    setMentionList(candidates.length > 0 ? candidates : null);
  }

  function applyMention(username: string) {
    const replaced = draft.replace(/(?:^|\s)@([a-z0-9._]*)$/i, (m) => {
      const leading = m.startsWith(" ") || m.startsWith("\n") || m.startsWith("\t") ? m[0] : "";
      return `${leading}@${username} `;
    });
    setDraft(replaced);
    setMentionList(null);
  }

  async function loadEarlierMessages() {
    if (!myUserId || !id || !messages || !hasMoreMessages || loadingEarlier) return;
    const oldest = messages[0];
    if (!oldest) return;
    setLoadingEarlier(true);
    try {
      // Re-fetch bestaande pendingRekey-berichten: misschien is re-keying
      // ondertussen afgerond terwijl de gebruiker omhoog scrollde.
      const pendingIds = messages
        .filter((m) => m.pendingRekey)
        .map((m) => m.id);
      if (pendingIds.length > 0) {
        fetchMessagesByIds(pendingIds, myUserId)
          .then((refreshed) => {
            if (refreshed.length === 0) return;
            setMessages((prev) => {
              if (!prev) return prev;
              const byId = new Map(refreshed.map((m) => [m.id, m]));
              return prev.map((m) => byId.get(m.id) ?? m);
            });
          })
          .catch(() => {}); // fire-and-forget
      }

      const { messages: earlier, hasMore } = await fetchEarlierMessages(
        id,
        myUserId,
        oldest.created_at
      );
      setHasMoreMessages(hasMore);
      if (earlier.length > 0) {
        setMessages((prev) => (prev ? [...earlier, ...prev] : earlier));
      }
    } catch (e: any) {
      console.warn("loadEarlierMessages", e?.message ?? e);
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function onSend() {
    if (!myUserId || !id) return;
    const text = draft.trim();
    if (!text) return;

    // Lichte impact-feedback bij verzenden — voelt responsief op iOS
    if (Platform.OS === "ios") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    // Optimistic bericht — toont meteen in de bubble, met "pending" flag.
    // Zodra de echte rij via realtime binnenkomt, vervangen we de optimistic
    // rij door de server-row. Als de send faalt, markeren we als 'failed'.
    const tempId = `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const nowIso = new Date().toISOString();
    const optimistic: DecryptedMessage = {
      id: tempId,
      chat_id: id,
      sender_id: myUserId,
      content: { text },
      created_at: nowIso,
    };
    setMessages((prev) => (prev ? [...prev, optimistic] : [optimistic]));
    setDraft("");
    setMentionList(null);

    const currentReply = replyTo;
    setReplyTo(null);
    setShowEmojiPicker(false);
    // Patch de optimistic rij met de reply zodat de quote meteen zichtbaar is
    if (currentReply) {
      setMessages((prev) =>
        prev
          ? prev.map((m) =>
              m.id === tempId
                ? { ...m, content: { text, reply: currentReply } }
                : m
            )
          : prev
      );
    }

    try {
      const real = await sendMessage({ chatId: id, senderId: myUserId, text, reply: currentReply ?? undefined });
      // Vervang optimistic met de echte id (tenzij realtime ons al voor was).
      setMessages((prev) => {
        if (!prev) return prev;
        if (prev.some((m) => m.id === real.id)) {
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) =>
          m.id === tempId ? { ...m, id: real.id, created_at: real.created_at } : m
        );
      });
    } catch (e: any) {
      console.warn("sendMessage", e?.message ?? e);
      setFailedMessages((prev) => new Set(prev).add(tempId));
    }
  }

  async function onDeleteMessage(messageId: string) {
    try {
      await deleteMessage(messageId);
      setMessages((prev) => prev ? prev.filter((m) => m.id !== messageId) : prev);
    } catch (e: any) {
      console.warn("deleteMessage", e?.message ?? e);
    }
  }

  async function onConfirmEdit(messageId: string, newText: string) {
    if (!myUserId || !id) return;
    const trimmed = newText.trim();
    if (!trimmed) return;
    setEditingMessage(null);
    try {
      await editMessage(messageId, id, trimmed, myUserId);
      // Lokaal meteen updaten zodat het niet wacht op realtime
      setMessages((prev) =>
        prev ? prev.map((m) =>
          m.id === messageId
            ? { ...m, content: { ...m.content, text: trimmed }, edited_at: new Date().toISOString() }
            : m
        ) : prev
      );
    } catch (e: any) {
      console.warn("editMessage", e?.message ?? e);
    }
  }

  function retryFailedMessage(tempId: string) {
    setMessages((prev) => {
      if (!prev) return prev;
      const msg = prev.find((m) => m.id === tempId);
      if (!msg || !msg.content?.text) return prev;
      // Verwijder eerst de gefaalde rij, daarna sturen we opnieuw via onSend.
      setDraft(msg.content.text);
      setFailedMessages((p) => {
        const n = new Set(p);
        n.delete(tempId);
        return n;
      });
      return prev.filter((m) => m.id !== tempId);
    });
  }

  // Op web: Enter verstuurt, Shift+Enter voegt een nieuwe regel in. Op native
  // gebeurt er niks bijzonders — daar is Enter altijd een nieuwe regel en
  // moet je op de send-knop tikken (zoals iMessage / WhatsApp).
  function onComposerKeyPress(e: any) {
    if (Platform.OS !== "web") return;
    const native = e?.nativeEvent ?? {};
    const isEnter = native.key === "Enter";
    const shift = native.shiftKey;
    if (isEnter && !shift) {
      e.preventDefault?.();
      if (!sending && draft.trim().length > 0) {
        onSend();
      }
    }
  }

  async function onSendAttachment(args: {
    uri: string;
    mimeType: string;
    filename?: string;
  }) {
    if (!myUserId || !id) return;
    setSending(true);
    try {
      const bytes = await uriToBytes(args.uri);
      const { ciphertext, key, nonce } = encryptFileBytes(bytes);
      const path = await uploadEncryptedAttachment({ chatId: id, ciphertext });
      const attachment = buildAttachmentInfo({
        path,
        key,
        nonce,
        mimeType: args.mimeType,
        size: bytes.byteLength,
        filename: args.filename,
        attachmentType: attachmentTypeFor(args.mimeType),
      });
      await sendMessage({
        chatId: id,
        senderId: myUserId,
        text: draft.trim() || undefined,
        attachment,
      });
      setDraft("");
    } catch (e: any) {
      console.warn("send attachment", e?.message ?? e);
    } finally {
      setSending(false);
    }
  }

  async function pickImage() {
    setAttachMenuOpen(false);
    // Vraag toestemming op — op iOS verschijnt dit als apart dialoog vóór de
    // foto-picker. Als toestemming al verleend is, doet dit niets.
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
      allowsEditing: false,
      allowsMultipleSelection: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    await onSendAttachment({
      uri: asset.uri,
      mimeType: asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      filename: asset.fileName ?? undefined,
    });
  }

  async function pickFile() {
    setAttachMenuOpen(false);
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    await onSendAttachment({
      uri: asset.uri,
      mimeType: asset.mimeType ?? "application/octet-stream",
      filename: asset.name,
    });
  }

  async function onToggleReaction(messageId: string, emoji: string) {
    if (!myUserId) return;
    if (Platform.OS === "ios") {
      Haptics.selectionAsync().catch(() => {});
    }
    const mine = reactions.some(
      (r) => r.message_id === messageId && r.user_id === myUserId && r.emoji === emoji
    );
    try {
      if (mine) await removeReaction({ messageId, userId: myUserId, emoji });
      else await addReaction({ messageId, userId: myUserId, emoji });
      // Refetch reactions
      const rxs = await listReactionsForMessages((messages ?? []).map((m) => m.id));
      setReactions(rxs);
    } catch (e: any) {
      console.warn("toggleReaction", e?.message ?? e);
    }
  }

  function reactionsForMessage(messageId: string): GroupedReaction[] {
    return groupReactions(
      reactions.filter((r) => r.message_id === messageId),
      myUserId ?? ""
    );
  }

  const onPressHeaderTitle = useCallback(() => {
    if (!chat || !myUserId) return;
    if (chat.type === "group") {
      router.push(`/group/${id}`);
      return;
    }
    const other = otherMember(chat, myUserId);
    if (other) router.push(`/user/${other.username}`);
  }, [chat, myUserId, id, router]);

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top", "left", "right"]}>
      <ScreenContainer>
        <View className="bg-paper-soft border-b border-line-paper">
          <View className="flex-row items-center px-3 py-3 gap-2">
            <Pressable
              onPress={() => safeBack(router, "/(app)/chats")}
              className="w-9 h-9 rounded-full bg-paper-warm items-center justify-center"
            >
              <Ionicons name="chevron-back" color="#1A1714" size={20} />
              {otherUnread > 0 && (
                <View
                  className="bg-flame rounded-full absolute -right-1 -top-1 px-1"
                  style={{
                    minWidth: 16,
                    height: 16,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text className="text-cream text-[9px] font-bold">
                    {otherUnread > 99 ? "99+" : otherUnread}
                  </Text>
                </View>
              )}
            </Pressable>
            <Pressable
              onPress={onPressHeaderTitle}
              className="flex-row items-center flex-1"
              hitSlop={4}
            >
              <Avatar
                name={title}
                avatarUrl={
                  chat?.type === "group"
                    ? chat.avatar_url ?? null
                    : (chat?.members.find((m) => m.id !== myUserId)?.avatar_url ?? null)
                }
                size="md"
              />
              <View className="flex-1 ml-3">
                <Text className="text-ink font-bold" numberOfLines={1}>
                  {title}
                </Text>
                <View className="flex-row items-center mt-0.5">
                  <Ionicons name="lock-closed" color="#5B8DEF" size={11} />
                  <Text className="text-ink-muted text-xs ml-1">
                    {chat?.type === "group"
                      ? `${chat.members.length} leden • E2E`
                      : "End-to-end versleuteld"}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              onPress={async () => {
                if (!id) return;
                // Op web: open in-app modal. Op native: open in browser.
                if (typeof window !== "undefined" && window.document) {
                  setCallOpen(true);
                } else {
                  openJitsiCall(id).catch(() => {});
                }
                // Stuur één keer per sessie een call-notificatie in de chat,
                // zodat andere deelnemers een "Deelnemen"-kaart te zien krijgen.
                if (!callSentRef.current && myUserId) {
                  callSentRef.current = true;
                  try {
                    await sendMessage({ chatId: id, senderId: myUserId, call: { started: true } });
                  } catch (e: any) {
                    console.warn("sendCallMessage", e?.message ?? e);
                  }
                }
              }}
              className="w-9 h-9 rounded-full bg-paper-warm items-center justify-center"
            >
              <Ionicons name="videocam-outline" color="#1A1714" size={18} />
            </Pressable>
            {chat?.type === "group" && (
              <Pressable
                onPress={() => router.push(`/group/${id}`)}
                className="w-9 h-9 rounded-full bg-paper-warm items-center justify-center"
              >
                <Ionicons name="information-circle-outline" color="#1A1714" size={20} />
              </Pressable>
            )}
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          {messages === null ? (
            <View className="flex-1 px-4 pt-4 gap-3">
              <View className="self-start max-w-[60%]">
                <Skeleton
                  className="bg-paper-soft rounded-2xl rounded-bl-md"
                  style={{ height: 38, width: 200 }}
                />
              </View>
              <View className="self-end max-w-[60%]">
                <Skeleton
                  className="bg-ink/40 rounded-2xl rounded-br-md"
                  style={{ height: 38, width: 160 }}
                />
              </View>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={[...(messages ?? [])].reverse()}
              keyExtractor={(m) => m.id}
              inverted
              contentContainerStyle={{ padding: 16, paddingTop: 28, gap: 6 }}
              keyboardShouldPersistTaps="handled"
              onScroll={(e) => {
                // Bij inverted is offset.y=0 = onderaan
                setShowScrollDown(e.nativeEvent.contentOffset.y > 120);
              }}
              scrollEventThrottle={100}
              onScrollToIndexFailed={({ index }) => {
                setTimeout(() => {
                  listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
                }, 300);
              }}
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
              removeClippedSubviews={Platform.OS !== "web"}
              maxToRenderPerBatch={15}
              windowSize={8}
              initialNumToRender={20}
              onEndReached={loadEarlierMessages}
              onEndReachedThreshold={0.1}
              ListFooterComponent={
                <>
                  {/* Laad-indicator voor oudere berichten */}
                  {loadingEarlier && (
                    <View className="items-center py-3">
                      <ActivityIndicator color="#8A7E6C" size="small" />
                    </View>
                  )}
                  {/* Melding als alle geschiedenis geladen is */}
                  {!hasMoreMessages && messages.length > 0 && (
                    <View className="items-center py-2 mb-2">
                      <Text className="text-ink-muted text-xs">Begin van het gesprek</Text>
                    </View>
                  )}
                  {/* Banner: berichten worden nog opnieuw versleuteld (re-keying bezig) */}
                  {messages.some((m) => m.pendingRekey) && (
                    <View className="bg-paper-warm rounded-2xl px-4 py-3 mb-3 flex-row items-start gap-3">
                      <ActivityIndicator size="small" color="#8C7B6B" style={{ marginTop: 1 }} />
                      <Text className="text-ink-soft text-xs leading-5 flex-1">
                        Oudere berichten worden op de achtergrond ontsleuteld voor je. Scroll omhoog om ze te laden.
                      </Text>
                    </View>
                  )}
                  {/* Banner: berichten permanent onleesbaar (auth-tag mismatch, ander device) */}
                  {messages.some((m) => m.content === null && !m.pendingRekey) && (
                    <View className="bg-paper-warm rounded-2xl px-4 py-3 mb-3 flex-row items-start gap-3">
                      <Ionicons name="lock-closed" color="#8C7B6B" size={15} style={{ marginTop: 2 }} />
                      <Text className="text-ink-soft text-xs leading-5 flex-1">
                        Sommige berichten zijn versleuteld met de sleutel van een
                        ander apparaat en kunnen hier niet gelezen worden. Stuur
                        een nieuw bericht — dat werkt wel.
                      </Text>
                    </View>
                  )}
                </>
              }
              renderItem={({ item, index }) => {
                // data is reversed: index 0 = nieuwste bericht
                // "prev" (ouder) = index+1, "next" (nieuwer) = index-1
                const reversed = messages ?? [];
                const prev = index < reversed.length - 1 ? reversed[reversed.length - 2 - index] : null;
                const next = index > 0 ? reversed[reversed.length - index] : null;
                const isMine = item.sender_id === myUserId;
                const isGroup = chat?.type === "group";
                // Een "run" is een opeenvolgende reeks berichten van dezelfde
                // afzender. We tonen de naam alleen op de eerste bubble van
                // de run en de avatar alleen op de laatste — net als Telegram.
                const showSenderGap =
                  !prev || prev.sender_id !== item.sender_id;
                const showSenderHeader =
                  isGroup && !isMine && showSenderGap;
                const showAvatar =
                  isGroup &&
                  !isMine &&
                  (!next || next.sender_id !== item.sender_id);
                const senderProfile = chat?.members.find(
                  (m) => m.id === item.sender_id
                );
                const senderName =
                  senderProfile?.display_name ??
                  senderProfile?.username ??
                  "Onbekend";
                const senderAvatarUrl = senderProfile?.avatar_url ?? null;
                const senderColor = colorForSenderId(item.sender_id);
                const bubbleColor = isGroup && !isMine ? bubbleColorForSenderId(item.sender_id) : undefined;
                const isPending = item.id.startsWith("optimistic-");
                const isFailed = failedMessages.has(item.id);
                // Systeemmelding — gecentreerde pill.
                if (item.content?.system) {
                  return (
                    <View className="items-center my-2">
                      <View className="bg-paper-soft rounded-full px-4 py-1.5 flex-row items-center gap-2">
                        <Ionicons name="camera-outline" color="#8A7E6C" size={13} />
                        <Text className="text-ink-muted text-xs">
                          {item.content.system.actorName} heeft de groepsfoto gewijzigd
                        </Text>
                      </View>
                    </View>
                  );
                }

                // Call-notificatie — gecentreerde kaart met "Deelnemen"-knop.
                if (item.content?.call?.started) {
                  return (
                    <View style={{ marginTop: 8 }}>
                      <CallNotificationCard
                        msg={item}
                        isMine={isMine}
                        senderName={senderName}
                        onJoin={() => {
                          if (typeof window !== "undefined" && window.document) {
                            setCallOpen(true);
                          } else {
                            openJitsiCall(item.chat_id).catch(() => {});
                          }
                        }}
                      />
                    </View>
                  );
                }

                return (
                  <View style={{ marginTop: showSenderGap ? 8 : 0 }}>
                    <MessageBubble
                      msg={item}
                      isMine={isMine}
                      isGroup={!!isGroup}
                      showSenderHeader={showSenderHeader}
                      showAvatar={showAvatar}
                      senderAvatarUrl={senderAvatarUrl}
                      senderName={senderName}
                      senderColor={senderColor}
                      bubbleColor={bubbleColor}
                      pending={isPending && !isFailed}
                      failed={isFailed}
                      showReadReceipt={item.id === readReceiptMessageId}
                      onRetry={() => retryFailedMessage(item.id)}
                      reactions={reactionsForMessage(item.id)}
                      onLongPress={() => {
                        if (isPending || isFailed) return;
                        const replyFn = () => {
                          const name = isMine ? "Jij" : (senderName ?? "Onbekend");
                          const preview = item.content?.text
                            ? item.content.text.slice(0, 80)
                            : item.content?.attachment
                              ? `[${item.content.attachment.type}]`
                              : "…";
                          setReplyTo({ messageId: item.id, senderName: name, previewText: preview });
                          setTimeout(() => inputRef.current?.focus(), 50);
                        };
                        setReactionPicker({ msg: item, onReply: replyFn, canEdit: isMine && !!item.content?.text, copyText: item.content?.text ?? undefined });
                      }}

                      onToggleReaction={(emoji) =>
                        !isPending && !isFailed && onToggleReaction(item.id, emoji)
                      }
                      onReply={!isPending && !isFailed ? () => {
                        const name = isMine
                          ? "Jij"
                          : (senderName ?? "Onbekend");
                        const preview = item.content?.text
                          ? item.content.text.slice(0, 80)
                          : item.content?.attachment
                            ? `[${item.content.attachment.type}]`
                            : "…";
                        setReplyTo({ messageId: item.id, senderName: name, previewText: preview });
                        setTimeout(() => inputRef.current?.focus(), 50);
                      } : undefined}
                      onMenuPress={!isPending && !isFailed ? () => {
                        const replyFn = () => {
                          const name = isMine ? "Jij" : (senderName ?? "Onbekend");
                          const preview = item.content?.text
                            ? item.content.text.slice(0, 80)
                            : item.content?.attachment
                              ? `[${item.content.attachment.type}]`
                              : "…";
                          setReplyTo({ messageId: item.id, senderName: name, previewText: preview });
                          setTimeout(() => inputRef.current?.focus(), 50);
                        };
                        setReactionPicker({ msg: item, onReply: replyFn, canEdit: isMine && !!item.content?.text, copyText: item.content?.text ?? undefined });
                      } : undefined}
                      onReplyQuotePress={(messageId) => {
                        const msgs = messages ?? [];
                        const idx = msgs.findIndex((m) => m.id === messageId);
                        if (idx !== -1) {
                          // data is reversed, dus de inverted index = msgs.length - 1 - idx
                          const invertedIdx = msgs.length - 1 - idx;
                          listRef.current?.scrollToIndex({ index: invertedIdx, animated: true, viewPosition: 0.5 });
                        }
                      }}
                      onReactionLongPress={(emoji, userIds) => {
                        const members = chat?.members ?? [];
                        const names = userIds.map((uid) => {
                          if (uid === myUserId) return "Jij";
                          const m = members.find((x) => x.id === uid);
                          return m?.display_name ?? m?.username ?? "Onbekend";
                        });
                        setReactionDetail({ emoji, names });
                      }}
                    />
                  </View>
                );
              }}
              ListEmptyComponent={
                <View className="py-16 items-center">
                  <View className="bg-paper-soft rounded-3xl p-6 max-w-[280px]">
                    <Text className="text-ink font-semibold text-center mb-1">
                      Nog geen berichten
                    </Text>
                    <Text className="text-ink-soft text-sm text-center">
                      Stuur het eerste bericht hieronder. Alleen jullie kunnen het lezen.
                    </Text>
                  </View>
                </View>
              }
            />
          )}

          {typing.size > 0 && (
            <View className="px-5 py-1 bg-shell">
              <Text className="text-cream-soft text-xs italic">
                {typingLabel(typing)}
              </Text>
            </View>
          )}

          {/* Emoji autocomplete (:naam → emoji) */}
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

          {/* Mention autocomplete */}
          {mentionList && mentionList.length > 0 && (
            <View className="px-3 pb-1">
              <View className="bg-paper rounded-2xl overflow-hidden">
                {mentionList.map((m, i) => (
                  <Pressable
                    key={m.username}
                    onPress={() => applyMention(m.username)}
                    className={`flex-row items-center px-4 py-2.5 ${
                      i === mentionList.length - 1
                        ? ""
                        : "border-b border-line-paper/60"
                    }`}
                  >
                    <Avatar name={m.display} size="sm" />
                    <View className="flex-1 ml-3">
                      <Text className="text-ink font-semibold">{m.display}</Text>
                      <Text className="text-ink-muted text-xs">@{m.username}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          )}

          {/* Naar-beneden knop */}
          {showScrollDown && (
            <Pressable
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              style={{
                position: "absolute",
                bottom: 90,
                right: 16,
                zIndex: 10,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#1A1714",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <Ionicons name="chevron-down" color="#F5E8D3" size={20} />
            </Pressable>
          )}

          {/* Composer */}
          <View className="border-t border-line bg-shell-soft">
            {/* Edit bar */}
            {editingMessage && (
              <EditBar
                text={editingMessage.text}
                onConfirm={(t) => onConfirmEdit(editingMessage.id, t)}
                onCancel={() => setEditingMessage(null)}
              />
            )}
            {/* Reply preview bar */}
            {replyTo && (
              <View className="flex-row items-center px-4 pt-2.5 pb-1 gap-3">
                <View className="w-0.5 self-stretch bg-brand rounded-full" />
                <View className="flex-1">
                  <Text className="text-brand text-xs font-semibold" numberOfLines={1}>
                    {replyTo.senderName}
                  </Text>
                  <Text className="text-ink-muted text-xs" numberOfLines={1}>
                    {replyTo.previewText}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setReplyTo(null)}
                  hitSlop={8}
                  className="w-6 h-6 rounded-full bg-paper-warm items-center justify-center"
                >
                  <Ionicons name="close" color="#8A7E6C" size={14} />
                </Pressable>
              </View>
            )}

            {/* Emoji picker panel */}
            {showEmojiPicker && (
              <View
                className="bg-paper-soft border-b border-line-paper"
                style={{ height: 200 }}
              >
                <ScrollView
                  contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", padding: 8 }}
                  showsVerticalScrollIndicator={false}
                >
                  {CHAT_EMOJIS.map((emoji) => (
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

            <View className="flex-row items-end gap-2 px-3 py-3">
              <Pressable
                onPress={() => setAttachMenuOpen(true)}
                disabled={sending}
                className="w-11 h-11 rounded-full bg-paper-warm active:bg-paper items-center justify-center"
              >
                <Ionicons name="add" color="#1A1714" size={22} />
              </Pressable>
              {/* Emoji-knop — links zodat je de verzendknop niet per ongeluk raakt */}
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
                  onKeyPress={onComposerKeyPress}
                  onFocus={() => setShowEmojiPicker(false)}
                  placeholder={sending ? "Bezig met versturen…" : "Bericht…"}
                  placeholderTextColor="#8A7E6C"
                  multiline
                  editable={!sending}
                  className="text-ink text-base"
                  style={{ minHeight: 24, ...(Platform.OS === "web" ? { outlineWidth: 0 } as any : {}) }}
                />
              </View>
              <Pressable
                onPress={onSend}
                disabled={sending || !draft.trim()}
                className={`w-13 h-13 rounded-full items-center justify-center ${
                  sending || !draft.trim() ? "bg-shell" : "bg-ink active:bg-ink-soft"
                }`}
                style={{ width: 52, height: 52 }}
              >
                <Ionicons
                  name="arrow-up"
                  color={sending || !draft.trim() ? "#5A4F40" : "#F5E8D3"}
                  size={22}
                />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>

        <ActionSheet
          visible={attachMenuOpen}
          onClose={() => setAttachMenuOpen(false)}
          title="Voeg toe"
          actions={[
            { label: "Foto of video", icon: "image-outline", onPress: pickImage },
            { label: "Bestand", icon: "document-outline", onPress: pickFile },
          ]}
        />

        <ReactionPickerModal
          visible={!!reactionPicker}
          onClose={() => setReactionPicker(null)}
          onReply={reactionPicker?.onReply ? () => {
            reactionPicker.onReply?.();
            setReactionPicker(null);
          } : undefined}
          canEdit={reactionPicker?.canEdit}
          onEdit={reactionPicker?.canEdit ? () => {
            const text = reactionPicker!.msg.content?.text ?? "";
            setEditingMessage({ id: reactionPicker!.msg.id, text });
            setReactionPicker(null);
          } : undefined}
          onDelete={reactionPicker?.msg.sender_id === myUserId ? () => {
            const msgId = reactionPicker!.msg.id;
            setReactionPicker(null);
            onDeleteMessage(msgId);
          } : undefined}
          onCopy={reactionPicker?.copyText ? () => {
            Clipboard.setString(reactionPicker!.copyText!);
            setReactionPicker(null);
          } : undefined}
          onPick={(emoji) => {
            if (reactionPicker) onToggleReaction(reactionPicker.msg.id, emoji);
            setReactionPicker(null);
          }}
        />

        {id && (
          <VideoCallModal
            chatId={id}
            visible={callOpen}
            onClose={() => setCallOpen(false)}
          />
        )}

        {/* Reactie-detail: wie heeft hierop gereageerd */}
        <Modal
          visible={!!reactionDetail}
          transparent
          animationType="fade"
          onRequestClose={() => setReactionDetail(null)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center" }}
            onPress={() => setReactionDetail(null)}
          >
            <Pressable
              onPress={() => {}}
              className="bg-paper rounded-3xl px-6 py-5 mx-8 w-72"
            >
              <Text style={{ fontSize: 40, textAlign: "center", marginBottom: 8 }}>
                {reactionDetail?.emoji}
              </Text>
              {reactionDetail?.names.map((name, i) => (
                <View key={i} className={`py-2.5 ${i < reactionDetail.names.length - 1 ? "border-b border-line-paper/60" : ""}`}>
                  <Text className="text-ink font-medium text-center">{name}</Text>
                </View>
              ))}
            </Pressable>
          </Pressable>
        </Modal>
      </ScreenContainer>
    </SafeAreaView>
  );
}

/**
 * Vervang ASCII-emoticons door emoji zodra de gebruiker een spatie of
 * leesteken typt na de emoticon. Alleen aan het einde van het bericht
 * of vóór een spatie — zodat typen van bijv. ":-)" in een URL niet
 * per ongeluk omgezet wordt.
 */
const EMOTICON_MAP: [RegExp, string][] = [
  [/:-?\)/g,  "😊"],
  [/:-?D/g,   "😄"],
  [/:-?\(/g,  "😔"],
  [/;-?\)/g,  "😉"],
  [/:-?P/gi,  "😛"],
  [/:-?\*/g,  "😘"],
  [/:-?O/gi,  "😮"],
  [/:-?\|/g,  "😐"],
  [/>:-?\(/g, "😠"],
  [/:-?\//g,  "😕"],
  [/:'?\(/g,  "😢"],
  [/\^_?\^/g, "😊"],
  [/<3/g,     "❤️"],
  [/<\/3/g,   "💔"],
  [/B-?\)/g,  "😎"],
  [/:-?X/gi,  "🤐"],
  [/O:-?\)/g, "😇"],
  [/:-?S/gi,  "😖"],
];

// ── Emoji shortcode lookup (Slack-stijl :naam: → emoji) ─────────────────────
const EMOJI_SHORTCODES: { name: string; emoji: string }[] = [
  { name: "thumbsup", emoji: "👍" }, { name: "+1", emoji: "👍" },
  { name: "thumbsdown", emoji: "👎" }, { name: "-1", emoji: "👎" },
  { name: "heart", emoji: "❤️" }, { name: "red_heart", emoji: "❤️" },
  { name: "laughing", emoji: "😂" }, { name: "joy", emoji: "😂" }, { name: "lol", emoji: "😂" },
  { name: "rofl", emoji: "🤣" },
  { name: "smile", emoji: "😊" }, { name: "blush", emoji: "😊" },
  { name: "grin", emoji: "😁" },
  { name: "wink", emoji: "😉" },
  { name: "stuck_out_tongue", emoji: "😛" }, { name: "tongue", emoji: "😛" },
  { name: "sunglasses", emoji: "😎" }, { name: "cool", emoji: "😎" },
  { name: "thinking", emoji: "🤔" },
  { name: "hushed", emoji: "😮" }, { name: "open_mouth", emoji: "😮" },
  { name: "cry", emoji: "😢" }, { name: "crying", emoji: "😢" },
  { name: "sob", emoji: "😭" },
  { name: "angry", emoji: "😠" }, { name: "rage", emoji: "😡" },
  { name: "fire", emoji: "🔥" }, { name: "flame", emoji: "🔥" },
  { name: "tada", emoji: "🎉" }, { name: "party", emoji: "🎉" },
  { name: "eyes", emoji: "👀" },
  { name: "wave", emoji: "👋" },
  { name: "pray", emoji: "🙏" },
  { name: "100", emoji: "💯" },
  { name: "ok", emoji: "👌" }, { name: "ok_hand", emoji: "👌" },
  { name: "clap", emoji: "👏" },
  { name: "muscle", emoji: "💪" },
  { name: "rocket", emoji: "🚀" },
  { name: "star", emoji: "⭐" },
  { name: "sparkles", emoji: "✨" },
  { name: "check", emoji: "✅" }, { name: "white_check_mark", emoji: "✅" },
  { name: "x", emoji: "❌" }, { name: "no", emoji: "❌" },
  { name: "broken_heart", emoji: "💔" },
  { name: "poop", emoji: "💩" },
  { name: "skull", emoji: "💀" }, { name: "dead", emoji: "💀" },
  { name: "exploding_head", emoji: "🤯" }, { name: "mind_blown", emoji: "🤯" },
  { name: "salute", emoji: "🫡" },
  { name: "hug", emoji: "🤗" },
  { name: "shrug", emoji: "🤷" },
  { name: "facepalm", emoji: "🤦" },
  { name: "chef_kiss", emoji: "🤌" },
  { name: "point_up", emoji: "☝️" },
  { name: "raised_hands", emoji: "🙌" },
  { name: "heart_eyes", emoji: "😍" },
  { name: "kiss", emoji: "😘" },
  { name: "yum", emoji: "😋" },
  { name: "monocle", emoji: "🧐" },
  { name: "zipper_mouth", emoji: "🤐" },
  { name: "sweat_smile", emoji: "😅" },
  { name: "sob", emoji: "😭" },
  { name: "scream", emoji: "😱" },
  { name: "flushed", emoji: "😳" },
  { name: "pleading", emoji: "🥺" },
  { name: "pensive", emoji: "😔" },
  { name: "sleeping", emoji: "😴" },
  { name: "sick", emoji: "🤒" },
  { name: "nerd", emoji: "🤓" },
  { name: "clown", emoji: "🤡" },
  { name: "ghost", emoji: "👻" },
  { name: "alien", emoji: "👽" },
  { name: "robot", emoji: "🤖" },
  { name: "cat", emoji: "🐱" }, { name: "dog", emoji: "🐶" },
  { name: "pizza", emoji: "🍕" }, { name: "beer", emoji: "🍺" },
  { name: "coffee", emoji: "☕" }, { name: "cake", emoji: "🎂" },
  { name: "trophy", emoji: "🏆" }, { name: "medal", emoji: "🥇" },
  { name: "football", emoji: "⚽" }, { name: "basketball", emoji: "🏀" },
  { name: "music", emoji: "🎵" }, { name: "microphone", emoji: "🎤" },
  { name: "phone", emoji: "📱" }, { name: "computer", emoji: "💻" },
  { name: "email", emoji: "📧" }, { name: "calendar", emoji: "📅" },
  { name: "clock", emoji: "🕐" }, { name: "hourglass", emoji: "⏳" },
  { name: "moneybag", emoji: "💰" }, { name: "euro", emoji: "💶" },
  { name: "bulb", emoji: "💡" }, { name: "warning", emoji: "⚠️" },
  { name: "lock", emoji: "🔒" }, { name: "key", emoji: "🔑" },
];

function replaceEmoticons(text: string): string {
  // Pas elke emoticon alleen toe als hij gevolgd wordt door een spatie,
  // leesteken of het einde van de string — zodat gedeeltelijk typen
  // (bijv. ":D" terwijl je nog verder typt) niet triggert.
  let result = text;
  for (const [pattern, emoji] of EMOTICON_MAP) {
    result = result.replace(pattern, (match, offset, str) => {
      const after = str[offset + match.length];
      if (after === undefined || after === " " || /[\s.,!?]/.test(after)) {
        return emoji;
      }
      return match;
    });
  }
  return result;
}

function typingLabel(
  typing: Map<string, { name: string; expiresAt: number }>
): string {
  const names = Array.from(typing.values()).map((t) => t.name);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is aan het typen…`;
  if (names.length === 2) return `${names[0]} en ${names[1]} zijn aan het typen…`;
  return `${names[0]} en ${names.length - 1} anderen typen…`;
}

function ReactionPickerModal({
  visible,
  onClose,
  onPick,
  onReply,
  canEdit,
  onEdit,
  onDelete,
  onCopy,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
  onReply?: () => void;
  canEdit?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center" }}
      >
        <View
          className="bg-paper mx-6 rounded-3xl overflow-hidden"
          style={{ maxWidth: 480, alignSelf: "center", width: "90%" }}
        >
          {/* Reacties */}
          <View className="flex-row justify-around px-3 py-3">
            {QUICK_REACTIONS.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => onPick(emoji)}
                hitSlop={6}
                className="w-12 h-12 items-center justify-center"
              >
                <Text style={{ fontSize: 28 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
          <View className="h-px bg-line-paper mx-1" />
          {/* Acties */}
          {onReply && (
            <Pressable onPress={onReply} className="flex-row items-center px-5 py-3.5 active:bg-paper-warm">
              <Ionicons name="return-down-back-outline" color="#5B8DEF" size={18} />
              <Text className="text-ink font-medium ml-3">Beantwoorden</Text>
            </Pressable>
          )}
          {canEdit && onEdit && (
            <Pressable onPress={onEdit} className="flex-row items-center px-5 py-3.5 active:bg-paper-warm">
              <Ionicons name="pencil-outline" color="#1A1714" size={18} />
              <Text className="text-ink font-medium ml-3">Bewerken</Text>
            </Pressable>
          )}
          {onCopy && (
            <Pressable onPress={onCopy} className="flex-row items-center px-5 py-3.5 active:bg-paper-warm">
              <Ionicons name="copy-outline" color="#1A1714" size={18} />
              <Text className="text-ink font-medium ml-3">Kopiëren</Text>
            </Pressable>
          )}
          {onDelete && (
            <Pressable onPress={onDelete} className="flex-row items-center px-5 py-3.5 active:bg-paper-warm">
              <Ionicons name="trash-outline" color="#B23A1C" size={18} />
              <Text className="font-medium ml-3" style={{ color: "#B23A1C" }}>Verwijderen</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Modal>
  );
}

function EditBar({
  text,
  onConfirm,
  onCancel,
}: {
  text: string;
  onConfirm: (newText: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(text);
  return (
    <View className="flex-row items-center px-4 pt-2.5 pb-1 gap-3 border-b border-line-paper/60">
      <View className="w-0.5 self-stretch bg-amber-500 rounded-full" />
      <TextInput
        value={value}
        onChangeText={setValue}
        autoFocus
        multiline
        className="flex-1 text-base"
        style={{ minHeight: 24, maxHeight: 80, color: "#F5E8D3" }}
      />
      <Pressable onPress={() => onConfirm(value)} hitSlop={8} className="p-1">
        <Ionicons name="checkmark" color="#22c55e" size={22} />
      </Pressable>
      <Pressable onPress={onCancel} hitSlop={8} className="p-1">
        <Ionicons name="close" color="#8A7E6C" size={20} />
      </Pressable>
    </View>
  );
}

function MessageBubble({
  msg,
  isMine,
  isGroup,
  showSenderHeader,
  showAvatar,
  senderName,
  senderAvatarUrl,
  senderColor,
  bubbleColor,
  pending,
  failed,
  onRetry,
  reactions,
  onLongPress,
  onToggleReaction,
  showReadReceipt,
  onReply,
  onMenuPress,
  onReplyQuotePress,
  onReactionLongPress,
}: {
  msg: DecryptedMessage;
  isMine: boolean;
  isGroup?: boolean;
  showSenderHeader?: boolean;
  showAvatar?: boolean;
  senderName?: string;
  senderAvatarUrl?: string | null;
  senderColor?: string;
  bubbleColor?: string;
  pending?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  reactions: GroupedReaction[];
  onLongPress: () => void;
  onToggleReaction: (emoji: string) => void;
  showReadReceipt?: boolean;
  onReply?: () => void;
  onMenuPress?: () => void;
  onReplyQuotePress?: (messageId: string) => void;
  onReactionLongPress?: (emoji: string, userIds: string[]) => void;
}) {
  const time = new Date(msg.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const content = msg.content;
  const hasAttachment = !!content?.attachment;
  const hasText = !!content?.text && content.text.length > 0;
  // In groepsgesprekken: avatar-slot links van inkomende berichten
  // zodat alles netjes uitlijnt. Avatar zichtbaar op elke bubble.
  const showAvatarSlot = isGroup && !isMine;

  // ── Swipe-to-reply (rechts) via RNGH — werkt correct binnen FlatList ────
  const swipeX = useRef(new Animated.Value(0)).current;
  const swipeTriggered = useRef(false);
  const springBack = () =>
    Animated.spring(swipeX, { toValue: 0, useNativeDriver: true, friction: 6 }).start();

  const panGesture = Gesture.Pan()
    .activeOffsetX(10)          // activeert pas bij duidelijk horizontale beweging
    .failOffsetY([-8, 8])       // faalt als er meer dan 8px verticaal bewogen wordt
    .runOnJS(true)
    .onBegin(() => {
      swipeTriggered.current = false;
    })
    .onUpdate((e) => {
      const x = Math.min(Math.max(e.translationX, 0), 72);
      swipeX.setValue(x);
      if (x >= 56 && !swipeTriggered.current) {
        swipeTriggered.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onReply?.();
      }
    })
    .onEnd(springBack)
    .onFinalize(springBack);

  return (
    <View className={isMine ? "items-end" : "items-start"}>
      {/* Swipe-to-reply indicator */}
      {Platform.OS !== "web" && (
        <Animated.View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
            opacity: swipeX.interpolate({ inputRange: [0, 56], outputRange: [0, 1] }),
            transform: [{ translateX: swipeX.interpolate({ inputRange: [0, 56], outputRange: [-20, 0] }) }],
            paddingHorizontal: 8,
          }}
        >
          <Ionicons name="return-down-back-outline" color="#5B8DEF" size={18} />
        </Animated.View>
      )}

      {/* Avatar + naam — eenmalig boven de eerste bubble van de run */}
      {showSenderHeader && showAvatarSlot && (
        <View className="flex-row items-center mb-0.5 ml-1 gap-2">
          <Avatar name={senderName} avatarUrl={senderAvatarUrl} size="sm" />
          <Text
            className="text-[12px] font-semibold"
            style={{ color: senderColor }}
            numberOfLines={1}
          >
            {senderName ?? "Onbekend"}
          </Text>
        </View>
      )}

      <GestureDetector gesture={Platform.OS !== "web" ? panGesture : Gesture.Pan()}>
      <Animated.View
        className={`flex-row items-center gap-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}
        style={{
          maxWidth: showAvatarSlot ? "82%" : "90%",
          marginLeft: showAvatarSlot ? 44 : 0,
          transform: [{ translateX: Platform.OS !== "web" ? swipeX : 0 }],
        }}
      >
        {/* Drie-puntjes menu-knop */}
        {onMenuPress && (
          <Pressable
            onPress={onMenuPress}
            hitSlop={8}
            className="w-7 h-7 items-center justify-center opacity-50"
          >
            <Ionicons name="ellipsis-horizontal" color="#8A7E6C" size={16} />
          </Pressable>
        )}
        <View className={isMine ? "items-end flex-1" : "items-start flex-1"}>
      <Pressable
        onLongPress={onLongPress}
        onPress={failed && onRetry ? onRetry : undefined}
        delayLongPress={300}
        // @ts-ignore — onContextMenu is een web-only prop voor rechtermuisknop
        onContextMenu={Platform.OS === "web" ? (e: any) => { e.preventDefault(); onLongPress(); } : undefined}
        style={{
          opacity: pending ? 0.65 : 1,
          ...(bubbleColor && !failed ? { backgroundColor: bubbleColor } : {}),
        }}
        className={`${
          hasAttachment ? "" : content?.reply ? "pt-0 pb-2.5" : "px-4 py-2.5"
        } ${
          failed
            ? "bg-red-700 rounded-2xl rounded-br-md"
            : isMine
              ? "bg-ink rounded-2xl rounded-br-md"
              : "bg-paper-soft rounded-2xl rounded-bl-md"
        }`}
      >
        {content === null ? (
          msg.pendingRekey ? (
            // Envelope ontbreekt nog — re-keying is bezig op de achtergrond.
            <View className={`flex-row items-center gap-2 px-1 py-0.5`}>
              <ActivityIndicator
                size="small"
                color={isMine ? "#F5E8D3" : "#8C7B6B"}
              />
              <Text className={`italic text-xs ${isMine ? "text-cream-muted" : "text-ink-muted"}`}>
                wordt ontsleuteld…
              </Text>
            </View>
          ) : (
            // Envelope bestaat maar decryptie mislukte (ander apparaat / sleutel).
            <Text
              className={`italic px-1 text-xs ${isMine ? "text-cream-muted" : "text-ink-muted"}`}
            >
              🔒 versleuteld
            </Text>
          )
        ) : (
          <>
            {/* Reply-quote — aantikken scrollt naar het originele bericht */}
            {content.reply && (
              <Pressable
                onPress={() => onReplyQuotePress?.(content.reply!.messageId)}
                style={{
                  backgroundColor: isMine ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.10)",
                  borderLeftWidth: 3,
                  borderLeftColor: "#5B8DEF",
                  borderTopLeftRadius: 10,
                  borderTopRightRadius: 10,
                  paddingHorizontal: 10,
                  paddingVertical: 6,
                  marginBottom: 2,
                }}
              >
                <Text selectable={false} style={{ color: "#5B8DEF", fontSize: 10, fontWeight: "600" }} numberOfLines={1}>
                  {content.reply.senderName}
                </Text>
                <Text
                  selectable={false}
                  style={{ color: isMine ? "#C4B49A" : "#6B5E4E", fontSize: 11 }}
                  numberOfLines={2}
                >
                  {content.reply.previewText}
                </Text>
              </Pressable>
            )}
            {hasAttachment && <AttachmentView attachment={content.attachment!} isMine={isMine} />}
            {hasText && (
              <View className={hasAttachment ? "px-3 py-2" : content?.reply ? "px-4 pt-1" : ""}>
                <MentionsText
                  text={content.text!}
                  isMine={isMine}
                  className={`text-base ${isMine ? "text-cream" : "text-ink"}`}
                />
              </View>
            )}
            <View
              className={`flex-row items-center ${
                hasAttachment ? "px-3 pb-2" : content?.reply ? "px-4 mt-0.5 pb-0.5" : "mt-1"
              }`}
            >
              <Text
                className={`text-[10px] ${
                  isMine ? "text-cream-muted" : "text-ink-muted"
                }`}
              >
                {time}{msg.edited_at ? " · bewerkt" : ""}
              </Text>
              {isMine && pending && (
                <Ionicons
                  name="time-outline"
                  size={10}
                  color="#A39A86"
                  style={{ marginLeft: 4 }}
                />
              )}
              {isMine && !pending && !failed && (
                <Ionicons
                  name="checkmark-done"
                  size={11}
                  color="#A39A86"
                  style={{ marginLeft: 4 }}
                />
              )}
              {failed && (
                <Text className="text-cream text-[10px] ml-2 underline">
                  Tap om opnieuw te proberen
                </Text>
              )}
            </View>
          </>
        )}
      </Pressable>
        </View>
      </Animated.View>
      </GestureDetector>

      {reactions.length > 0 && (
        <View
          className={`flex-row gap-1 mt-1 ${isMine ? "self-end pr-1" : "self-start"}`}
          style={showAvatarSlot ? { marginLeft: 44 } : undefined}
        >
          {reactions.map((r) => (
            <Pressable
              key={r.emoji}
              onPress={() => onToggleReaction(r.emoji)}
              onLongPress={() => onReactionLongPress?.(r.emoji, r.userIds)}
              delayLongPress={300}
              className={`flex-row items-center px-2 py-0.5 rounded-full border ${
                r.mine
                  ? "bg-brand/20 border-brand"
                  : "bg-paper-soft border-line-paper"
              }`}
            >
              <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
              <Text
                className={`ml-1 text-xs font-semibold ${
                  r.mine ? "text-brand" : "text-ink-soft"
                }`}
              >
                {r.count}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {isMine && showReadReceipt && (
        <View className="flex-row items-center self-end pr-1 mt-0.5 gap-0.5">
          <Ionicons name="checkmark-done" size={12} color="#5B8DEF" />
          <Text className="text-[10px] text-brand">Gelezen</Text>
        </View>
      )}
    </View>
  );
}

/** Veelgebruikte emoji's voor de simpele in-chat picker. */
const CHAT_EMOJIS = [
  "😀","😂","😍","🥰","😊","😎","🤔","😢","😱","😡",
  "🥺","😏","🤩","😇","🤗","😴","🥳","🤯","🫡","🤭",
  "👍","👎","❤️","💔","🔥","✨","🎉","🙏","💯","👋",
  "✌️","🤞","🤙","👌","💪","🫶","👏","🙌","🤜","🤛",
  "🌟","⭐","💫","🌈","☀️","🌙","❄️","🌊","🍀","🌸",
  "🍕","🍦","🎂","☕","🍺","🥂","🍷","🎵","🎶","🎮",
  "🐶","🐱","🐻","🦁","🐸","🦄","🦋","🐝","💀","👻",
  "👽","🤖","💩","🎭","🎲","🏆","💎","🔑","💡","🔥",
];

/**
 * Deterministische naam- en bubblekleur per user.
 * SENDER_COLORS: tekst/naam (voldoende contrast op lichte achtergrond).
 * BUBBLE_COLORS: zeer lichte tint voor de bubble-achtergrond.
 */
const SENDER_COLORS = [
  "#A0522D", // terracotta
  "#4A7FA5", // stofblauw
  "#8B7355", // warm bruin
  "#4E7C5F", // sauge groen
  "#7B5EA7", // lavendel
  "#A0526B", // oud roze
  "#3D7E7A", // teal
  "#7A6E3B", // olijf
];

// Zachte pastel-tinten die overeenkomen met bovenstaande kleuren.
const BUBBLE_COLORS = [
  "#F5EBE4", // zacht terracotta
  "#E4EDF5", // zacht blauw
  "#EDE8E2", // zacht bruin
  "#E4EDE8", // zacht groen
  "#EDE8F5", // zacht lavendel
  "#F5E4EB", // zacht roze
  "#E4EDEC", // zacht teal
  "#EDEBE0", // zacht olijf
];

function colorForSenderId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash * 31) + id.charCodeAt(i)) | 0;
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
}

function bubbleColorForSenderId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash * 31) + id.charCodeAt(i)) | 0;
  }
  return BUBBLE_COLORS[Math.abs(hash) % BUBBLE_COLORS.length];
}

function CallNotificationCard({
  msg,
  isMine,
  senderName,
  onJoin,
}: {
  msg: DecryptedMessage;
  isMine: boolean;
  senderName: string;
  onJoin: () => void;
}) {
  const time = new Date(msg.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <View className="items-center my-1">
      <View
        className="bg-paper-soft rounded-2xl px-4 py-3 flex-row items-center gap-3"
        style={{ maxWidth: 320, width: "100%" }}
      >
        <View className="w-10 h-10 rounded-full bg-blue-500/15 items-center justify-center">
          <Ionicons name="videocam" color="#5B8DEF" size={18} />
        </View>
        <View className="flex-1">
          <Text className="text-ink font-semibold text-sm">
            {isMine ? "Je startte een videogesprek" : `${senderName} startte een videogesprek`}
          </Text>
          <Text className="text-ink-muted text-xs mt-0.5">{time}</Text>
        </View>
        <Pressable
          onPress={onJoin}
          className="bg-blue-500 active:bg-blue-600 rounded-full px-3 py-1.5"
        >
          <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Deelnemen</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Toont een 240×240 thumbnail. Tap opent een fullscreen lightbox modal
 * met pinch-to-zoom (ScrollView minimumZoomScale/maximumZoomScale werkt
 * native op iOS; op Android en web is het een statisch fullscreen view).
 */
function ImageWithLightbox({ uri, loading }: { uri: string | null; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();

  return (
    <>
      {/* Thumbnail */}
      <Pressable
        onPress={() => uri && setOpen(true)}
        className="overflow-hidden rounded-2xl"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        {uri && !loading ? (
          <Image
            source={{ uri }}
            style={{ width: 240, height: 240 }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View
            style={{ width: 240, height: 240 }}
            className="bg-paper-warm items-center justify-center"
          >
            {loading ? (
              <ActivityIndicator color="#8A7E6C" />
            ) : (
              <Ionicons name="image-outline" color="#5A4F40" size={32} />
            )}
          </View>
        )}
      </Pressable>

      {/* Fullscreen lightbox */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)" }}>
          {/* Sluit-knop */}
          <SafeAreaView
            style={{ position: "absolute", top: 0, right: 0, zIndex: 10, padding: 12 }}
          >
            <Pressable
              onPress={() => setOpen(false)}
              hitSlop={12}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: "rgba(0,0,0,0.5)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" color="#F5E8D3" size={20} />
            </Pressable>
          </SafeAreaView>

          {/* Zoombaar beeld */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ flex: 1, alignItems: "center", justifyContent: "center" }}
            minimumZoomScale={1}
            maximumZoomScale={5}
            centerContent
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
          >
            {uri ? (
              <Image
                source={{ uri }}
                style={{ width: screenW, height: screenH * 0.85 }}
                contentFit="contain"
                transition={100}
              />
            ) : null}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function AttachmentView({
  attachment,
  isMine,
}: {
  attachment: AttachmentInfo;
  isMine: boolean;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cipher = await downloadEncryptedAttachment(attachment.path);
        const plain = decryptFileBytes(
          cipher,
          base64ToBytes(attachment.key_b64),
          base64ToBytes(attachment.nonce_b64)
        );
        if (!plain) throw new Error("Decryptie faalde");
        const filename = `att-${attachment.path.split("/").pop()}`;
        const display = await bytesToDisplayUri(plain, attachment.mime_type, filename);
        if (!cancelled) setUri(display);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Kon bijlage niet laden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.path, attachment.key_b64, attachment.nonce_b64, attachment.mime_type]);

  if (error) {
    return (
      <View className="px-3 py-3">
        <Text
          className={`text-xs italic ${isMine ? "text-cream-muted" : "text-ink-muted"}`}
        >
          ⚠ {error}
        </Text>
      </View>
    );
  }

  if (attachment.type === "image") {
    return (
      <ImageWithLightbox uri={uri ?? null} loading={loading} />
    );
  }

  if (attachment.type === "video") {
    // Pure native Video player vraagt expo-av's Video; we tonen voor nu de
    // poster en een speel-icoon. Een tap opent de URI in browser/native player.
    return (
      <View className="overflow-hidden rounded-2xl">
        <View
          style={{ width: 240, height: 240 }}
          className="bg-paper-warm items-center justify-center"
        >
          {uri ? (
            <Pressable
              onPress={() => uri && Linking.openURL(uri).catch(() => {})}
              className="items-center"
            >
              <Ionicons name="play-circle" color="#1A1714" size={56} />
              <Text className="text-ink-soft text-xs mt-1">Video — tap om te openen</Text>
            </Pressable>
          ) : (
            <Ionicons name="videocam-outline" color="#5A4F40" size={32} />
          )}
        </View>
      </View>
    );
  }

  // Generic file
  return (
    <View
      className={`flex-row items-center px-3 py-3 ${
        isMine ? "bg-ink/20" : "bg-paper-warm/60"
      } rounded-2xl m-1`}
    >
      <View
        className={`w-10 h-10 rounded-full items-center justify-center ${
          isMine ? "bg-cream/20" : "bg-paper-light"
        }`}
      >
        <Ionicons
          name="document-outline"
          color={isMine ? "#F5E8D3" : "#1A1714"}
          size={20}
        />
      </View>
      <View className="flex-1 ml-3">
        <Text
          className={`font-semibold text-sm ${isMine ? "text-cream" : "text-ink"}`}
          numberOfLines={1}
        >
          {attachment.filename ?? "Bestand"}
        </Text>
        <Text
          className={`text-xs ${isMine ? "text-cream-muted" : "text-ink-muted"}`}
        >
          {(attachment.size / 1024).toFixed(0)} KB
        </Text>
      </View>
      {uri && (
        <Pressable
          onPress={() => Linking.openURL(uri!).catch(() => {})}
          className="ml-2 p-2"
        >
          <Ionicons
            name="download-outline"
            color={isMine ? "#F5E8D3" : "#1A1714"}
            size={18}
          />
        </Pressable>
      )}
    </View>
  );
}
