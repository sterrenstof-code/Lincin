import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
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
  listMyChats,
  markChatRead,
  otherMember,
  type ChatWithMembers,
} from "@/lib/api/chats";
import {
  buildAttachmentInfo,
  downloadEncryptedAttachment,
  fetchMessages,
  sendMessage,
  subscribeToAllMyMessages,
  subscribeToChatMessages,
  uploadEncryptedAttachment,
  type AttachmentInfo,
  type DecryptedMessage,
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
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [reactionPicker, setReactionPicker] = useState<DecryptedMessage | null>(null);
  const [mentionList, setMentionList] = useState<
    { display: string; username: string }[] | null
  >(null);
  const listRef = useRef<FlatList<DecryptedMessage>>(null);
  const typingSendRef = useRef<((name: string) => void) | null>(null);
  // Zorg dat per sessie maar één call-notificatie verstuurd wordt.
  const callSentRef = useRef(false);

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
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: false }));
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
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      // Markeer gelezen + invalidate de chats-query zodat de tab-badge meteen
      // mee daalt, ipv pas bij de volgende refetch.
      (async () => {
        try {
          await markChatRead(id);
        } catch {}
        qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      })();
    });

    const rChannel = subscribeToReactions(id, async () => {
      const msgIds = (messages ?? []).map((m) => m.id);
      if (msgIds.length === 0) return;
      const rxs = await listReactionsForMessages(msgIds);
      setReactions(rxs);
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
      supabase.removeChannel(globalChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, myUserId]);

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

  function onDraftChange(text: string) {
    setDraft(text);
    if (text.trim().length > 0) typingSendRef.current?.(myName);
    updateMentionState(text);
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

  async function onSend() {
    if (!myUserId || !id) return;
    const text = draft.trim();
    if (!text) return;

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
    requestAnimationFrame(() =>
      listRef.current?.scrollToEnd({ animated: true })
    );

    try {
      const real = await sendMessage({ chatId: id, senderId: myUserId, text });
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
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets[0]) return;
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
              <Avatar name={title} size="md" />
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
              data={messages}
              keyExtractor={(m) => m.id}
              contentContainerStyle={{ padding: 16, gap: 6 }}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
              ListHeaderComponent={
                // Toon één uitlegbanner als er berichten zijn die niet
                // ontsleuteld konden worden — dit is normaal als de gebruiker
                // voor het eerst inlogt op een nieuw apparaat of browser.
                // Één melding bovenaan is duidelijker dan tientallen ⚠ bubbles.
                messages.some((m) => m.content === null) ? (
                  <View className="bg-paper-warm rounded-2xl px-4 py-3 mb-3 flex-row items-start gap-3">
                    <Ionicons name="lock-closed" color="#8C7B6B" size={15} style={{ marginTop: 2 }} />
                    <Text className="text-ink-soft text-xs leading-5 flex-1">
                      Sommige berichten zijn versleuteld met de sleutel van een
                      ander apparaat en kunnen hier niet gelezen worden. Stuur
                      een nieuw bericht — dat werkt wel.
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item, index }) => {
                const prev = index > 0 ? messages[index - 1] : null;
                const next =
                  index < messages.length - 1 ? messages[index + 1] : null;
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
                const senderColor = colorForSenderId(item.sender_id);
                const isPending = item.id.startsWith("optimistic-");
                const isFailed = failedMessages.has(item.id);
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
                      senderName={senderName}
                      senderColor={senderColor}
                      pending={isPending && !isFailed}
                      failed={isFailed}
                      onRetry={() => retryFailedMessage(item.id)}
                      reactions={reactionsForMessage(item.id)}
                      onLongPress={() =>
                        !isPending && !isFailed && setReactionPicker(item)
                      }
                      onToggleReaction={(emoji) =>
                        !isPending && !isFailed && onToggleReaction(item.id, emoji)
                      }
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

          {/* Composer */}
          <View className="px-3 py-3 border-t border-line bg-shell-soft">
            <View className="flex-row items-end gap-2">
              <Pressable
                onPress={() => setAttachMenuOpen(true)}
                disabled={sending}
                className="w-11 h-11 rounded-full bg-paper-warm active:bg-paper items-center justify-center"
              >
                <Ionicons name="add" color="#1A1714" size={22} />
              </Pressable>
              <View className="flex-1 bg-paper-light rounded-3xl border border-line-paper px-4 py-2 max-h-32">
                <TextInput
                  value={draft}
                  onChangeText={onDraftChange}
                  onKeyPress={onComposerKeyPress}
                  placeholder={sending ? "Bezig met versturen…" : "Bericht…"}
                  placeholderTextColor="#8A7E6C"
                  multiline
                  editable={!sending}
                  className="text-ink text-base"
                  style={{ minHeight: 24 }}
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
          onPick={(emoji) => {
            if (reactionPicker) onToggleReaction(reactionPicker.id, emoji);
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
      </ScreenContainer>
    </SafeAreaView>
  );
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
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center" }}
      >
        <View
          className="bg-paper rounded-full mx-6 px-3 py-3 flex-row justify-around"
          style={{ maxWidth: 480, alignSelf: "center", width: "90%" }}
        >
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
      </Pressable>
    </Modal>
  );
}

function MessageBubble({
  msg,
  isMine,
  isGroup,
  showSenderHeader,
  showAvatar,
  senderName,
  senderColor,
  pending,
  failed,
  onRetry,
  reactions,
  onLongPress,
  onToggleReaction,
}: {
  msg: DecryptedMessage;
  isMine: boolean;
  isGroup?: boolean;
  showSenderHeader?: boolean;
  showAvatar?: boolean;
  senderName?: string;
  senderColor?: string;
  pending?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  reactions: GroupedReaction[];
  onLongPress: () => void;
  onToggleReaction: (emoji: string) => void;
}) {
  const time = new Date(msg.created_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const content = msg.content;
  const hasAttachment = !!content?.attachment;
  const hasText = !!content?.text && content.text.length > 0;
  // In group chats reserveren we een avatar-slot links van inkomende
  // berichten zodat alles netjes onder elkaar uitlijnt, ook als de avatar
  // niet zichtbaar is (alleen op de laatste bubble van een run).
  const showAvatarSlot = !!isGroup && !isMine;
  const initial = (senderName ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <View className={isMine ? "items-end" : "items-start"}>
      <View className="flex-row items-end" style={{ maxWidth: "85%" }}>
        {showAvatarSlot && (
          <View style={{ width: 28, marginRight: 6 }}>
            {showAvatar && (
              <View
                className="w-7 h-7 rounded-full items-center justify-center"
                style={{ backgroundColor: senderColor ?? "#5A4F40" }}
              >
                <Text className="text-cream text-[11px] font-bold">
                  {initial}
                </Text>
              </View>
            )}
          </View>
        )}
        <View className={isMine ? "items-end flex-1" : "items-start flex-1"}>
          {showSenderHeader && (
            <Text
              className="text-[11px] font-semibold mb-0.5 ml-1"
              style={{ color: senderColor ?? "#8A7E6C" }}
              numberOfLines={1}
            >
              {senderName ?? "Onbekend"}
            </Text>
          )}
      <Pressable
        onLongPress={onLongPress}
        onPress={failed && onRetry ? onRetry : undefined}
        delayLongPress={300}
        style={{ opacity: pending ? 0.65 : 1 }}
        className={`${
          hasAttachment ? "" : "px-4 py-2.5"
        } ${
          failed
            ? "bg-red-700 rounded-2xl rounded-br-md"
            : isMine
              ? "bg-ink rounded-2xl rounded-br-md"
              : "bg-paper-soft rounded-2xl rounded-bl-md"
        }`}
      >
        {content === null ? (
          <Text
            className={`italic px-1 text-xs ${isMine ? "text-cream-muted" : "text-ink-muted"}`}
          >
            🔒 versleuteld
          </Text>
        ) : (
          <>
            {hasAttachment && <AttachmentView attachment={content.attachment!} isMine={isMine} />}
            {hasText && (
              <View className={hasAttachment ? "px-3 py-2" : ""}>
                <MentionsText
                  text={content.text!}
                  isMine={isMine}
                  className={`text-base ${isMine ? "text-cream" : "text-ink"}`}
                />
              </View>
            )}
            <View
              className={`flex-row items-center ${
                hasAttachment ? "px-3 pb-2" : "mt-1"
              }`}
            >
              <Text
                className={`text-[10px] ${
                  isMine ? "text-cream-muted" : "text-ink-muted"
                }`}
              >
                {time}
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
      </View>

      {reactions.length > 0 && (
        <View
          className={`flex-row gap-1 mt-1 ${
            isMine
              ? "self-end pr-1"
              : showAvatarSlot
                ? "self-start"
                : "self-start pl-1"
          }`}
          style={showAvatarSlot ? { paddingLeft: 34 } : undefined}
        >
          {reactions.map((r) => (
            <Pressable
              key={r.emoji}
              onPress={() => onToggleReaction(r.emoji)}
              className={`flex-row items-center px-2 py-0.5 rounded-full border ${
                r.mine
                  ? "bg-brand/20 border-brand"
                  : "bg-paper-soft border-line-paper"
              }`}
            >
              <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
              {r.count > 1 && (
                <Text
                  className={`ml-1 text-xs font-semibold ${
                    r.mine ? "text-brand" : "text-ink-soft"
                  }`}
                >
                  {r.count}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/**
 * Deterministische kleur per user — zelfde user_id geeft altijd dezelfde
 * kleur, ongeacht apparaat of sessie. Set is afgestemd op het paper/cream
 * design (warme tinten die contrasteren tegen bg-paper-soft).
 */
const SENDER_COLORS = [
  "#C75B3D", // warm rood
  "#3F7AB2", // blauw
  "#B7882D", // mosterd
  "#5E8C5A", // groen
  "#8E5BA3", // paars
  "#B85277", // magenta
  "#2B7A78", // teal
  "#A0623B", // amber-bruin
];

function colorForSenderId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = ((hash * 31) + id.charCodeAt(i)) | 0;
  }
  return SENDER_COLORS[Math.abs(hash) % SENDER_COLORS.length];
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
      <View className="overflow-hidden rounded-2xl">
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
            <Ionicons name="image-outline" color="#5A4F40" size={32} />
          </View>
        )}
      </View>
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
              onPress={() => uri && typeof window !== "undefined" && window.open(uri, "_blank")}
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
          onPress={() => typeof window !== "undefined" && window.open(uri, "_blank")}
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
