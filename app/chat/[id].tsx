import { Ionicons } from "@expo/vector-icons";
import { EMOJI_SHORTCODES, emojiSuggestionsFor, replaceEmoticons } from "@/lib/emoji";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Audio, Video, ResizeMode } from "expo-av";
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
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { AppChrome, useChromeScroll } from "@/components/AppChrome";
import { Avatar } from "@/components/Avatar";
import { VideoCallModal } from "@/components/VideoCallModal";
import { MentionsText } from "@/components/MentionsText";
import { ChatWorkspace, CHAT_RAIL_BREAKPOINT } from "@/components/ChatWorkspace";
import { useWide } from "@/components/Editorial";
import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import { chromeTag } from "@/lib/hero-transition";
import { safeBack } from "@/lib/nav";
import { useToast } from "@/lib/toast";
import {
  chatTitle,
  fetchMemberLastRead,
  listMyChats,
  markChatRead,
  otherMember,
  subscribeToChatMemberUpdates,
  type ChatWithMembers,
} from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
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
import { getCallPlanWithDetails, voteCallPlanSlot } from "@/lib/api/call-plans";
import { getPollWithDetails, votePoll } from "@/lib/api/polls";
import { CONTROL_H, creamOnDark, feed, FEED_BORDER, feedType, flame, flameDeep, rule, space } from "@/lib/design/type";
import { color } from "@/lib/design/theme";
import { usePageTitle } from "@/lib/page-title";

/**
 * De leesmaat van een gesprek.
 *
 * Berichten liepen over de volle breedte van een breed scherm: regels van
 * honderdvijftig tekens, met een tijdstip zo ver van de tekst dat je niet
 * meer zag dat ze bij elkaar hoorden. Een gesprek is tekst, en tekst heeft
 * een maat.
 *
 * Kop, berichten en tekstregel lezen alle drie deze waarde. Doen ze dat
 * niet, dan begint de kop links, staan de berichten in het midden en loopt
 * het invoerveld tot de rand — drie lijnen op één scherm.
 */
const THREAD_WIDTH = 760;

/**
 * De maatlat van de berichtenbalk.
 *
 * Elke knop is even hoog en even breed, het invoerveld deelt die hoogte,
 * en alles hangt aan dezelfde inspringing. Dat klinkt vanzelfsprekend maar
 * was het niet: de antwoordbalk sprong 16px in, de knoppenrij 12px, de
 * knoppen hadden drie verschillende achtergronden en de verzendknop was
 * bijna zwart op een donkere balk. Zes losse beslissingen op één rij —
 * vandaar de onrust.
 *
 * Kleur staat bewust niet hierin maar in de classNames, zodat NativeWind
 * de licht/donker-stand kan blijven volgen.
 */
const AUX_BUTTON = {
  width: CONTROL_H,
  height: CONTROL_H,
  alignItems: "center",
  justifyContent: "center",
} as const;

/** Indrukken dimt; dat werkt in beide standen zonder een tweede kleur. */
const AUX_PRESSED = { opacity: 0.6 } as const;

/**
 * Eén lege lijst voor alle berichten zónder reacties, en één voor een draad
 * die er nog niet is.
 *
 * `[]` schrijven levert elke keer een nieuwe referentie op, en dan is een
 * bericht zonder reacties bij élke render "veranderd" — precies wat de
 * memoisatie hieronder juist wil voorkomen.
 */
const EMPTY_REACTIONS: GroupedReaction[] = [];
const EMPTY_MESSAGES: DecryptedMessage[] = [];

/**
 * Eén kolom voor álles in de berichtenbalk — antwoord, bewerken, knoppen.
 * Ze hingen elk aan hun eigen padding, waardoor de rode kantlijn van een
 * antwoord niet boven de plus-knop uitkwam.
 */
function ComposerInset({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          width: "100%",
          maxWidth: THREAD_WIDTH,
          alignSelf: "center",
          paddingHorizontal: space.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export default function ChatDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Boven dit breekpunt toont ChatWorkspace de gesprekkenlijst links.
  const { width: windowWidth } = useWindowDimensions();
  const railVisible = windowWidth >= CHAT_RAIL_BREAKPOINT;
  const wide = useWide();
  // De chat scrollt in een eigen omgekeerde lijst, dus de kop klapt hier
  // nooit open of dicht; `compact` houdt hem vast in de balkstand. De
  // Animated.Value is er alleen omdat AppChrome hem in zijn signatuur heeft.
  const chrome = useChromeScroll();
  const screenFocused = useIsFocused();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { session } = useAuth();
  const myUserId = session?.user.id;

  const [chat, setChat] = useState<ChatWithMembers | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[] | null>(null);
  /**
   * Waarom het gesprek er niet is, als het er niet is.
   *
   * `messages === null` betekende twee dingen tegelijk: hij laadt nog, of
   * hij is er nooit gekomen. De tweede bleef staan tot je de app afsloot,
   * want er was niets dat `messages` alsnog zou vullen. Zie de laadhaak
   * hieronder.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Ophogen = opnieuw proberen; de laadhaak hangt eraan. */
  const [reloadKey, setReloadKey] = useState(0);
  /**
   * De berichten zoals ze nú zijn, voor wie er buiten de render bij moet.
   *
   * Het reactie-abonnement hieronder sloot over `messages` héén op het
   * moment van abonneren, en dat moment is precies het moment waarop hij
   * nog `null` is. De handler deed dus voor altijd `msgIds.length === 0` en
   * keerde meteen om: reacties van anderen kwamen nooit live binnen, alleen
   * na een herlaadbeurt. Een ref leest altijd de laatste stand.
   */
  const messagesRef = useRef<DecryptedMessage[] | null>(null);
  messagesRef.current = messages;
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
  const [selectedMsgId, setSelectedMsgId] = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<{ id: string; text: string } | null>(null);
  const [replyTo, setReplyTo] = useState<ReplyInfo | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const inputRef = useRef<TextInput>(null);
  // Read receipts: last_read_at per user_id van andere chat-leden.
  const [otherMembersLastRead, setOtherMembersLastRead] = useState<Map<string, string>>(new Map());
  const [mentionList, setMentionList] = useState<
    { display: string; username: string; avatarUrl?: string | null }[] | null
  >(null);
  const [allFriendCandidates, setAllFriendCandidates] = useState<
    { display: string; username: string; avatarUrl?: string | null }[]
  >([]);
  const [emojiList, setEmojiList] = useState<{ name: string; emoji: string }[] | null>(null);
  const [reactionDetail, setReactionDetail] = useState<{ emoji: string; names: string[] } | null>(null);
  const [pendingImages, setPendingImages] = useState<{
    uri: string;
    mimeType: string;
    filename?: string;
  }[] | null>(null);
  const [pendingCaption, setPendingCaption] = useState("");
  const [selectedPendingIdx, setSelectedPendingIdx] = useState(0);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0); // seconds
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
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
  // Laad vrienden voor @mention autocomplete
  /**
   * Het beeld dat in dit gesprek gedeeld is, nieuwste eerst.
   *
   * Uit de berichten die hier al ontsleuteld in het geheugen staan — een
   * eigen vraag aan de server zou hetzelfde werk nog eens doen, en zonder
   * de sleutels die in die berichten zitten heb je er toch niets aan. De
   * kolom rechts toont er hoogstens negen; zie ChatMediaThumb.
   */
  const sharedMedia = useMemo(() => {
    const out: AttachmentInfo[] = [];
    for (let i = (messages?.length ?? 0) - 1; i >= 0; i--) {
      const attachment = messages?.[i]?.content?.attachment;
      if (attachment?.type === "image") out.push(attachment);
      if (out.length >= 12) break;
    }
    return out;
  }, [messages]);

  useEffect(() => {
    if (!myUserId) return;
    listMyFriendships(myUserId).then((fs) => {
      const candidates = fs
        .filter((f) => f.status === "accepted")
        .map((f) => ({
          display: f.other.display_name ?? f.other.username,
          username: f.other.username,
          avatarUrl: f.other.avatar_url ?? null,
        }));
      setAllFriendCandidates(candidates);
    });
  }, [myUserId]);

  useEffect(() => {
    if (!myUserId || !id) return;
    let cancelled = false;

    /**
     * Het eerste laden van een gesprek — en wat er gebeurde als dat faalde.
     *
     * Deze IIFE had geen `catch`. Viel `fetchMessages` om — een netwerk dat
     * wegvalt, een sleutel die niet klopt, RLS die weigert — dan bleef
     * `messages` op `null` staan, en `null` is hier de wachtstand: je keek
     * voor altijd naar twee grijze balkjes. Er kwam geen melding, want de
     * rejection ging nergens heen.
     *
     * En dat was niet eens het ergste. De berichtenbalk eronder rendert
     * onvoorwaardelijk, dus je kon vrolijk typen en verzenden in een draad
     * waarvan je niets zag — een bericht sturen zonder te weten wat er
     * boven staat, in een app waar dat het hele punt is.
     *
     * Nu drie standen in plaats van twee: laden, mislukt, geladen. Bij
     * "mislukt" staat er waarom, met een knop om het opnieuw te proberen,
     * en de balk laat je niet verzenden.
     */
    (async () => {
      setLoadError(null);
      try {
        const [allChats, msgs] = await Promise.all([
          listMyChats(myUserId),
          fetchMessages(id, myUserId),
        ]);
        if (cancelled) return;
        const c = allChats.find((x) => x.id === id) ?? null;
        setChat(c);
        setMessages(msgs);

        // Naast elkaar. De reacties en het gelezen-merk weten niets van
        // elkaar, en na elkaar wachten kostte een extra heen-en-weer
        // voordat het gesprek zijn emoji's had.
        const [rxs] = await Promise.all([
          listReactionsForMessages(msgs.map((m) => m.id)),
          // Een mislukt gelezen-merk mag het gesprek niet tegenhouden: dan
          // klopt hoogstens de teller in de balk even niet.
          markChatRead(id).catch(() => {}),
        ]);
        if (!cancelled) setReactions(rxs);
        qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      } catch (e: any) {
        if (cancelled) return;
        setLoadError(e?.message ?? "Het gesprek kon niet geladen worden.");
      }
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
      // Uit de ref en niet uit `messages`: zie messagesRef hierboven voor
      // waarom deze handler anders altijd op nul berichten uitkwam.
      const msgIds = (messagesRef.current ?? []).map((m) => m.id);
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
    // `reloadKey` hoort erbij: opnieuw proberen betekent ook opnieuw
    // abonneren — een kanaal dat opgezet werd terwijl het laden faalde
    // hoeft niet per se te leven.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, myUserId, reloadKey]);

  // Focus input zodra replyTo gezet wordt.
  // InteractionManager wacht tot alle animaties/transities klaar zijn
  // voordat hij focust — betrouwbaarder dan een vaste setTimeout op iOS.
  useEffect(() => {
    if (!replyTo) return;
    const task = InteractionManager.runAfterInteractions(() => {
      inputRef.current?.focus();
    });
    // Fallback voor het geval InteractionManager te laat is
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => { task.cancel(); clearTimeout(t); };
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

  usePageTitle(chat && myUserId ? chatTitle(chat, myUserId) : null);

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
    const results = emojiSuggestionsFor(match[1]);
    setEmojiList(results.length > 0 ? results : null);
  }

  function applyEmoji(name: string, emoji: string) {
    const replaced = draft.replace(/:([a-z0-9_+\-]{2,})$/i, emoji + " ");
    setDraft(replaced);
    setEmojiList(null);
  }

  function updateMentionState(text: string) {
    const match = text.match(/(?:^|\s)@([a-z0-9._]*)$/i);
    if (!match || !myUserId) { setMentionList(null); return; }
    const query = match[1].toLowerCase();

    // Chat-leden eerst, daarna vrienden — dedupliceer op username
    const chatCandidates = (chat?.members ?? [])
      .filter((m) => m.id !== myUserId)
      .map((m) => ({ display: m.display_name ?? m.username, username: m.username, avatarUrl: m.avatar_url ?? null }));

    const seen = new Set(chatCandidates.map((c) => c.username));
    const friendCandidates = allFriendCandidates.filter((c) => !seen.has(c.username));
    const all = [...chatCandidates, ...friendCandidates];

    const results = all
      .filter((c) => !query || c.username.startsWith(query) || c.display.toLowerCase().startsWith(query))
      .slice(0, 6);
    setMentionList(results.length > 0 ? results : null);
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
    } catch {
      toast.error("Oudere berichten konden niet opgehaald worden.", {
        action: { label: "Opnieuw", onPress: () => loadEarlierMessages() },
      });
    } finally {
      setLoadingEarlier(false);
    }
  }

  async function onSend() {
    if (!myUserId || !id) return;
    // Niet verzenden in een draad die je niet ziet. De balk rendert
    // onvoorwaardelijk, dus zonder deze regel kon je een bericht in een
    // gesprek gooien waarvan het laden mislukt was — en in een app waar de
    // context van wat erboven staat het hele punt is, is dat blind schieten.
    if (loadError) return;
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
    } catch {
      // De bubbel blijft staan; zonder dit was dat het enige signaal.
      toast.error("Het bericht kon niet verwijderd worden.", {
        action: { label: "Opnieuw", onPress: () => onDeleteMessage(messageId) },
      });
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
    } catch {
      toast.error("De bewerking kon niet bewaard worden.", {
        action: {
          label: "Opnieuw",
          onPress: () => onConfirmEdit(messageId, trimmed),
        },
      });
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
    const key = native.key;
    const shift = native.shiftKey;

    // Tab: eerste suggestie overnemen (mention of emoji)
    if (key === "Tab") {
      e.preventDefault?.();
      if (emojiList && emojiList.length > 0) {
        applyEmoji(emojiList[0].name, emojiList[0].emoji);
        return;
      }
      if (mentionList && mentionList.length > 0) {
        applyMention(mentionList[0].username);
        return;
      }
    }

    if (key === "Enter" && !shift) {
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
    caption?: string;
  }) {
    if (!myUserId || !id) return;
    setSending(true);
    setUploadProgress(0);
    try {
      setUploadProgress(10);
      const bytes = await uriToBytes(args.uri);
      setUploadProgress(30);
      const { ciphertext, key, nonce } = encryptFileBytes(bytes);
      setUploadProgress(50);
      const path = await uploadEncryptedAttachment({ chatId: id, ciphertext });
      setUploadProgress(85);
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
        text: args.caption?.trim() || undefined,
        attachment,
      });
      setUploadProgress(100);
      setDraft("");
    } catch (e: any) {
      // Was een `Alert.alert`: een OS-venster dat het gesprek blokkeert
      // voor iets waar je niets over hoeft te beslissen. De strook zegt
      // hetzelfde en laat je doortypen.
      toast.error(e?.message ?? "De bijlage kon niet verstuurd worden.");
    } finally {
      setSending(false);
      setUploadProgress(null);
    }
  }

  async function pickImage() {
    setAttachMenuOpen(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images", "videos"],
      quality: 0.85,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (result.canceled || !result.assets?.length) return;
    setPendingImages(result.assets.map((asset) => ({
      uri: asset.uri,
      mimeType: asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      filename: asset.fileName ?? undefined,
    })));
    setPendingCaption("");
    setSelectedPendingIdx(0);
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

  async function startRecording() {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = rec;
      setRecording(rec);
      setRecordingDuration(0);
      if (Platform.OS !== "web") {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch {
      // Meestal een geweigerde microfoon. Zonder dit hield je de knop
      // ingedrukt en gebeurde er niets.
      toast.error("Opnemen lukte niet. Staat de microfoon aan voor deze app?");
    }
  }

  async function stopRecording(send: boolean) {
    const rec = recordingRef.current;
    if (!rec) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingRef.current = null;
    setRecording(null);
    setRecordingDuration(0);
    try {
      await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!send) return;
      const uri = rec.getURI();
      if (!uri) return;
      // Determine MIME type by platform
      const mimeType =
        Platform.OS === "ios" ? "audio/m4a" :
        Platform.OS === "android" ? "audio/3gpp" :
        "audio/webm";
      const ext =
        Platform.OS === "ios" ? "m4a" :
        Platform.OS === "android" ? "3gpp" :
        "webm";
      await onSendAttachment({
        uri,
        mimeType,
        filename: `voice-${Date.now()}.${ext}`,
      });
    } catch {
      toast.error("De spraakopname kon niet verstuurd worden.");
    }
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
    } catch {
      toast.error("De reactie kon niet bewaard worden.");
    }
  }

  /**
   * De reacties, één keer per bericht gegroepeerd in plaats van per render.
   *
   * Dit was een functie die de hele reactielijst filterde en groepeerde, en
   * `renderItem` riep hem aan voor élke rij. Bij tweehonderd berichten en
   * driehonderd reacties is dat zestigduizend vergelijkingen per render —
   * en er komt een render bij élke toetsaanslag in de balk eronder, want
   * `draft` staat in ditzelfde onderdeel. Zo wordt typen langzamer naarmate
   * het gesprek langer duurt, wat precies de verkeerde kant op is.
   *
   * Nu één doorloop over de reacties zodra die veranderen, en per rij een
   * opzoeking. Wat er niet in zit levert `EMPTY_REACTIONS` — dezelfde lege
   * array, zodat een bericht zonder reacties niet alsnog elke render een
   * nieuwe prop krijgt.
   */
  const reactionsByMessage = useMemo(() => {
    const grouped = new Map<string, ReactionRow[]>();
    for (const r of reactions) {
      const list = grouped.get(r.message_id);
      if (list) list.push(r);
      else grouped.set(r.message_id, [r]);
    }
    const out = new Map<string, GroupedReaction[]>();
    for (const [messageId, rows] of grouped) {
      out.set(messageId, groupReactions(rows, myUserId ?? ""));
    }
    return out;
  }, [reactions, myUserId]);

  function reactionsForMessage(messageId: string): GroupedReaction[] {
    return reactionsByMessage.get(messageId) ?? EMPTY_REACTIONS;
  }

  /**
   * De draad omgekeerd, één keer per wijziging.
   *
   * `data={[...(messages ?? [])].reverse()}` bouwde een vérse array bij
   * elke render — dus ook bij elke toetsaanslag — en een `FlatList` die
   * een nieuwe `data`-referentie krijgt gaat opnieuw aan het rekenen.
   */
  const reversedMessages = useMemo(
    () => (messages ? [...messages].reverse() : EMPTY_MESSAGES),
    [messages]
  );

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
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top", "left", "right"]}>
      {/* De navigatie van de app staat óók boven een gesprek. Zonder deze
          balk was de chat een doodlopende straat: op desktop verbergt de
          gesprekkenlijst links de terug-knop, en dan was er geen enkele
          weg terug naar de feed, events of je profiel. Zie DESIGN.md §5 —
          elk scherm draagt dezelfde kop.

          `chromeTag` alleen wanneer dit scherm de focus heeft: twee koppen
          met dezelfde naam tegelijk in de DOM laat de browser de hele
          overgang overslaan. Zie lib/hero-transition.web.ts. */}
      <View style={chromeTag(screenFocused)}>
        <AppChrome wide={wide} progress={chrome.progress} compact />
      </View>

      {/* Op desktop drie kolommen: gesprekken links, dit gesprek in het
          midden, opties rechts. Onder 900px levert ChatWorkspace gewoon
          de middenkolom terug en verandert er niets aan dit scherm. */}
      <ChatWorkspace chatId={String(id)} myUserId={myUserId ?? ""} media={sharedMedia}>
        {/*
            De kop van het gesprek staat op het paginavlak zelf en sluit af
            met één inktlijn.

            Hij had een eigen lichte band met daarin drie grijze vierkantjes
            — een tweede vlak bovenop het vlak, en knoppen die als vulling
            lazen terwijl het iconen zijn. Een kader betekent "hier hoort
            iets in"; bij een icoon is dat niet zo (DESIGN.md §4). Wat de
            vulling deed doet de lijn nu, en de knoppen dragen zichzelf op
            de maat die élke knop in de app heeft (CONTROL_H).
        */}
        <View style={{ borderBottomWidth: FEED_BORDER, borderBottomColor: feed.ink }}>
          {/* Zelfde leesmaat als de berichten en de tekstregel: anders
              begint de kop links, staan de berichten in het midden en loopt
              het invoerveld weer tot de rand — drie verschillende lijnen op
              één scherm. Zie THREAD_WIDTH. */}
          <View
            className="flex-row items-center"
            style={{
              width: "100%",
              maxWidth: THREAD_WIDTH,
              alignSelf: "center",
              paddingHorizontal: space.sm,
              paddingVertical: space.sm,
            }}
          >
            <Pressable
              onPress={() => safeBack(router, "/(app)/chats")}
              // Boven het breekpunt staat de gesprekkenlijst al links in
              // beeld; een terug-knop wijst dan nergens heen.
              style={({ pressed }) => [
                AUX_BUTTON,
                { display: railVisible ? "none" : "flex" },
                pressed && AUX_PRESSED,
              ]}
            >
              <Ionicons name="chevron-back" color={feed.ink} size={22} />
              {otherUnread > 0 && (
                <View
                  className="bg-flame absolute px-1"
                  style={{
                    // Tegen het icoon aan, niet tegen de hoek van het
                    // aanraakvlak: dat is 44 punten breed en het cijfer zou
                    // anders los van de pijl komen te hangen.
                    right: 4,
                    top: 4,
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
              style={{ marginLeft: space.xs, minWidth: 0 }}
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
              <View className="flex-1 ml-3" style={{ minWidth: 0 }}>
                <Text
                  style={[feedType.label, { fontSize: 15, fontWeight: "700", color: feed.ink }]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
                {/* Het slot is de énige plek buiten het logo waar het
                    merkblauw mag staan (DESIGN.md §2) — vandaar het token en
                    niet langer de hex die hier los in de code stond. */}
                <View className="flex-row items-center" style={{ marginTop: 1 }}>
                  <Ionicons name="lock-closed" color={color("brand")} size={10} />
                  <Text style={[feedType.label, { color: feed.inkDim, marginLeft: 4 }]}>
                    {chat?.type === "group"
                      ? `${chat.members.length} leden · E2E`
                      : "End-to-end versleuteld"}
                  </Text>
                </View>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Videogesprek starten"
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
              style={({ pressed }) => [AUX_BUTTON, pressed && AUX_PRESSED]}
            >
              <Ionicons name="videocam-outline" color={feed.ink} size={20} />
            </Pressable>
            {chat?.type === "group" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Groepsinfo openen"
                onPress={() => router.push(`/group/${id}`)}
                style={({ pressed }) => [AUX_BUTTON, pressed && AUX_PRESSED]}
              >
                <Ionicons name="information-circle-outline" color={feed.ink} size={20} />
              </Pressable>
            )}
          </View>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
          keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
        >
          {loadError ? (
            /* Laden en mislukken lazen hier hetzelfde: twee grijze balkjes,
               voor altijd. Zie de laadhaak bovenaan. */
            <View className="flex-1 px-4 pt-4">
              <QueryError
                title="Dit gesprek kon niet geladen worden"
                error={loadError}
                onRetry={() => setReloadKey((k) => k + 1)}
              />
            </View>
          ) : messages === null ? (
            <View className="flex-1 px-4 pt-4 gap-3">
              <View className="self-start max-w-[60%]">
                <Skeleton
                  className="bg-paper-soft"
                  style={{ height: 38, width: 200 }}
                />
              </View>
              <View className="self-end max-w-[60%]">
                <Skeleton
                  className="bg-ink/40"
                  style={{ height: 38, width: 160 }}
                />
              </View>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={reversedMessages}
              keyExtractor={(m) => m.id}
              inverted
              /**
                 * De draad krijgt een leesmaat.
                 *
                 * Op een breed scherm liep een bericht over de volle
                 * kolom: regels van honderdvijftig tekens, en een tijd
                 * die zo ver van de tekst stond dat je niet meer zag dat
                 * ze bij elkaar hoorden. Een gesprek is tekst, en tekst
                 * heeft een maat — dezelfde als elders in de app.
                 */
              contentContainerStyle={{
                padding: space.lg,
                paddingTop: 28,
                gap: space.sm,
                width: "100%",
                maxWidth: THREAD_WIDTH,
                alignSelf: "center",
              }}
              keyboardShouldPersistTaps="handled"
              onScrollBeginDrag={() => setSelectedMsgId(null)}
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
                      <ActivityIndicator color={feed.inkDim} size="small" />
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
                    <View className="bg-paper-warm px-4 py-3 mb-3 flex-row items-start gap-3">
                      <ActivityIndicator size="small" color={feed.inkDim} style={{ marginTop: 1 }} />
                      <Text className="text-ink-soft text-xs leading-5 flex-1">
                        Oudere berichten worden op de achtergrond ontsleuteld voor je. Scroll omhoog om ze te laden.
                      </Text>
                    </View>
                  )}
                  {/* Banner: berichten permanent onleesbaar (auth-tag mismatch, ander device) */}
                  {messages.some((m) => m.content === null && !m.pendingRekey) && (
                    <View className="bg-paper-warm px-4 py-3 mb-3 flex-row items-start gap-3">
                      <Ionicons name="lock-closed" color={feed.inkDim} size={15} style={{ marginTop: 2 }} />
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

                // Datum-scheiding: toon wanneer dit bericht van een andere dag is dan het vorige (oudere)
                const showDateSep =
                  !prev ||
                  new Date(item.created_at).toDateString() !==
                    new Date(prev.created_at).toDateString();
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
                const isPending = item.id.startsWith("optimistic-");
                const isFailed = failedMessages.has(item.id);
                /**
                 * De dagscheiding: een lijn met een woord erin.
                 *
                 * Dit was een zwevend vlakje midden op de pagina — het enige
                 * element in het gesprek dat nergens aan vastzat. Een
                 * scheiding is een lijn (DESIGN.md §4), en het woord staat
                 * erin zoals een rubriek in zijn band.
                 */
                const dateSep = showDateSep ? (
                  <View
                    className="flex-row items-center"
                    style={{ marginVertical: space.lg, gap: space.md }}
                  >
                    <View style={{ flex: 1, height: FEED_BORDER, backgroundColor: rule.soft }} />
                    <Text style={[feedType.kicker, { color: feed.inkDim }]}>
                      {formatChatDate(item.created_at).toUpperCase()}
                    </Text>
                    <View style={{ flex: 1, height: FEED_BORDER, backgroundColor: rule.soft }} />
                  </View>
                ) : null;

                // Systeemmelding — gecentreerde pill.
                if (item.content?.system) {
                  return (
                    <View>
                      {dateSep}
                      {/* Een systeemmelding is een terzijde, geen bericht:
                          geen vlak eromheen, alleen kleine tekst midden op
                          de pagina. */}
                      <View
                        className="flex-row items-center justify-center"
                        style={{ marginVertical: space.md, gap: 6 }}
                      >
                        <Ionicons name="camera-outline" color={feed.inkDim} size={12} />
                        <Text style={[feedType.label, { color: feed.inkDim }]}>
                          {item.content.system.actorName} heeft de groepsfoto gewijzigd
                        </Text>
                      </View>
                    </View>
                  );
                }

                // Call-plan bericht — inline kaart met tijdsloten.
                if (item.content?.call_plan_id) {
                  return (
                    <View style={{ marginTop: showSenderGap ? 8 : 0 }}>
                      {dateSep}
                      <ChatCallPlanCard
                        callPlanId={item.content.call_plan_id}
                        senderName={senderName}
                        isMine={isMine}
                      />
                    </View>
                  );
                }

                // Poll bericht — inline stemkaart.
                if (item.content?.poll_id) {
                  return (
                    <View style={{ marginTop: showSenderGap ? 8 : 0 }}>
                      {dateSep}
                      <ChatPollCard
                        pollId={item.content.poll_id}
                        senderName={senderName}
                        isMine={isMine}
                      />
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
                    {dateSep}
                    <MessageBubble
                      msg={item}
                      isMine={isMine}
                      isGroup={!!isGroup}
                      showSenderHeader={showSenderHeader}
                      showAvatar={showAvatar}
                      senderAvatarUrl={senderAvatarUrl}
                      senderName={senderName}
                      pending={isPending && !isFailed}
                      failed={isFailed}
                      showReadReceipt={item.id === readReceiptMessageId}
                      onRetry={() => retryFailedMessage(item.id)}
                      reactions={reactionsForMessage(item.id)}
                      onLongPress={() => {
                        if (isPending || isFailed) return;
                        // Long-press = toon inline actie-toolbar (reply, reactie, kopieer, verwijder)
                        if (Platform.OS !== "web") {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                        }
                        setSelectedMsgId((prev) => prev === item.id ? null : item.id);
                      }}

                      selected={selectedMsgId === item.id}
                      onSelect={!isPending && !isFailed ? () => {
                        setSelectedMsgId((prev) => prev === item.id ? null : item.id);
                      } : undefined}
                      onToggleReaction={(emoji) => {
                        if (!isPending && !isFailed) {
                          onToggleReaction(item.id, emoji);
                          setSelectedMsgId(null);
                        }
                      }}
                      onReply={!isPending && !isFailed ? () => {
                        const name = isMine ? "Jij" : (senderName ?? "Onbekend");
                        const preview = item.content?.text
                          ? item.content.text.slice(0, 80)
                          : item.content?.attachment
                            ? `[${item.content.attachment.type}]`
                            : "…";
                        setReplyTo({ messageId: item.id, senderName: name, previewText: preview });
                        setTimeout(() => inputRef.current?.focus(), 50);
                        setSelectedMsgId(null);
                      } : undefined}
                      onCopy={item.content?.text ? () => {
                        Clipboard.setString(item.content!.text!);
                        setSelectedMsgId(null);
                      } : undefined}
                      /**
                       * Bewerken was volledig gebouwd en nergens bereikbaar.
                       *
                       * `editMessage` in lib/api, `onConfirmEdit` hier, de
                       * `EditBar` in de balk, "· bewerkt" achter de tijd, en
                       * een `ReactionPickerModal` met een potloodregel erin —
                       * alles compleet. Alleen werd die modal met geen
                       * mogelijkheid geopend: `setReactionPicker` werd op zes
                       * plekken aangeroepen en zes keer met `null`, en
                       * `onMenuPress` stond hardgecodeerd op `undefined`.
                       *
                       * Wat er wél opengaat bij een tik is de inline balk
                       * hieronder, en die had antwoorden, twee emoji's,
                       * kopiëren en verwijderen — geen bewerken. Nu wel, op
                       * dezelfde voorwaarde als de dode modal hem stelde:
                       * je eigen bericht, en er moet tekst in zitten (een
                       * foto valt niet te herschrijven).
                       */
                      onEdit={
                        isMine && !isPending && !isFailed && !!item.content?.text
                          ? () => {
                              setEditingMessage({
                                id: item.id,
                                text: item.content!.text!,
                              });
                              setSelectedMsgId(null);
                            }
                          : undefined
                      }
                      onDelete={isMine && !isPending && !isFailed ? () => {
                        onDeleteMessage(item.id);
                        setSelectedMsgId(null);
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
                  <View className="bg-paper-soft p-6 max-w-[280px]">
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
                    className="bg-paper px-3 py-2 flex-row items-center gap-2"
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
              <View className="bg-paper overflow-hidden">
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
                    <Avatar name={m.display} avatarUrl={m.avatarUrl} size="sm" />
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
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Naar het laatste bericht"
              onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
              style={{
                position: "absolute",
                bottom: 90,
                right: 16,
                zIndex: 10,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: feed.ink,
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#000",
                shadowOpacity: 0.3,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <Ionicons name="chevron-down" color={creamOnDark.DEFAULT} size={20} />
            </Pressable>
          )}

          {/* Composer */}
          {/*
              De berichtenbalk is dezelfde balk als bovenaan het scherm.

              Hij stond op `shell-soft` — het dónkere vlak dat volgens §2
              bínnen de balk hoort, niet de balk zelf — dus onderaan het
              scherm lag een tweede, paarsere zwart naast het zwart van de
              kop. De rollen zijn nu omgedraaid: `shell` is de balk, en wat
              erin zit (het tekstveld) draagt `shell-soft`.
          */}
          <View className="border-t border-line bg-shell">
            {/* De inhoud van de balk volgt dezelfde maat; het vlak eronder
                loopt wél door tot de rand, want dat is de bodem van het
                scherm en geen kolom. */}
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
              <ComposerInset style={{ paddingTop: space.md }}>
                {/* Zelfde citaatvorm als in de bubbel: rode kantlijn, geen
                    blauw. Deze balk staat op het donkere composer-vlak. */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
                  <View
                    style={{ width: FEED_BORDER * 2, alignSelf: "stretch", backgroundColor: flame }}
                  />
                  <View style={{ flex: 1, paddingVertical: 2 }}>
                    <Text
                      style={[feedType.kicker, { color: flame, letterSpacing: 0.55 }]}
                      numberOfLines={1}
                    >
                      {replyTo.senderName.toUpperCase()}
                    </Text>
                    <Text
                      style={[feedType.label, { color: creamOnDark.muted, marginTop: 3 }]}
                      numberOfLines={1}
                    >
                      {replyTo.previewText}
                    </Text>
                  </View>
                  {/* Wegklikken is een bijzaak: een icoon, geen blok. Het
                      lichte vierkantje dat hier stond trok meer aandacht
                      dan het bericht waar het over ging. */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Antwoorden annuleren"
                    onPress={() => setReplyTo(null)}
                    hitSlop={10}
                    style={({ pressed }) => ({
                      width: 30,
                      height: 30,
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: pressed ? 0.5 : 1,
                    })}
                  >
                    <Ionicons name="close" color={creamOnDark.muted} size={17} />
                  </Pressable>
                </View>
              </ComposerInset>
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

            <ComposerInset style={{ paddingVertical: space.md }}>
             <View
              style={{
                flexDirection: "row",
                alignItems: "flex-end",
                gap: space.sm,
              }}
             >
              {!recording && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bijlage toevoegen"
                  onPress={() => setAttachMenuOpen(true)}
                  disabled={sending}
                  // Geen eigen vlak: een bijna-zwart vierkant op een zwarte
                  // balk is een kader zonder werk. Het icoon draagt zichzelf.
                  style={({ pressed }) => [AUX_BUTTON, pressed && AUX_PRESSED]}
                >
                  <Ionicons name="add" color={creamOnDark.soft} size={22} />
                </Pressable>
              )}
              {!recording && (
                <Pressable
                  onPress={() => {
                    setShowEmojiPicker((v) => !v);
                    if (!showEmojiPicker) inputRef.current?.blur();
                    else inputRef.current?.focus();
                  }}
                  style={({ pressed }) => [AUX_BUTTON, pressed && AUX_PRESSED]}
                >
                  <Text style={{ fontSize: 19 }}>😊</Text>
                </Pressable>
              )}

              {/* Input area OR recording indicator */}
              {recording ? (
                <View
                  className="flex-1 flex-row items-center bg-red-950/30"
                  style={{ height: CONTROL_H, paddingHorizontal: space.md, gap: space.md }}
                >
                  {/* Pulsing red dot */}
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#EF4444" }} />
                  <Text className="text-red-400 font-semibold text-base flex-1">
                    {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, "0")}
                  </Text>
                  {/* Cancel */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Opname weggooien"
                    onPress={() => stopRecording(false)}
                    hitSlop={8}
                    className="w-7 h-7 bg-red-900/40 items-center justify-center"
                  >
                    <Ionicons name="trash-outline" color="#EF4444" size={15} />
                  </Pressable>
                </View>
              ) : (
                <View
                  // Een wit blad op een zwarte balk was het lichtste vlak van
                  // het hele scherm, en dus het luidste. `shell-soft` is
                  // waar §2 een vlak bínnen de balk heen stuurt.
                  className="flex-1 bg-shell-soft max-h-32 justify-center"
                  style={{ minHeight: CONTROL_H, paddingHorizontal: space.md }}
                >
                  <TextInput
                    ref={inputRef}
                    value={draft}
                    onChangeText={onDraftChange}
                    onKeyPress={onComposerKeyPress}
                    onFocus={() => setShowEmojiPicker(false)}
                    placeholder={sending ? "Bezig met versturen…" : "Bericht…"}
                    placeholderTextColor={creamOnDark.muted}
                    multiline
                    editable={!sending}
                    // Tekst op een vlak dat in béide standen donker blijft is
                    // crème, nooit inkt — zie het kader in DESIGN.md §2.
                    className="text-cream text-base"
                    style={{
                      minHeight: 24,
                      paddingVertical: 10,
                      /**
                       * `outlineWidth: 0` alleen was niet genoeg: Chrome
                       * tekent zijn eigen focusring via `:focus-visible`, en
                       * die stond als felblauw kader om het veld — het
                       * onrustigste ding in de hele balk. `outlineStyle`
                       * zet hem echt uit.
                       */
                      ...(Platform.OS === "web"
                        ? ({ outlineWidth: 0, outlineStyle: "none" } as any)
                        : {}),
                    }}
                  />
                </View>
              )}

              {/* Send / mic / stop button */}
              {recording ? (
                // Recording is active → stop and send
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Opname versturen"
                  onPress={() => stopRecording(true)}
                  className="bg-red-500 active:bg-red-600"
                  style={AUX_BUTTON}
                >
                  <Ionicons name="send" color="#fff" size={20} />
                </Pressable>
              ) : draft.trim() || sending ? (
                /**
                 * Verzenden is het enige felle in de balk, en alleen zolang
                 * er iets te verzenden valt. Dit was `bg-ink` — bijna zwart
                 * op een donkere balk, dus de belangrijkste knop was de
                 * onzichtbaarste.
                 *
                 * En in de oranje, niet in het rood: rood is hier het accent
                 * van de redactie — citaten, rubrieken, lijnwerk — en een
                 * knop die iets dóet hoort niet dezelfde kleur te hebben als
                 * een aanhalingsteken (DESIGN.md §2).
                 */
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bericht versturen"
                  onPress={onSend}
                  disabled={sending || !draft.trim()}
                  className={
                    sending || !draft.trim()
                      ? "bg-shell-soft"
                      : "bg-announce active:bg-announce-deep"
                  }
                  style={AUX_BUTTON}
                >
                  <Ionicons
                    name="arrow-up"
                    color={sending || !draft.trim() ? creamOnDark.muted : creamOnDark.DEFAULT}
                    size={21}
                  />
                </Pressable>
              ) : (
                // Draft empty → mic button (hold on native, tap on web)
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Spraakbericht opnemen"
                  onPressIn={Platform.OS !== "web" ? startRecording : undefined}
                  onPressOut={Platform.OS !== "web" ? () => stopRecording(true) : undefined}
                  onPress={Platform.OS === "web" ? () => {
                    if (recording) stopRecording(true);
                    else startRecording();
                  } : undefined}
                  disabled={sending}
                  // Net als de twee knoppen links: het icoon draagt zichzelf
                  // op de balk. Zodra er iets te versturen valt neemt de
                  // oranje knop deze plek over — dán is er een vlak.
                  style={({ pressed }) => [AUX_BUTTON, pressed && AUX_PRESSED]}
                >
                  <Ionicons name="mic" color={creamOnDark.soft} size={21} />
                </Pressable>
              )}
             </View>
            </ComposerInset>
          </View>
        </KeyboardAvoidingView>

        {/* Multi-foto preview modal (Telegram-stijl) */}
        <Modal
          visible={!!pendingImages}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (!sending) { setPendingImages(null); setPendingCaption(""); setSelectedPendingIdx(0); }
          }}
        >
          <View style={{ flex: 1, backgroundColor: "#000" }}>
            {/* Sluit-knop + teller */}
            <SafeAreaView style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingTop: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sluiten"
                onPress={() => { if (!sending) { setPendingImages(null); setPendingCaption(""); setSelectedPendingIdx(0); } }}
                hitSlop={12}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
              >
                <Ionicons name="close" color="#fff" size={22} />
              </Pressable>
              {pendingImages && pendingImages.length > 1 && (
                <View style={{ marginLeft: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>
                    {selectedPendingIdx + 1} / {pendingImages.length}
                  </Text>
                </View>
              )}
            </SafeAreaView>

            {/* Hoofdafbeelding */}
            {pendingImages && (
              <Image
                source={{ uri: pendingImages[selectedPendingIdx]?.uri }}
                style={{ flex: 1 }}
                contentFit="contain"
              />
            )}

            {/* Upload voortgang */}
            {uploadProgress !== null && (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, backgroundColor: "rgba(255,255,255,0.2)" }}>
                <View style={{ height: 3, width: `${uploadProgress}%`, backgroundColor: flame }} />
              </View>
            )}

            {/* Thumbnail strip (alleen bij meerdere foto's) */}
            {pendingImages && pendingImages.length > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 6, gap: 6 }}
                style={{ backgroundColor: "rgba(0,0,0,0.7)", maxHeight: 84 }}
              >
                {pendingImages.map((img, i) => (
                  <Pressable
                    key={i}
                    onPress={() => setSelectedPendingIdx(i)}
                    style={{
                      width: 64, height: 64, borderRadius: 8, overflow: "hidden",
                      borderWidth: 2,
                      borderColor: i === selectedPendingIdx ? flame : "transparent",
                    }}
                  >
                    <Image source={{ uri: img.uri }} style={{ width: 64, height: 64 }} contentFit="cover" />
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Caption + verstuur */}
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={{ backgroundColor: "rgba(0,0,0,0.7)", flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingVertical: 10, gap: 10 }}>
                <TextInput
                  value={pendingCaption}
                  onChangeText={setPendingCaption}
                  placeholder="Voeg een onderschrift toe…"
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  multiline
                  maxLength={500}
                  editable={!sending}
                  style={{
                    flex: 1,
                    color: "#fff",
                    fontSize: 16,
                    minHeight: 40,
                    maxHeight: 100,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    backgroundColor: "rgba(255,255,255,0.12)",
                    borderRadius: 20,
                    ...(Platform.OS === "web" ? { outlineWidth: 0 } as any : {}),
                  }}
                />
                <Pressable
                  onPress={async () => {
                    if (!pendingImages?.length || sending) return;
                    const images = [...pendingImages];
                    const caption = pendingCaption;
                    setPendingImages(null);
                    setPendingCaption("");
                    setSelectedPendingIdx(0);
                    for (let i = 0; i < images.length; i++) {
                      await onSendAttachment({
                        uri: images[i].uri,
                        mimeType: images[i].mimeType,
                        filename: images[i].filename,
                        caption: i === images.length - 1 ? caption : undefined,
                      });
                    }
                  }}
                  disabled={sending}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: sending ? "#3A3A3A" : flame,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {sending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <View style={{ alignItems: "center", justifyContent: "center" }}>
                      {pendingImages && pendingImages.length > 1 ? (
                        <Text style={{ color: "#fff", fontSize: 13, fontWeight: "700" }}>
                          {pendingImages.length}
                        </Text>
                      ) : (
                        <Ionicons name="arrow-up" color="#fff" size={22} />
                      )}
                    </View>
                  )}
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <ActionSheet
          visible={attachMenuOpen}
          onClose={() => setAttachMenuOpen(false)}
          title="Voeg toe"
          actions={[
            { label: "Foto of video", icon: "image-outline", onPress: pickImage },
            { label: "Bestand", icon: "document-outline", onPress: pickFile },
            {
              label: "Videocall plannen",
              icon: "videocam-outline",
              onPress: () => router.push(`/call-plan-compose?chatId=${id}`),
            },
            {
              label: "Poll",
              icon: "bar-chart-outline",
              onPress: () => router.push(`/poll-compose?chatId=${id}`),
            },
          ]}
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
              className="bg-paper px-6 py-5 mx-8 w-72"
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
      </ChatWorkspace>
    </SafeAreaView>
  );
}

/**
 * Vervang ASCII-emoticons door emoji zodra de gebruiker een spatie of
 * leesteken typt na de emoticon. Alleen aan het einde van het bericht
 * of vóór een spatie — zodat typen van bijv. ":-)" in een URL niet
 * per ongeluk omgezet wordt.
 */

function typingLabel(
  typing: Map<string, { name: string; expiresAt: number }>
): string {
  const names = Array.from(typing.values()).map((t) => t.name);
  if (names.length === 0) return "";
  if (names.length === 1) return `${names[0]} is aan het typen…`;
  if (names.length === 2) return `${names[0]} en ${names[1]} zijn aan het typen…`;
  return `${names[0]} en ${names.length - 1} anderen typen…`;
}

function formatChatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, now)) return "Vandaag";
  if (sameDay(d, yesterday)) return "Gisteren";

  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays < 7) {
    return d.toLocaleDateString("nl-NL", { weekday: "long" });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
  }
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
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
    <ComposerInset style={{ paddingTop: space.md }}>
      {/* Dezelfde vorm als de antwoordbalk — kantlijn, tekst, twee stille
          iconen. Stond eerder op amber en groen: twee kleuren die nergens
          anders in de app voorkomen, op de plek waar het net rustig moest
          zijn. */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: space.md }}>
        <View
          style={{ width: FEED_BORDER * 2, alignSelf: "stretch", backgroundColor: flame }}
        />
        <TextInput
          value={value}
          onChangeText={setValue}
          autoFocus
          multiline
          className="flex-1 text-base"
          style={{
            minHeight: 24,
            maxHeight: 80,
            paddingVertical: 6,
            color: creamOnDark.DEFAULT,
            ...(Platform.OS === "web"
              ? ({ outlineWidth: 0, outlineStyle: "none" } as any)
              : {}),
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bewerking bewaren"
          onPress={() => onConfirm(value)}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 30,
            height: 30,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Ionicons name="checkmark" color={flame} size={20} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bewerking annuleren"
          onPress={onCancel}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 30,
            height: 30,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Ionicons name="close" color={creamOnDark.muted} size={17} />
        </Pressable>
      </View>
    </ComposerInset>
  );
}


/**
 * Wikkelt de bubbel in een gesture-herkenner, of laat hem met rust.
 *
 * `null` betekent hier echt niets mounten in plaats van een herkenner die
 * op niets reageert — dat scheelt een scroll-blokkade, zie de toelichting
 * bij de aanroep.
 */
function SwipeWrap({
  gesture,
  children,
}: {
  gesture: ReturnType<typeof Gesture.Pan> | null;
  children: React.ReactNode;
}) {
  if (!gesture) return <>{children}</>;
  return <GestureDetector gesture={gesture}>{children}</GestureDetector>;
}

function MessageBubble({
  msg,
  isMine,
  isGroup,
  showSenderHeader,
  showAvatar,
  senderName,
  senderAvatarUrl,
  pending,
  failed,
  onRetry,
  reactions,
  onLongPress,
  onToggleReaction,
  showReadReceipt,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onReplyQuotePress,
  onReactionLongPress,
  selected,
  onSelect,
}: {
  msg: DecryptedMessage;
  isMine: boolean;
  isGroup?: boolean;
  showSenderHeader?: boolean;
  showAvatar?: boolean;
  senderName?: string;
  senderAvatarUrl?: string | null;
  pending?: boolean;
  failed?: boolean;
  onRetry?: () => void;
  reactions: GroupedReaction[];
  onLongPress: () => void;
  onToggleReaction: (emoji: string) => void;
  showReadReceipt?: boolean;
  onReply?: () => void;
  onCopy?: () => void;
  /** Alleen bij een eigen bericht mét tekst; zie de aanroep in renderItem. */
  onEdit?: () => void;
  onDelete?: () => void;
  onReplyQuotePress?: (messageId: string) => void;
  onReactionLongPress?: (emoji: string, userIds: string[]) => void;
  selected?: boolean;
  onSelect?: () => void;
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
    <View
      className={isMine ? "items-end" : "items-start"}
      // Een bubbel mag nooit zo breed worden dat de regel niet meer te
      // volgen is. Op een telefoon doet de percentage-maat hieronder het
      // werk; op een breed scherm is 90% van de kolom al gauw 900px, en
      // dan leest één plakregel — of een lange URL — als een liniaal.
      // Zestig tekens is de bovengrens van een leesbare regel; bij
      // 16px-tekst is dat ongeveer deze maat.
      style={{ maxWidth: BUBBLE_MAX_W, alignSelf: isMine ? "flex-end" : "flex-start" }}
    >
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
          <Ionicons name="return-down-back-outline" color={flameDeep} size={18} />
        </Animated.View>
      )}

      {/* Avatar + naam — eenmalig boven de eerste bubble van de run */}
      {showSenderHeader && showAvatarSlot && (
        <View className="flex-row items-center mb-0.5 ml-1 gap-2">
          <Avatar name={senderName} avatarUrl={senderAvatarUrl} size="sm" />
          <Text
            style={[feedType.label, { fontSize: 12, fontWeight: "700", color: feed.ink }]}
            numberOfLines={1}
          >
            {senderName ?? "Onbekend"}
          </Text>
        </View>
      )}

      {/**
        * Web krijgt géén GestureDetector.
        *
        * Hier stond `Gesture.Pan()` als "uit"-stand, maar een kale Pan
        * claimt élke sleep — ook een verticale. Daardoor kon je op web
        * alleen scrollen náást de bubbels: boven een bubbel at de
        * gesture-herkenner de beweging op, ernaast lag niets en deed de
        * lijst gewoon zijn werk. Wat een uitgeschakelde swipe moest zijn
        * was in de praktijk een scroll-blokkade.
        *
        * De juiste "uit" is niet mounten. `SwipeWrap` doet dat: op native
        * de ingestelde gesture (die faalt bij >8px verticaal en dus wél
        * samenleeft met de lijst), op web niets.
        */}
      <SwipeWrap gesture={Platform.OS !== "web" ? panGesture : null}>
      <Animated.View
        className={`flex-row items-center gap-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}
        style={{
          maxWidth: showAvatarSlot ? "82%" : "90%",
          marginLeft: showAvatarSlot ? 44 : 0,
          transform: [{ translateX: Platform.OS !== "web" ? swipeX : 0 }],
        }}
      >
        <View className={isMine ? "items-end flex-1" : "items-start flex-1"}>
      <Pressable
        onLongPress={onLongPress}
        onPress={failed && onRetry ? onRetry : (Platform.OS === "web" ? onSelect : undefined)}
        delayLongPress={300}
        // @ts-ignore — onContextMenu is een web-only prop voor rechtermuisknop
        onContextMenu={Platform.OS === "web" ? (e: any) => { e.preventDefault(); onSelect?.(); } : undefined}
        /**
          * Vol of leeg — meer verschil is er niet, en meer is er ook niet
          * nodig.
          *
          * Beide kanten waren eerst een gevuld vlak: het mijne zwart, dat
          * van de ander een bijna-wit blad. Twee dozen op een pagina die
          * volgens §4 juist géén dozen kent, en in de lichte stand was dat
          * witte blad bovendien nauwelijks van het paginavlak te
          * onderscheiden.
          *
          * Toen kreeg het bericht van de ander één kantlijn links. Dat was
          * de verkeerde vorm: een kantlijn is in deze app precies het
          * teken van een aanhaling — het antwoord-blok hieronder gebruikt
          * hem — dus een gewoon bericht las als een citaat van iets anders.
          *
          * Nu is het een kader zonder vulling. Een gevulde cel is "van
          * mij", een lege cel met een kader is "van iemand anders" —
          * dezelfde tweedeling als bij de reactiepil en de knoppenrij, en
          * dezelfde vorm: allebei een cel, alleen de vulling verschilt.
          */
        style={{
          opacity: pending ? 0.65 : 1,
          ...(isMine || failed
            ? {}
            : { borderWidth: FEED_BORDER, borderColor: feed.ink }),
        }}
        className={`${
          hasAttachment ? "" : content?.reply ? "pt-0 pb-2.5" : "px-4 py-2.5"
        } ${failed ? "bg-flame" : isMine ? "bg-ink" : ""}`}
      >
        {content === null ? (
          msg.pendingRekey ? (
            // Envelope ontbreekt nog — re-keying is bezig op de achtergrond.
            <View className={`flex-row items-center gap-2 px-1 py-0.5`}>
              <ActivityIndicator
                size="small"
                color={isMine ? creamOnDark.DEFAULT : feed.inkDim}
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
            {/*
                Het aangehaalde bericht — aantikken scrolt naar het origineel.

                Dit was een lichter vlak bínnen de bubbel: crème op acht
                procent op de donkere, inkt op vijf op de lichte. Een vlak in
                een vlak, en zo licht dat het eerder als een vlek las dan als
                een citaat (DESIGN.md §4 — hiërarchie komt uit lijn en
                inspringing, niet uit een vlak).

                Nu doen de lijn en de inspringing het werk. De kantlijn
                begint waar de tekst van het bericht begint, het citaat staat
                daar nóg een stap binnen, en een haarlijn eronder scheidt het
                van wat er als antwoord op volgde. Dat is de opbouw van elke
                kaart in deze app: band, lijn, band.

                De kantlijn is hier ook echt op zijn plek. Hij was even de
                vorm van élk inkomend bericht, en dan zegt hij niets meer;
                een gewoon bericht draagt nu een kader (zie hierboven) en de
                kantlijn is weer wat hij hoort te zijn — het teken van een
                aanhaling. Op de donkere eigen bubbel staat het rood in
                `flame`, op het lichte vlak in `flameDeep`: klein rood op
                lavendel haalt anders geen contrast.
            */}
            {content.reply && (
              <Pressable
                onPress={() => onReplyQuotePress?.(content.reply!.messageId)}
                style={{
                  // De kantlijn begint op de tekstmarge van de bubbel, niet
                  // tegen zijn rand: zo staat het citaat ónder het bericht
                  // uitgelijnd in plaats van ernaast.
                  marginLeft: space.lg,
                  marginTop: space.md,
                  marginBottom: space.sm,
                  paddingLeft: space.md,
                  paddingRight: space.md,
                  paddingBottom: space.sm,
                  borderLeftWidth: FEED_BORDER * 2,
                  borderLeftColor: isMine ? flame : flameDeep,
                  borderBottomWidth: FEED_BORDER,
                  borderBottomColor: isMine ? creamOnDark.rule : rule.soft,
                }}
              >
                <Text
                  selectable={false}
                  style={[
                    feedType.kicker,
                    { color: isMine ? flame : flameDeep, letterSpacing: 0.55 },
                  ]}
                  numberOfLines={1}
                >
                  {content.reply.senderName.toUpperCase()}
                </Text>
                <Text
                  selectable={false}
                  style={[
                    feedType.label,
                    { color: isMine ? creamOnDark.muted : feed.inkDim, marginTop: 3 },
                  ]}
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
                style={[
                  feedType.label,
                  { color: isMine ? creamOnDark.muted : feed.inkDim },
                ]}
              >
                {time}{msg.edited_at ? " · bewerkt" : ""}
              </Text>
              {isMine && pending && (
                <Ionicons
                  name="time-outline"
                  size={10}
                  color={isMine ? creamOnDark.muted : feed.inkDim}
                  style={{ marginLeft: 4 }}
                />
              )}
              {isMine && !pending && !failed && (
                <Ionicons
                  name="checkmark-done"
                  size={11}
                  color={isMine ? creamOnDark.muted : feed.inkDim}
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
        {/* Inline actie-iconen — verschijnen bij tik/selectie */}
        {selected && (
          <View
            className={`flex-row items-center gap-0.5 px-1.5 py-1 ${isMine ? "mr-1" : "ml-1"}`}
            style={{ borderWidth: FEED_BORDER, borderColor: rule.soft }}
          >
            {onReply && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Antwoorden op dit bericht"
                onPress={onReply} hitSlop={6} className="w-8 h-8 items-center justify-center">
                <Ionicons name="return-down-back-outline" color={flameDeep} size={16} />
              </Pressable>
            )}
            <Pressable onPress={() => onToggleReaction("❤️")} hitSlop={6} className="w-8 h-8 items-center justify-center">
              <Text style={{ fontSize: 15 }}>❤️</Text>
            </Pressable>
            <Pressable onPress={() => onToggleReaction("👍")} hitSlop={6} className="w-8 h-8 items-center justify-center">
              <Text style={{ fontSize: 15 }}>👍</Text>
            </Pressable>
            {onCopy && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bericht kopiëren"
                onPress={onCopy} className="items-center justify-center"
                style={{ minWidth: 36, height: CONTROL_H }}>
                <Ionicons name="copy-outline" color={feed.inkDim} size={15} />
              </Pressable>
            )}
            {/* De enige ingang naar het bewerken — zie renderItem voor
                waarom die er tot nu toe niet was. Náást verwijderen, want
                de twee horen bij elkaar: het zijn allebei dingen die je
                alleen met je eigen bericht kunt. */}
            {onEdit && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bericht bewerken"
                onPress={onEdit} className="items-center justify-center"
                style={{ minWidth: 36, height: CONTROL_H }}>
                <Ionicons name="pencil-outline" color={feed.inkDim} size={15} />
              </Pressable>
            )}
            {onDelete && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bericht verwijderen"
                onPress={onDelete} className="items-center justify-center"
                style={{ minWidth: 36, height: CONTROL_H }}>
                <Ionicons name="trash-outline" color={flameDeep} size={15} />
              </Pressable>
            )}
          </View>
        )}
      </Animated.View>
      </SwipeWrap>

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
              // Geen vulling: onder een bubbel die zélf al vol of leeg is
              // zou een derde vlak niets meer zeggen. De lijn verzwaart als
              // de reactie van jou is — zelfde tweedeling, ander middel.
              className="flex-row items-center px-2 py-0.5"
              style={{
                borderWidth: FEED_BORDER,
                borderColor: r.mine ? flameDeep : rule.soft,
              }}
            >
              <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
              <Text
                style={[
                  feedType.label,
                  { marginLeft: 4, fontWeight: "700", color: r.mine ? flameDeep : feed.inkDim },
                ]}
              >
                {r.count}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {isMine && showReadReceipt && (
        // Een leesbevestiging is metadata, geen redactioneel accent. Rood
        // trok hier de aandacht naar het minst belangrijke op het scherm.
        <View className="flex-row items-center self-end pr-1 mt-0.5 gap-0.5">
          <Ionicons name="checkmark-done" size={12} color={feed.inkDim} />
          <Text style={[feedType.label, { color: feed.inkDim }]}>Gelezen</Text>
        </View>
      )}
    </View>
  );
}

/**
 * De leesbreedte van een bericht.
 *
 * De bubbel neemt van oudsher een percentage van de kolom; dat klopt op
 * een telefoon, maar op een breed scherm wordt een regel dan honderden
 * pixels lang en verlies je bij het teruglopen de volgende regel. Deze
 * harde bovengrens komt overeen met ~60 tekens op 16px — de maat die de
 * feed ook aanhoudt voor lopende tekst.
 */
const BUBBLE_MAX_W = 560;

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
 * Wie iets zei, zonder een tweede palet.
 *
 * Hier stonden zestien vaste hexwaarden: acht namkleuren (terracotta,
 * stofblauw, sauge groen…) en acht pastelvullingen voor de bubbel
 * erachter. Een compleet schaduwpalet naast dat van de app, en het
 * schoof niet mee met de twee standen — de pastels waren gekozen voor
 * "een lichte achtergrond", dus in de donkere stand lagen er acht
 * verschillende lichte vlakken op het lavendel.
 *
 * Wie iets zegt lees je aan de avatar en de naam erboven, en aan welke
 * kant het bericht staat. Dat is wat een gespreksverslag ook doet, en het
 * kost geen kleur die het systeem niet heeft (DESIGN.md §2 en §7).
 */

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
    /**
     * "Er is een gesprek begonnen" — een melding met één uitgang.
     *
     * Dit was een gevuld paneel met een lichtblauw vierkantje ervoor en een
     * felblauwe knop erin. Blauw is hier het merk en verder niets (§2), en
     * een vierkantje om een icoon is een kader zonder werk (§4).
     *
     * Nu: een kader met een rubriek, en de deelname-knop als het énige
     * gevulde vlak — in de oranje die dit systeem voor de primaire actie
     * heeft. Er is er hoogstens één per scherm, en dít is hem.
     */
    <View className="items-center" style={{ marginVertical: space.md }}>
      <View
        className="flex-row"
        style={{
          maxWidth: 380,
          width: "100%",
          borderWidth: FEED_BORDER,
          borderColor: feed.ink,
        }}
      >
        {/*
            De melding en de knop zijn twee cellen van hetzelfde kader,
            gescheiden door één lijn.

            De knop lag er eerder als een gekleurde sticker in: een vast
            hoge oranje rechthoek met lucht eromheen, die nergens op stond
            en het kader van binnenuit aanraakte. Als cel loopt hij van lijn
            tot lijn en heeft hij geen eigen rand nodig — dezelfde opbouw als
            de knoppenrij onder een vondst.
        */}
        <View
          style={{
            flex: 1,
            minWidth: 0,
            justifyContent: "center",
            paddingHorizontal: space.md,
            paddingVertical: space.md,
          }}
        >
          {/* Het icoon staat op de regel van de rubriek, niet ernaast: het
              hóórt bij dat woord en niet bij het blok eronder. */}
          <View className="flex-row items-center" style={{ gap: 5, marginBottom: 3 }}>
            <Ionicons name="videocam" color={flameDeep} size={12} />
            <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>
              VIDEOGESPREK
            </Text>
          </View>
          <Text
            style={[feedType.label, { fontSize: 13, color: feed.ink }]}
            numberOfLines={2}
          >
            {isMine ? "Je startte een videogesprek" : `${senderName} startte een gesprek`}
            <Text style={{ color: feed.inkDim }}>{`   ·   ${time}`}</Text>
          </Text>
        </View>
        <Pressable
          onPress={onJoin}
          className="bg-announce active:bg-announce-deep"
          style={{
            justifyContent: "center",
            paddingHorizontal: space.lg,
            borderLeftWidth: FEED_BORDER,
            borderLeftColor: feed.ink,
          }}
        >
          <Text
            style={[
              feedType.label,
              { fontSize: 12, fontWeight: "700", color: creamOnDark.DEFAULT },
            ]}
          >
            Deelnemen
          </Text>
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
        className="overflow-hidden"
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
              <ActivityIndicator color={feed.inkDim} />
            ) : (
              <Ionicons name="image-outline" color={feed.inkDim} size={32} />
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
              accessibilityRole="button"
              accessibilityLabel="Foto sluiten"
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
              <Ionicons name="close" color={creamOnDark.DEFAULT} size={20} />
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

/** Formatteert milliseconden als m:ss */
function fmtMs(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Inline voice message player: play/pause knop + voortgangsbalk + tijd.
 * Gebruikt expo-av Audio.Sound voor native én web.
 */
function VoiceMessageBubble({
  uri,
  loading,
  isMine,
}: {
  uri: string | null;
  loading: boolean;
  isMine: boolean;
}) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Ruim het sound object op bij unmount
  useEffect(() => {
    return () => {
      sound?.unloadAsync().catch(() => {});
    };
  }, [sound]);

  async function togglePlay() {
    if (!uri) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
      if (!sound) {
        const { sound: s } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          (status) => {
            if (!status.isLoaded) return;
            setIsPlaying(status.isPlaying);
            setPosition(status.positionMillis ?? 0);
            if (status.durationMillis) setDuration(status.durationMillis);
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPosition(0);
            }
          }
        );
        setSound(s);
      } else {
        const status = await sound.getStatusAsync();
        if (!status.isLoaded) return;
        if (status.isPlaying) {
          await sound.pauseAsync();
        } else {
          // Herstart als klaar
          if (status.didJustFinish || status.positionMillis >= (status.durationMillis ?? 1) - 50) {
            await sound.setPositionAsync(0);
          }
          await sound.playAsync();
        }
      }
    } catch (e: any) {
      console.warn("VoiceMessageBubble togglePlay", e?.message ?? e);
    }
  }

  const progress = duration > 0 ? position / duration : 0;

  return (
    <View
      className={`flex-row items-center gap-3 px-3 py-3 m-1 ${
        isMine ? "bg-ink/20" : "bg-paper-warm/60"
      }`}
      style={{ minWidth: 200, maxWidth: 260 }}
    >
      {/* Play / pause */}
      <Pressable
        hitSlop={4}
        onPress={togglePlay}
        className={`w-10 h-10 items-center justify-center ${
          isMine ? "bg-cream/20" : "bg-paper-light"
        }`}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isMine ? creamOnDark.DEFAULT : feed.ink} />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            color={isMine ? creamOnDark.DEFAULT : feed.ink}
            size={18}
          />
        )}
      </Pressable>

      {/* Progress + timer */}
      <View className="flex-1 gap-1">
        {/* Track */}
        <View
          className={`h-1.5 ${isMine ? "bg-cream/20" : "bg-paper-warm"}`}
        >
          <View
            className={`h-1.5 ${isMine ? "bg-cream" : "bg-ink-soft"}`}
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </View>
        <Text className={`text-[10px] ${isMine ? "text-cream-muted" : "text-ink-muted"}`}>
          {duration > 0
            ? `${fmtMs(position)} / ${fmtMs(duration)}`
            : loading ? "…" : fmtMs(0)}
        </Text>
      </View>
    </View>
  );
}

/**
 * Inline video player: toont een thumbnail-achtige preview met play-knop.
 * Tap opent een fullscreen modal met expo-av Video (native + web).
 */
function VideoWithPlayer({ uri, loading }: { uri: string | null; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();

  return (
    <>
      {/* Thumbnail preview */}
      <Pressable
        onPress={() => uri && setOpen(true)}
        className="overflow-hidden"
        style={{ opacity: loading ? 0.6 : 1 }}
      >
        <View
          style={{ width: 240, height: 240 }}
          className="bg-paper-warm items-center justify-center"
        >
          {loading ? (
            <ActivityIndicator color={feed.inkDim} />
          ) : uri ? (
            <>
              {/* Probeer een stills-preview te tonen als poster */}
              <Video
                source={{ uri }}
                style={{ width: 240, height: 240, position: "absolute" }}
                resizeMode={ResizeMode.COVER}
                isMuted
                shouldPlay={false}
                useNativeControls={false}
                isLooping={false}
              />
              <View
                style={{
                  position: "absolute",
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "rgba(0,0,0,0.55)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="play" color="#fff" size={26} />
              </View>
            </>
          ) : (
            <Ionicons name="videocam-outline" color={feed.inkDim} size={32} />
          )}
        </View>
      </Pressable>

      {/* Fullscreen player modal */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {/* Sluit-knop */}
          <SafeAreaView
            style={{ position: "absolute", top: 0, right: 0, zIndex: 10, padding: 12 }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Video sluiten"
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
              <Ionicons name="close" color={creamOnDark.DEFAULT} size={20} />
            </Pressable>
          </SafeAreaView>

          {/* Video player */}
          {uri ? (
            <Video
              source={{ uri }}
              style={{ width: screenW, height: screenH }}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              shouldPlay
              isLooping={false}
            />
          ) : null}
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
    return <VideoWithPlayer uri={uri} loading={loading} />;
  }

  if (attachment.type === "audio") {
    return <VoiceMessageBubble uri={uri} loading={loading} isMine={isMine} />;
  }

  // Generic file
  return (
    <View
      className={`flex-row items-center px-3 py-3 ${
        isMine ? "bg-ink/20" : "bg-paper-warm/60"
      } m-1`}
    >
      <View
        className={`w-10 h-10 items-center justify-center ${
          isMine ? "bg-cream/20" : "bg-paper-light"
        }`}
      >
        <Ionicons
          name="document-outline"
          color={isMine ? creamOnDark.DEFAULT : feed.ink}
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
          hitSlop={8}
          onPress={() => Linking.openURL(uri!).catch(() => {})}
          className="ml-2 p-2"
        >
          <Ionicons
            name="download-outline"
            color={isMine ? creamOnDark.DEFAULT : feed.ink}
            size={18}
          />
        </Pressable>
      )}
    </View>
  );
}

// ─── Inline chat kaarten voor call-plan en poll berichten ────────────────────

function ChatCallPlanCard({
  callPlanId,
  senderName,
  isMine,
}: {
  callPlanId: string;
  senderName: string;
  isMine: boolean;
}) {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const [saving, setSaving] = useState<string | null>(null);

  const { data: plan, refetch } = useQuery({
    queryKey: ["call-plan", callPlanId],
    queryFn: () => getCallPlanWithDetails(callPlanId),
  });

  if (!plan) {
    return (
      <View
        className={`mx-3 mb-1 ${isMine ? "self-end" : "self-start"}`}
        style={{
          width: "85%",
          maxWidth: BUBBLE_MAX_W,
          paddingHorizontal: space.md,
          paddingVertical: space.md,
          borderWidth: FEED_BORDER,
          borderColor: rule.soft,
        }}
      >
        <ActivityIndicator size="small" color={feed.inkDim} />
      </View>
    );
  }

  const bestSlot = [...plan.slots].sort((a, b) => b.yes_voters.length - a.yes_voters.length)[0];

  async function toggleSlot(slotId: string, currentlyYes: boolean) {
    setSaving(slotId);
    try {
      await voteCallPlanSlot({ slotId, userId: myUserId, available: !currentlyYes });
      refetch();
    } finally {
      setSaving(null);
    }
  }

  return (
    /**
     * Een belafspraak als opgemaakt blok, niet als widget.
     *
     * Hier stond een gevuld paneel met daarin gevulde vakjes: het gekozen
     * tijdslot in lichtblauw met blauwe tekst, de tellers in teal, en een
     * "Agenda"-knop in nóg een groen. Vier kleuren en drie vullingen in een
     * kaart van tien regels, en geen van die kleuren staat in het palet —
     * blauw is hier het merk en verder niets (DESIGN.md §2).
     *
     * Nu draagt de vorm het: één kader, een rubriek met een lijn eronder,
     * en de tijdsloten als rijen tussen haarlijnen. Wat jíj hebt aangevinkt
     * is gevuld in plaats van gekleurd — vol of leeg is het enige verschil
     * dat je uit een ooghoek nog leest, dezelfde regel als bij de
     * reactiepillen.
     */
    <View
      className={`mx-3 mb-1 ${isMine ? "self-end" : "self-start"}`}
      style={{
        width: "90%",
        maxWidth: BUBBLE_MAX_W,
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
      }}
    >
      <View style={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm }}>
        <View className="flex-row items-center" style={{ gap: 6, marginBottom: 6 }}>
          <Ionicons name="videocam-outline" color={flameDeep} size={13} />
          <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>
            BELAFSPRAAK
          </Text>
        </View>
        <Text
          style={[feedType.tile, { color: feed.ink }]}
          numberOfLines={2}
        >
          {plan.title}
        </Text>
        {plan.description ? (
          <Text
            style={[feedType.body, { color: feed.inkDim, marginTop: 2 }]}
            numberOfLines={2}
          >
            {plan.description}
          </Text>
        ) : null}
      </View>

      {/* De sloten: rijen tussen lijnen. De bovenste lijn is zwaarder —
          die scheidt de kop van de keuze, de lijnen daarbinnen scheiden
          alleen de rijen onderling (DESIGN.md §4). */}
      <View style={{ borderTopWidth: FEED_BORDER, borderTopColor: feed.ink }}>
        {plan.slots.slice(0, 4).map((slot, i) => {
          const myVote = slot.yes_voters.includes(myUserId);
          const isBest = slot.id === bestSlot?.id && bestSlot.yes_voters.length > 0;
          const isSaving = saving === slot.id;
          const onDark = myVote ? creamOnDark.DEFAULT : feed.ink;
          const onDarkDim = myVote ? creamOnDark.muted : feed.inkDim;
          return (
            <Pressable
              key={slot.id}
              onPress={() => toggleSlot(slot.id, myVote)}
              disabled={!!isSaving}
              className="flex-row items-center"
              style={{
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                backgroundColor: myVote ? feed.ink : "transparent",
                opacity: isSaving ? 0.5 : 1,
                ...(i === 0
                  ? {}
                  : { borderTopWidth: FEED_BORDER, borderTopColor: rule.soft }),
              }}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[feedType.label, { fontSize: 13, fontWeight: "700", color: onDark }]}>
                  {new Date(slot.starts_at).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" })}
                </Text>
                <Text style={[feedType.label, { color: onDarkDim, marginTop: 1 }]}>
                  {new Date(slot.starts_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })} – {new Date(slot.ends_at).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
              {/* Wie kan, en of dit de winnaar is. Het cijfer is de
                  hoofdzaak, "beste" het bijschrift eronder. */}
              <View className="items-end" style={{ marginLeft: space.sm }}>
                <Text style={[feedType.label, { fontSize: 13, fontWeight: "700", color: onDark }]}>
                  {`${slot.yes_voters.length} ✓`}
                </Text>
                {isBest ? (
                  <Text
                    style={[
                      feedType.kicker,
                      { color: myVote ? creamOnDark.soft : flameDeep, marginTop: 1 },
                    ]}
                  >
                    BESTE
                  </Text>
                ) : null}
              </View>
            </Pressable>
          );
        })}
        {plan.slots.length > 4 && (
          <Text
            style={[
              feedType.label,
              {
                color: feed.inkDim,
                textAlign: "center",
                paddingVertical: space.sm,
                borderTopWidth: FEED_BORDER,
                borderTopColor: rule.soft,
              },
            ]}
          >
            {`+${plan.slots.length - 4} meer opties`}
          </Text>
        )}
      </View>

      {/* De voet: wat je hier kunt doen, en de ene uitgang. Een regel en
          geen kader — dezelfde vorm als "Openen ↗" onder een bron. */}
      <View
        className="flex-row items-center justify-between"
        style={{
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          gap: space.sm,
          borderTopWidth: FEED_BORDER,
          borderTopColor: feed.ink,
        }}
      >
        <Text style={[feedType.label, { color: feed.inkDim, flex: 1 }]} numberOfLines={1}>
          Tik om beschikbaarheid aan te geven
        </Text>
        {bestSlot && bestSlot.yes_voters.length > 0 && (
          <Pressable
            onPress={() => {
              const { downloadCalendarEvent } = require("@/lib/calendar");
              downloadCalendarEvent({
                title: plan.title,
                description: plan.description ?? undefined,
                startsAt: new Date(bestSlot.starts_at),
                endsAt: new Date(bestSlot.ends_at),
              });
            }}
            hitSlop={8}
          >
            <Text style={[feedType.label, { color: flameDeep, fontWeight: "700" }]}>
              In agenda ↗
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ChatPollCard({
  pollId,
  senderName,
  isMine,
}: {
  pollId: string;
  senderName: string;
  isMine: boolean;
}) {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const [voting, setVoting] = useState(false);

  const { data: poll, refetch } = useQuery({
    queryKey: ["poll", pollId],
    queryFn: () => getPollWithDetails(pollId, myUserId),
  });

  if (!poll) {
    return (
      <View
        className={`mx-3 mb-1 ${isMine ? "self-end" : "self-start"}`}
        style={{
          width: "85%",
          maxWidth: BUBBLE_MAX_W,
          paddingHorizontal: space.md,
          paddingVertical: space.md,
          borderWidth: FEED_BORDER,
          borderColor: rule.soft,
        }}
      >
        <ActivityIndicator size="small" color={feed.inkDim} />
      </View>
    );
  }

  const showResults = !!poll.my_vote_option_id || (poll.ends_at ? new Date(poll.ends_at) < new Date() : false);

  async function handleVote(optionId: string) {
    if (voting || showResults) return;
    setVoting(true);
    try {
      await votePoll({ optionId, userId: myUserId, pollId: poll!.id });
      refetch();
    } finally {
      setVoting(false);
    }
  }

  return (
    /**
     * Dezelfde opbouw als de belafspraak hiernaast: één kader, een rubriek
     * met een lijn eronder, en de opties als rijen tussen haarlijnen.
     *
     * De uitslagbalk was een gestapeld vlakje op vier losse hexwaarden
     * (`#D4622012`, `#1A160E08`) die in de lichte stand niet meeschoven.
     * Het is nu de flame-kleur op lage dekking uit hetzelfde palet, en de
     * optie waar jij op stemde is gevuld in plaats van gekleurd.
     */
    <View
      className={`mx-3 mb-1 ${isMine ? "self-end" : "self-start"}`}
      style={{
        width: "90%",
        maxWidth: BUBBLE_MAX_W,
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
      }}
    >
      <View style={{ paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm }}>
        <View className="flex-row items-center" style={{ gap: 6, marginBottom: 6 }}>
          <Ionicons name="bar-chart-outline" color={flameDeep} size={13} />
          <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>
            PEILING
          </Text>
        </View>
        <Text style={[feedType.tile, { color: feed.ink }]} numberOfLines={3}>
          {poll.question}
        </Text>
      </View>

      <View style={{ borderTopWidth: FEED_BORDER, borderTopColor: feed.ink }}>
        {poll.options.map((option, i) => {
          const pct = poll.total_votes > 0 ? Math.round((option.vote_count / poll.total_votes) * 100) : 0;
          const isMyVote = poll.my_vote_option_id === option.id;
          const divider = i === 0 ? {} : { borderTopWidth: FEED_BORDER, borderTopColor: rule.soft };

          if (showResults) {
            return (
              <View
                key={option.id}
                className="flex-row items-center"
                style={{
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm,
                  overflow: "hidden",
                  ...divider,
                }}
              >
                {/* De balk is de uitslag zelf, geen versiering: hij loopt
                    tot waar het percentage staat en verder niet. */}
                <View
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${pct}%`,
                    /**
                     * Het lichtste gewicht dat het palet kent (`postRule`,
                     * inkt op ~20%). Zwaarder en de tekst erop verliest
                     * zijn contrast; dat gebeurde met de losse hexwaarden
                     * die hier stonden, in de lichte stand.
                     */
                    backgroundColor: isMyVote
                      ? color("flame", "postRule")
                      : color("ink", "postRule"),
                  }}
                />
                <Text
                  style={[
                    feedType.label,
                    { fontSize: 13, flex: 1, color: feed.ink, fontWeight: isMyVote ? "700" : "600" },
                  ]}
                  numberOfLines={2}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    feedType.label,
                    { fontSize: 13, fontWeight: "700", color: isMyVote ? flameDeep : feed.inkDim, marginLeft: space.sm },
                  ]}
                >
                  {`${pct}%`}
                </Text>
              </View>
            );
          }

          return (
            <Pressable
              key={option.id}
              onPress={() => handleVote(option.id)}
              style={({ pressed }) => ({
                paddingHorizontal: space.md,
                paddingVertical: space.sm,
                backgroundColor: pressed ? feed.ink : "transparent",
                ...divider,
              })}
            >
              {({ pressed }) => (
                <Text
                  style={[
                    feedType.label,
                    { fontSize: 13, color: pressed ? creamOnDark.DEFAULT : feed.ink },
                  ]}
                >
                  {option.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text
        style={[
          feedType.label,
          {
            color: feed.inkDim,
            paddingHorizontal: space.md,
            paddingVertical: space.sm,
            borderTopWidth: FEED_BORDER,
            borderTopColor: feed.ink,
          },
        ]}
      >
        {`${poll.total_votes} ${poll.total_votes === 1 ? "stem" : "stemmen"}`}
      </Text>
    </View>
  );
}
