import Ionicons from "@expo/vector-icons/Ionicons";
import { emojiSuggestionsFor, replaceEmoticons } from "@/lib/emoji";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
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
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { LincinScreen } from "@/components/lincin/Chrome";
import { BORDER, GUTTER, Head, Serif, line } from "@/components/lincin/ui";
import { Avatar } from "@/components/Avatar";
import { VideoCallModal } from "@/components/VideoCallModal";
import { MentionsText } from "@/components/MentionsText";
import { ChatWorkspace } from "@/components/ChatWorkspace";

import { QueryError } from "@/components/QueryError";
import { plural } from "@/lib/plural";
import { Skeleton } from "@/components/Skeleton";
import { useAuth } from "@/lib/auth/provider";
import { DesktopChats } from "@/components/lincin/desktop/DesktopChats";
import { useIsDesktop } from "@/lib/lincin/desktop";
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
  type PostRef,
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
import { openJitsiCall } from "@/lib/jitsi";
import { getCallPlanWithDetails, voteCallPlanSlot } from "@/lib/api/call-plans";
import { getPollWithDetails, votePoll } from "@/lib/api/polls";
import { CONTROL_H, creamOnDark, feed, FEED_BORDER, feedType, flame, flameDeep, lincinType, rule, sans, serif, space } from "@/lib/design/type";
import { ON_DARK, color, friendColor, hueFor, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { useT } from "@/lib/i18n";
import {
  rememberChatPreview,
  shortenForPreview,
} from "@/lib/chat-preview";
import { usePageTitle } from "@/lib/page-title";
import { useReactionWho } from "@/lib/lincin/reactors";
import { NL } from "@/lib/locale";
import { useImageRatio } from "@/lib/lincin/ratio";

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
          // Dezelfde kantlijn als de kop en de bladzijden (prototype
          // THREAD: `padding: 8px 18px 10px`); 12 stond hier los van de rest.
          paddingHorizontal: GUTTER,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Op desktop (model 3e) is een gesprek Gesprekken op volle breedte, met
 * dit gesprek open (`DesktopChats`); die tekent de draad hieronder
 * `embedded`. Op een telefoon het scherm zelf, onveranderd.
 */
export default function ChatRoute(props: { id?: string; embedded?: boolean } = {}) {
  const params = useLocalSearchParams<{ id: string }>();
  const desktop = useIsDesktop();
  if (desktop && !props.embedded) return <DesktopChats chatId={props.id ?? params.id} />;
  return <ChatDetail {...props} />;
}

export function ChatDetail({ id: idProp, embedded = false }: { id?: string; embedded?: boolean } = {}) {
  const params = useLocalSearchParams<{ id: string }>();
  // Ingebed (desktop) komt het id als prop; als scherm uit de route.
  const id = idProp ?? params.id;
  // De chat scrollt in een eigen omgekeerde lijst, dus de kop klapt hier
  // nooit open of dicht; `compact` houdt hem vast in de balkstand. De
  // Animated.Value is er alleen omdat AppChrome hem in zijn signatuur heeft.
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
  /** Het hoeveelste bestand van hoeveel, tijdens een reeks. */
  const [batchProgress, setBatchProgress] = useState<
    { done: number; total: number } | null
  >(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0); // seconds
  // Loslaten vuurt ook als er nooit een opname begon (geweigerde
  // microfoon); de ref houdt bij of er echt iets te stoppen valt.
  const recordingRef = useRef(false);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<FlatList<DecryptedMessage>>(null);
  const typingSendRef = useRef<((name: string) => void) | null>(null);
  // Zorg dat per sessie maar één call-notificatie verstuurd wordt.
  const callSentRef = useRef(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  /** Hoogte van de tekst in de invoer (magazine): groeit mee tot vijf regels. */
  const [inputH, setInputH] = useState(22);
  // Op web meldt het veld alleen groei, nooit krimp: leeg (ook na
  // verzenden) is weer één regel.
  useEffect(() => {
    if (!draft) setInputH(22);
  }, [draft]);
  /**
   * Waar het nieuwe begint, vastgelegd bij het openen.
   *
   * Het gesprek wordt meteen als gelezen gemarkeerd, dus zonder dit zag je
   * niet meer welke berichten nieuw wáren. Het aantal komt uit de
   * chatlijst (die vóór het gelezen-merk geladen wordt); de scheidslijn
   * staat boven het oudste van die berichten en blijft staan zolang je in
   * het gesprek bent — wat er daarna binnenkomt lees je live.
   */
  const [unreadMark, setUnreadMark] = useState<{ id: string; count: number } | null>(null);
  const [unreadPillSeen, setUnreadPillSeen] = useState(false);
  /** Ongelezen in ándere gesprekken — de teller vooraan in de kop, zoals Telegram. */
  const allChats = useQuery({
    queryKey: ["chats", myUserId],
    queryFn: () => listMyChats(myUserId!),
    enabled: !!myUserId,
  });
  const otherUnread = (allChats.data ?? []).reduce(
    (n, c) => (c.id === id ? n : n + (c.unread_count ?? 0)),
    0
  );

  const myProfile = useQuery({
    queryKey: ["profile", myUserId],
    queryFn: () => getProfile(myUserId!),
    enabled: !!myUserId,
  });
  const myName =
    myProfile.data?.display_name ?? myProfile.data?.username ?? "Iemand";

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
        const unreadCount = c?.unread_count ?? 0;
        if (unreadCount > 0) {
          let left = unreadCount;
          let firstId: string | null = null;
          for (let i = msgs.length - 1; i >= 0 && left > 0; i--) {
            if (msgs[i].sender_id !== myUserId) {
              firstId = msgs[i].id;
              left--;
            }
          }
          setUnreadMark(firstId ? { id: firstId, count: unreadCount } : null);
        } else {
          setUnreadMark(null);
        }

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

  /**
   * De laatste regel onthouden, zodat de chatlijst iets te zeggen heeft.
   *
   * Daar stond op élke rij "Direct · E2E" — een typeaanduiding, en juist die
   * regel is waarop je een lijst afzoekt. De server kan hem niet leveren
   * (die ziet ciphertext, en dat hoort zo), maar dit scherm heeft de tekst
   * al ontsleuteld staan. Zie lib/chat-preview.ts voor wat er wél en niet
   * bewaard wordt.
   */
  useEffect(() => {
    if (!id || !messages || messages.length === 0) return;
    const last = messages[messages.length - 1];
    const text = last.content?.text?.trim();
    const attachment = last.content?.attachment;
    // Een bericht dat niet ontsleutelde levert geen regel op: dan liever
    // het aantal dan een leeg streepje.
    const line = text
      ? shortenForPreview(text)
      : attachment
        ? attachment.type === "video"
          ? "Clip"
          : attachment.type === "audio"
            ? "Spraakbericht"
            : "Foto"
        : null;
    if (!line) return;
    const fromMe = last.sender_id === myUserId;
    void rememberChatPreview(id, {
      text: line,
      fromMe,
      sender: fromMe
        ? null
        : (() => {
            const m = chat?.members.find((x) => x.id === last.sender_id);
            return m?.display_name ?? m?.username ?? null;
          })(),
      at: last.created_at,
    });
  }, [id, messages, myUserId, chat]);

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
  /** Tot waar alles van mij gelezen is: ✓✓ op alles tot en met dat bericht. */
  const readThroughAt = useMemo(
    () => (readReceiptMessageId ? messages?.find((m) => m.id === readReceiptMessageId)?.created_at ?? null : null),
    [messages, readReceiptMessageId]
  );

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

  /**
   * Eén bijlage versturen. Geeft terug óf het gelukt is.
   *
   * `silent` voor wie in een reeks zit: de toastwachtrij is één diep, dus
   * bij tien foto's verving elke mislukking de vorige melding en bleef er
   * uiteindelijk één regel over die over één bestand ging. De lus vertelt
   * het verhaal nu zelf, één keer, over alle tien.
   */
  async function onSendAttachment(args: {
    uri: string;
    mimeType: string;
    filename?: string;
    caption?: string;
    silent?: boolean;
  }): Promise<boolean> {
    if (!myUserId || !id) return false;
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
      return true;
    } catch (e: any) {
      // Was een `Alert.alert`: een OS-venster dat het gesprek blokkeert
      // voor iets waar je niets over hoeft te beslissen. De strook zegt
      // hetzelfde en laat je doortypen.
      if (!args.silent) {
        toast.error(e?.message ?? "De bijlage kon niet verstuurd worden.");
      } else {
        console.warn("attachment", e?.message ?? e);
      }
      return false;
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
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = true;
      setRecording(true);
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
    if (!recordingRef.current) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    recordingRef.current = false;
    setRecording(false);
    setRecordingDuration(0);
    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (!send) return;
      const uri = recorder.uri;
      if (!uri) return;
      // HIGH_QUALITY schrijft op iOS én Android AAC in een .m4a. De browser
      // kiest zelf: Chrome webm, Safari mp4 — dus daar vragen we het de
      // blob, anders krijgt een Safari-opname het verkeerde etiket.
      let mimeType = "audio/m4a";
      let ext = "m4a";
      if (Platform.OS === "web") {
        const blobType = (await (await fetch(uri)).blob()).type;
        mimeType = blobType.startsWith("audio/") ? blobType.split(";")[0] : "audio/webm";
        ext = mimeType === "audio/mp4" ? "m4a" : mimeType.slice("audio/".length);
      }
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

  const t2 = useT();
  const schemeNow = useScheme();
  const spec = useThemeSpec();
  /** De kleur van de ander (groepen zijn groen), voor de kopcel en het blad. */
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const partner =
    chat?.type === "group"
      ? friendColor("green", schemeNow)
      : friendColor(hueFor(chat?.members.find((m) => m.id !== myUserId)?.id), schemeNow);
  const partnerFill = chat ? partner.fill : null;
  /** Bijdragen waar dit gesprek over ging — de strook "VERMELD". */
  const mentioned = useMemo(() => {
    const seen = new Map<string, PostRef>();
    for (const m of messages ?? []) {
      const r = m.content?.postRef;
      if (r && !seen.has(r.id)) seen.set(r.id, r);
    }
    return Array.from(seen.values());
  }, [messages]);
  /** De knoppen in de balk onderaan: 44 in het vierkant, met kader. */
  // Eén doorlopende rij van 44 (prototype §05): de knoppen links zonder
  // rechterrand, zodat ze aan het invoerveld vastzitten en er geen dubbele
  // kaders ontstaan.
  /**
   * Modern kent geen vakjes: de invoer is één pil op papier, de knoppen
   * erin rond (desktop-modern-pages, "Schrijf aan …"). Kleur en magazine
   * houden de gekaderde vakken naast elkaar.
   */
  const pill = spec.id === "modern";
  /**
   * Magazine (de omslag): de vakjes met een haarlijn in plaats van inkt, het
   * veld alleen een lijn eronder met "Schrijf aan …" in cursief, en
   * verzenden als rood vlak.
   */
  const magBar = spec.id === "magazine";
  const aux = pill
    ? ({ ...AUX_BUTTON, borderRadius: 999 } as const)
    : ({ ...AUX_BUTTON, borderWidth: BORDER, borderRightWidth: 0, borderColor: magBar ? color("ink", "postRule") : line() } as const);
  /** De laatste knop sluit de rij af met een rand — behalve in de pil. */
  const auxEnd = pill ? aux : { ...aux, borderRightWidth: BORDER };

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
    <LincinScreen tab="chats" counter={t2.scrThread} tint={partnerFill} full embedded={embedded} back="/(app)/chats">
      {/* De navigatie van de app staat óók boven een gesprek. Zonder deze
          balk was de chat een doodlopende straat: op desktop verbergt de
          gesprekkenlijst links de terug-knop, en dan was er geen enkele
          weg terug naar de feed, events of je profiel. Zie DESIGN.md §5 —
          elk scherm draagt dezelfde kop.

          De kop draagt zijn eigen `chromeTag`, en alleen als hij de focus
          heeft. Hier stond er nóg een omheen: twee elementen met dezelfde
          naam tegelijk, waarop de browser de overgang afbreekt met
          "Unexpected duplicate view-transition-name". Zie AppChrome. */}

      {/* Op desktop drie kolommen: gesprekken links, dit gesprek in het
          midden, opties rechts. Onder 900px levert ChatWorkspace gewoon
          de middenkolom terug en verandert er niets aan dit scherm. */}
      <ChatWorkspace chatId={String(id)} myUserId={myUserId ?? ""} media={sharedMedia} compact={embedded}>
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
        {/* De kop van v2 (README §05): één kader van 48 — de naam in serif,
            en rechts een cel in de kleur van de ander met zijn initiaal.
            Bellen zit als smalle cel ertussen; de kleurcel opent de
            groepsinfo of het profiel.

            De cel `← Terug` stond hier tot 2.1 vooraan. Sinds 2.2 zit de
            terugknop in de kopregel (2.2 §5) en is deze rij alleen nog van
            de naam en de twee knoppen. Het aantal ongelezen berichten in
            ándere gesprekken stond op die cel; dat draagt nu de rode stip
            achter "Gesprekken" in de navigatie. */}
        <View
          style={{
            marginTop: 8,
            marginHorizontal: 18,
            height: 48,
            flexDirection: "row",
            borderWidth: BORDER,
            borderColor: line(),
            backgroundColor: color("paper"),
            // In het desktoppaneel draagt het paneel zelf naam en profiel.
            display: embedded ? "none" : "flex",
          }}
        >
          {otherUnread > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${otherUnread} ${t2.newMsgs}`}
              onPress={() => router.push("/chats")}
              style={{ paddingHorizontal: 10, alignItems: "center", justifyContent: "center", backgroundColor: color("red"), borderRightWidth: BORDER, borderRightColor: line() }}
            >
              <Text style={[sans(800), { fontSize: 14, lineHeight: 17, color: creamOnDark.DEFAULT }]}>
                {otherUnread > 99 ? "99+" : otherUnread}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={onPressHeaderTitle}
            hitSlop={4}
            style={{ flex: 1, minWidth: 0, justifyContent: "center", paddingHorizontal: 12 }}
          >
            <Serif variant="name" numberOfLines={1}>
              {title}
            </Serif>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Videogesprek starten"
            onPress={async () => {
              if (!id) return;
              if (typeof window !== "undefined" && window.document) {
                setCallOpen(true);
              } else {
                openJitsiCall(id).catch(() => {});
              }
              if (!callSentRef.current && myUserId) {
                callSentRef.current = true;
                try {
                  await sendMessage({ chatId: id, senderId: myUserId, call: { started: true } });
                } catch (e: any) {
                  console.warn("sendCallMessage", e?.message ?? e);
                }
              }
            }}
            style={{ width: 44, alignItems: "center", justifyContent: "center", borderLeftWidth: BORDER, borderLeftColor: line() }}
          >
            <Ionicons name="videocam-outline" color={color("ink")} size={18} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={chat?.type === "group" ? "Groepsinfo openen" : "Profiel"}
            onPress={() => (chat?.type === "group" ? router.push(`/group/${id}`) : onPressHeaderTitle())}
            style={{
              width: 48,
              backgroundColor: partner.fill,
              alignItems: "center",
              justifyContent: "center",
              borderLeftWidth: BORDER,
              borderLeftColor: line(),
            }}
          >
            <Head variant="numeralTiny" color={partner.ink} style={{ fontSize: 22, lineHeight: 24 }}>
              {(title || "?").slice(0, 1).toUpperCase()}
            </Head>
          </Pressable>
        </View>

        {mentioned.length > 0 && embedded ? (
          // Desktop (Lincin Desktop.dc.html, GESPREKKEN): de strook ligt
          // horizontaal met "VERMELD" ervoor en kaartjes van 130×52.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0, marginTop: 14, marginHorizontal: 24, borderWidth: BORDER, borderColor: line(), backgroundColor: color("paper2") }}
            contentContainerStyle={{ paddingVertical: 8, paddingHorizontal: 12, alignItems: "center", gap: 12 }}
          >
            <Text style={[lincinType.tiny, { letterSpacing: 0.9, color: color("ink", "inkDim") }]}>{t2.mentioned}</Text>
            {mentioned.map((ref) => (
              <Pressable
                key={ref.id}
                accessibilityRole="button"
                accessibilityLabel={ref.title}
                onPress={() => router.push(`/post/${ref.id}` as never)}
                style={{
                  width: 130,
                  height: 52,
                  backgroundColor: partner.fill,
                  borderWidth: 1,
                  borderColor: line(),
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  justifyContent: "space-between",
                }}
              >
                <Text style={[lincinType.tiny, { color: partner.ink, fontSize: 8, lineHeight: 10 }]} numberOfLines={1}>
                  {t2.post}
                </Text>
                <Head variant="mini" color={partner.ink} numberOfLines={2} style={{ lineHeight: 11.5 }}>
                  {ref.title}
                </Head>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        {/* De strook "VERMELD": de bijdragen waar dit gesprek over ging.
            In modern volgt hij het rastermodel (2.2 §5): geen kader, het
            label horizontaal in mono, en kaartjes van 130 × 60 met een
            ronding van 14 en geen kleurrug. In kleur en magazine blijft hij
            zoals hij was — een kader met een gedraaid label en kaartjes van
            96 × 56. */}
        {mentioned.length > 0 && !embedded && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={
              spec.layout === "bento"
                ? { flexGrow: 0, marginTop: 8, marginHorizontal: 6 }
                : { flexGrow: 0, marginTop: 8, marginHorizontal: 18, borderWidth: BORDER, borderColor: line(), backgroundColor: color("paper2") }
            }
            contentContainerStyle={
              spec.layout === "bento"
                ? { paddingVertical: 4, alignItems: "center", gap: 6 }
                : { paddingVertical: 8, paddingHorizontal: 10, alignItems: "center", gap: 8 }
            }
          >
            {spec.layout === "bento" ? (
              <Text
                numberOfLines={1}
                style={[lincinType.tiny, { color: color("ink", "inkDim"), paddingRight: 6 }]}
              >
                {t2.mentioned}
              </Text>
            ) : (
              <View style={{ width: 14, height: 56, overflow: "hidden" }}>
                <View style={{ position: "absolute", width: 56, height: 14, left: -21, top: 21, transform: [{ rotate: "-90deg" }] }}>
                  <Text numberOfLines={1} style={[lincinType.tiny, { color: color("ink", "inkDim") }]}>
                    {t2.mentioned}
                  </Text>
                </View>
              </View>
            )}
            {mentioned.map((ref) => (
              <Pressable
                key={ref.id}
                accessibilityRole="button"
                accessibilityLabel={ref.title}
                onPress={() => router.push(`/post/${ref.id}` as never)}
                style={
                  spec.layout === "bento"
                    ? {
                        width: 130,
                        height: 60,
                        borderRadius: 14,
                        backgroundColor: partner.fill,
                        paddingVertical: 8,
                        paddingHorizontal: 10,
                        justifyContent: "space-between",
                      }
                    : {
                        width: 96,
                        height: 56,
                        backgroundColor: partner.fill,
                        borderWidth: BORDER,
                        borderColor: line(),
                        paddingVertical: 6,
                        paddingHorizontal: 8,
                        justifyContent: "space-between",
                      }
                }
              >
                <Text style={[lincinType.tiny, { color: partner.ink, fontSize: 8, lineHeight: 10 }]} numberOfLines={1}>
                  {t2.post}
                </Text>
                <Head variant="mini" color={partner.ink} numberOfLines={2}>
                  {ref.title}
                </Head>
              </Pressable>
            ))}
          </ScrollView>
        )}

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
              contentContainerStyle={
                embedded
                  ? // Desktop (model 3e): de draad over de hele kolom, 18/24
                    // rondom; de bubbels houden zelf hun leesmaat.
                    { paddingVertical: 18, paddingHorizontal: 24, gap: 10, width: "100%" }
                  : {
                      padding: space.lg,
                      paddingTop: 28,
                      gap: space.sm,
                      width: "100%",
                      maxWidth: THREAD_WIDTH,
                      alignSelf: "center",
                    }
              }
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
                const unreadSep =
                  unreadMark?.id === item.id ? (
                    <View
                      accessibilityRole="header"
                      className="flex-row items-center"
                      style={{ marginVertical: space.lg, gap: space.md }}
                    >
                      <View style={{ flex: 1, height: 2, backgroundColor: color("red") }} />
                      <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, backgroundColor: color("red") }}>
                        <Text style={[sans(800), { fontSize: 12, lineHeight: 15, letterSpacing: 0.4, color: creamOnDark.DEFAULT }]}>
                          {unreadMark.count} {(unreadMark.count === 1 ? t2.newMsg : t2.newMsgs).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, height: 2, backgroundColor: color("red") }} />
                    </View>
                  ) : null;
                const dateSepOnly = showDateSep ? (
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
                const dateSep =
                  dateSepOnly || unreadSep ? (
                    <>
                      {dateSepOnly}
                      {unreadSep}
                    </>
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
                      accent={partner.fill}
                      // Desktop (desktop-*-pages): in kleur de bubbel van een ander in zijn
                      // eigen kleur, in modern een wit tegelvlak. Op de telefoon het blad.
                      fill={
                        !embedded || isMine
                          ? undefined
                          : spec.id === "kleur"
                            ? friendColor(hueFor(item.sender_id), schemeNow)
                            : spec.id === "modern"
                              ? { fill: color("tile"), ink: color("ink") }
                              : undefined
                      }
                      isMine={isMine}
                      isGroup={!!isGroup}
                      showSenderHeader={showSenderHeader}
                      showAvatar={showAvatar}
                      senderAvatarUrl={senderAvatarUrl}
                      senderName={senderName}
                      pending={isPending && !isFailed}
                      failed={isFailed}
                      read={!!readThroughAt && isMine && item.created_at <= readThroughAt}
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
            <View style={{ paddingHorizontal: 18, paddingVertical: 4 }}>
              <Text style={[lincinType.asideSmall, { color: color("ink", "inkDim") }]}>
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

          {/* Naar de eerste ongelezen, als die buiten beeld ligt (Telegram). */}
          {unreadMark && !unreadPillSeen && reversedMessages.findIndex((m) => m.id === unreadMark.id) >= 6 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                const index = reversedMessages.findIndex((m) => m.id === unreadMark.id);
                if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.9 });
                setUnreadPillSeen(true);
              }}
              style={{
                position: "absolute",
                top: embedded ? 12 : 68,
                alignSelf: "center",
                zIndex: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 14,
                height: 34,
                borderRadius: 17,
                backgroundColor: color("red"),
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 6,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <Ionicons name="arrow-up" color={creamOnDark.DEFAULT} size={14} />
              <Text style={[sans(800), { fontSize: 13, lineHeight: 16, color: creamOnDark.DEFAULT }]}>
                {unreadMark.count} {unreadMark.count === 1 ? t2.newMsg : t2.newMsgs}
              </Text>
            </Pressable>
          ) : null}

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
          <View style={pill ? { paddingBottom: 4 } : { borderTopWidth: BORDER, borderTopColor: line(), backgroundColor: color("paper") }}>
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
                    style={{ width: 3, alignSelf: "stretch", backgroundColor: partner.fill }}
                  />
                  <View style={{ flex: 1, paddingVertical: 2 }}>
                    <Text
                      style={[feedType.kicker, { color: color("ink"), letterSpacing: 0.55 }]}
                      numberOfLines={1}
                    >
                      {replyTo.senderName.toUpperCase()}
                    </Text>
                    <Text
                      style={[feedType.label, { color: color("ink", "inkDim"), marginTop: 3 }]}
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
                    <Ionicons name="close" color={color("ink")} size={17} />
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

            {magBar && !recording ? (
            /**
             * De invoer van de omslag (desktop-magazine-pages, GESPREKKEN):
             * geen vakjes, één lijn onder het veld, en rechts één knop die
             * wisselt — de microfoon zolang er niets staat, een rood vlak
             * met ↑ zodra je typt (zoals Telegram). De bijlage links en de
             * emoji ín het veld zijn iconen zonder kader: ze horen bij de
             * lijn, niet ernaast.
             */
            <ComposerInset style={[{ paddingTop: 14, paddingBottom: 18 }, embedded ? { maxWidth: "100%", paddingHorizontal: 24 } : null]}>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bijlage toevoegen"
                  onPress={() => setAttachMenuOpen(true)}
                  disabled={sending}
                  style={({ pressed }) => [AUX_BUTTON, pressed && AUX_PRESSED]}
                >
                  <Ionicons name="add" color={color("ink")} size={26} />
                </Pressable>
                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                    flexDirection: "row",
                    alignItems: "flex-end",
                    minHeight: CONTROL_H,
                    borderBottomWidth: 1,
                    borderBottomColor: color("ink"),
                  }}
                >
                  <TextInput
                    ref={inputRef}
                    value={draft}
                    onChangeText={onDraftChange}
                    onKeyPress={onComposerKeyPress}
                    onFocus={() => setShowEmojiPicker(false)}
                    onContentSizeChange={(e) => setInputH(e.nativeEvent.contentSize.height)}
                    placeholder={sending ? "Bezig met versturen…" : `${t2.writeTo} ${title}…`}
                    placeholderTextColor={color("ink", "inkDim")}
                    multiline
                    // Web: één regel om mee te beginnen (anders twee), de
                    // hoogte groeit daarna via onContentSizeChange.
                    numberOfLines={Platform.OS === "web" ? 1 : undefined}
                    editable={!sending}
                    style={{
                      ...sans(),
                      flex: 1,
                      minWidth: 0,
                      fontSize: 16,
                      lineHeight: 22,
                      color: color("ink"),
                      paddingVertical: 0,
                      paddingHorizontal: 0,
                      marginVertical: 11,
                      height: Math.min(110, Math.max(22, inputH)),
                      ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none", resize: "none" } as any) : {}),
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Emoji"
                    onPress={() => {
                      setShowEmojiPicker((v) => !v);
                      if (!showEmojiPicker) inputRef.current?.blur();
                      else inputRef.current?.focus();
                    }}
                    style={({ pressed }) => [{ width: 36, height: CONTROL_H, alignItems: "center", justifyContent: "center" }, pressed && AUX_PRESSED]}
                  >
                    <Ionicons name={showEmojiPicker ? "happy" : "happy-outline"} color={color("ink", "inkDim")} size={21} />
                  </Pressable>
                </View>
                {draft.trim() || sending ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Bericht versturen"
                    onPress={onSend}
                    disabled={sending || !draft.trim()}
                    style={({ pressed }) => [
                      AUX_BUTTON,
                      { backgroundColor: sending ? color("paper2") : color("red") },
                      pressed && AUX_PRESSED,
                    ]}
                  >
                    <Ionicons name="arrow-up" color={sending ? color("ink", "inkDim") : ON_DARK} size={21} />
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Spraakbericht opnemen"
                    onPress={startRecording}
                    disabled={sending}
                    style={({ pressed }) => [AUX_BUTTON, pressed && AUX_PRESSED]}
                  >
                    <Ionicons name="mic-outline" color={color("ink")} size={23} />
                  </Pressable>
                )}
              </View>
            </ComposerInset>
            ) : (
            <ComposerInset style={{ paddingVertical: space.md }}>
             <View
              style={[
                {
                  flexDirection: "row",
                  alignItems: "flex-end",
                  gap: 0,
                },
                pill ? { alignItems: "center", minHeight: 56, paddingHorizontal: 6, gap: 4, borderRadius: 28, backgroundColor: color("paper") } : null,
              ]}
             >
              {!recording && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Bijlage toevoegen"
                  onPress={() => setAttachMenuOpen(true)}
                  disabled={sending}
                  // Geen eigen vlak: een bijna-zwart vierkant op een zwarte
                  // balk is een kader zonder werk. Het icoon draagt zichzelf.
                  style={({ pressed }) => [aux, pressed && AUX_PRESSED]}
                >
                  <Ionicons name="add" color={color("ink")} size={22} />
                </Pressable>
              )}
              {!recording && (
                <Pressable
                  onPress={() => {
                    setShowEmojiPicker((v) => !v);
                    if (!showEmojiPicker) inputRef.current?.blur();
                    else inputRef.current?.focus();
                  }}
                  style={({ pressed }) => [aux, pressed && AUX_PRESSED]}
                >
                  <Text style={{ fontSize: 18, lineHeight: 22, color: color("ink") }}>☺</Text>
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
                  className="flex-1 max-h-32 justify-center"
                  style={
                    pill
                      ? { minHeight: CONTROL_H, paddingHorizontal: space.md }
                      : magBar
                        ? { minHeight: CONTROL_H, marginHorizontal: space.md, borderBottomWidth: 1, borderBottomColor: color("ink") }
                        : { minHeight: CONTROL_H, paddingHorizontal: space.md, borderWidth: BORDER, borderRightWidth: 0, borderColor: line() }
                  }
                >
                  <TextInput
                    ref={inputRef}
                    value={draft}
                    onChangeText={onDraftChange}
                    onKeyPress={onComposerKeyPress}
                    onFocus={() => setShowEmojiPicker(false)}
                    placeholder={sending ? "Bezig met versturen…" : magBar ? `${t2.writeTo} ${title}…` : "Bericht…"}
                    placeholderTextColor={color("ink", "inkDim")}
                    multiline
                    editable={!sending}
                    // Tekst op een vlak dat in béide standen donker blijft is
                    // crème, nooit inkt — zie het kader in DESIGN.md §2.
                    className="text-ink text-base"
                    style={{
                      ...(magBar ? { ...sans(), fontSize: 16 } : null),
                      minHeight: 24,
                      paddingVertical: 0,
                      lineHeight: 20,
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
                  style={aux}
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
                      ? "bg-paper2"
                      : magBar
                        ? "bg-flame"
                        : "bg-ink"
                  }
                  style={magBar ? { ...AUX_BUTTON, borderWidth: 0 } : auxEnd}
                >
                  <Ionicons
                    name="arrow-up"
                    color={sending || !draft.trim() ? color("ink", "inkDim") : magBar ? "#FFFFFF" : creamOnDark.DEFAULT}
                    size={21}
                  />
                </Pressable>
              ) : (
                // Draft empty → mic. Tikken start; de rode knop verstuurt en
                // de prullenbak gooit weg — op elk platform hetzelfde, want
                // een opname die verdwijnt zodra je vinger glijdt verrast.
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Spraakbericht opnemen"
                  onPress={startRecording}
                  disabled={sending}
                  // Net als de twee knoppen links: het icoon draagt zichzelf
                  // op de balk. Zodra er iets te versturen valt neemt de
                  // oranje knop deze plek over — dán is er een vlak.
                  style={({ pressed }) => [auxEnd, pressed && AUX_PRESSED]}
                >
                  <Ionicons name="mic" color={color("ink")} size={21} />
                </Pressable>
              )}
             </View>
            </ComposerInset>
            )}
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
                  /**
                   * Tien foto's versturen, en waar je dan naar kijkt.
                   *
                   * Dit venster ging dicht vóór de lus begon —
                   * `setPendingImages(null)` als eerste regel. Daarmee
                   * verdween ook de voortgangsbalk die er twintig regels
                   * hoger in staat, dus de enige plek waar te zien was dat
                   * er iets gebeurde. Je stond terug in het gesprek terwijl
                   * er tien versleutelde uploads liepen, zonder één signaal.
                   *
                   * En mislukte er iets, dan gaf elke foto zijn eigen toast.
                   * De wachtrij is één diep: nummer zeven duwde nummer zes
                   * weg, en je hield één melding over die over één bestand
                   * ging terwijl er drie misgingen.
                   *
                   * Nu blijft het venster staan met "3 van 10", en aan het
                   * eind gebeurt er één van twee dingen: alles weg, of de
                   * mislukte foto's blijven staan zodat "verstuur" ze
                   * opnieuw probeert — precies degene die het nog niet
                   * gehaald hebben.
                   */
                  onPress={async () => {
                    if (!pendingImages?.length || sending) return;
                    const images = [...pendingImages];
                    const caption = pendingCaption;
                    const batch = images.length > 1;
                    setBatchProgress(batch ? { done: 0, total: images.length } : null);
                    const failed: typeof images = [];
                    for (let i = 0; i < images.length; i++) {
                      const ok = await onSendAttachment({
                        uri: images[i].uri,
                        mimeType: images[i].mimeType,
                        filename: images[i].filename,
                        caption: i === images.length - 1 ? caption : undefined,
                        silent: batch,
                      });
                      if (!ok) failed.push(images[i]);
                      if (batch) setBatchProgress({ done: i + 1, total: images.length });
                    }
                    setBatchProgress(null);
                    if (failed.length === 0) {
                      setPendingImages(null);
                      setPendingCaption("");
                      setSelectedPendingIdx(0);
                      return;
                    }
                    setPendingImages(failed);
                    setSelectedPendingIdx(0);
                    toast.error(
                      `${images.length - failed.length} van ${images.length} verstuurd. ` +
                        `${plural(failed.length, "foto", "foto's")} staan nog klaar.`
                    );
                  }}
                  disabled={sending}
                  style={{
                    width: 44, height: 44, borderRadius: 22,
                    backgroundColor: sending ? "#3A3A3A" : flame,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  {sending ? (
                    batchProgress ? (
                      <Text style={{ color: creamOnDark.DEFAULT, fontSize: 11, fontWeight: "700" }}>
                        {batchProgress.done}/{batchProgress.total}
                      </Text>
                    ) : (
                      <ActivityIndicator color={creamOnDark.DEFAULT} size="small" />
                    )
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
    </LincinScreen>
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
    return d.toLocaleDateString(NL, { weekday: "long" });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(NL, { day: "numeric", month: "long" });
  }
  return d.toLocaleDateString(NL, { day: "numeric", month: "long", year: "numeric" });
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

/** Icoonmaat in de actiebalk onder een bubbel; de emoji staat er optisch op gelijke hoogte mee. */
const TOOLBAR_ICON = 17;
const TOOLBAR_EMOJI = { fontSize: 16, lineHeight: 20 } as const;

/**
 * Eén knop in de actiebalk onder een bubbel: de hoogte van élk
 * besturingselement (CONTROL_H), een vaste breedte zodat een icoon en een
 * emoji hetzelfde hokje krijgen, en bij indrukken alleen wat lichter.
 */
function ToolbarButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        width: CONTROL_H - space.xs,
        height: CONTROL_H,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.45 : 1,
      })}
    >
      {children}
    </Pressable>
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
  pending,
  failed,
  onRetry,
  reactions,
  onLongPress,
  onToggleReaction,
  read,
  onReply,
  onCopy,
  onEdit,
  onDelete,
  onReplyQuotePress,
  onReactionLongPress,
  selected,
  onSelect,
  accent,
  fill,
}: {
  msg: DecryptedMessage;
  /** De kleur van de ander: de rand van een aangetikte bubbel, de kantlijn van een vermelding. */
  accent?: string;
  /** Het vlak van de bubbel en de inkt erop (desktop kleur); anders het blad. */
  fill?: { fill: string; ink: string };
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
  /** Gelezen door iedereen: ✓✓ in plaats van ✓ (Telegram). */
  read?: boolean;
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
  // Wie er reageerde, in woorden: "❤️ Jij en Noor" onder de chips, en de
  // namen bij hover (web). Een telling alleen zegt niet wie.
  const who = useReactionWho(reactions);
  // `[]` betekende "de taal van het besturingssysteem", en op een toestel
  // dat op Engels staat gaf dat `3:45 PM` — in dezelfde bubbel als een
  // Nederlandse datum. Zie lib/locale.ts.
  const time = new Date(msg.created_at).toLocaleTimeString(NL, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const router = useRouter();
  const t2 = useT();
  const content = msg.content;
  const hasAttachment = !!content?.attachment;
  const hasText = !!content?.text && content.text.length > 0;
  // Modern kent geen kaders en geen rechte hoeken; zie de bubbelstijl onder.
  const modern = useThemeSpec().layout === "bento";
  // Magazine (de omslag): een haarlijn van 1 en de tekst in serif.
  const mag = useThemeSpec().layout === "spread";
  const emojiOnly = !!content?.text && /^[\p{Extended_Pictographic}\u200d\ufe0f\s]{1,6}$/u.test(content.text);
  // In groepsgesprekken: avatar-slot links van inkomende berichten
  // zodat alles netjes uitlijnt. Avatar zichtbaar op elke bubble.
  const showAvatarSlot = isGroup && !isMine;
  // De naam in de bubbel in de kleur van de afzender, zoals Telegram — zo
  // zie je in een groep wie het zei zonder de naam te lezen.
  const senderColor = friendColor(hueFor(msg.sender_id), useScheme());
  const senderHue = senderColor.fill;

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
      // Een bubbel mag nooit breder worden dan 78% van de kolom (prototype
      // THREAD: `max-width: 78%`), en op een breed scherm nooit breder dan
      // BUBBLE_MAX_W — dat tweede staat op de laag hieronder. Het percentage
      // stond hier eerst niet: de wikkel had alleen de vaste maat, en één
      // onbreekbaar woord (een lange URL) duwde de bubbel dan de kolom uit.
      // `minWidth: 0` laat de wikkel krimpen onder zijn inhoud; de tekst
      // zelf breekt op web met `overflowWrap` (zie MentionsText hieronder).
      style={{ maxWidth: "78%", minWidth: 0, flexShrink: 1, alignSelf: isMine ? "flex-end" : "flex-start" }}
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

      {/* Telegram: de avatar staat links onderaan, naast de láátste
          bubbel van een reeks; de naam staat ín de eerste (zie hieronder).
          Zo lees je een reeks als één blok van één persoon. */}

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
      {content?.postRef && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t2.about} ${content.postRef.title}`}
          onPress={() => router.push(`/post/${content.postRef!.id}` as never)}
          style={{
            alignSelf: isMine ? "flex-end" : "flex-start",
            maxWidth: "82%",
            marginLeft: showAvatarSlot ? 44 : 0,
            borderLeftWidth: 3,
            borderLeftColor: accent ?? color("ink"),
            paddingVertical: 6,
            paddingHorizontal: 10,
            marginBottom: 2,
          }}
        >
          <Text
            numberOfLines={2}
            style={[lincinType.asideSmall, { color: color("ink", "inkDim"), textDecorationLine: "underline" }]}
          >
            {t2.about} «{content.postRef.quote || content.postRef.title}»
          </Text>
        </Pressable>
      )}
      <SwipeWrap gesture={Platform.OS !== "web" ? panGesture : null}>
      <Animated.View
        className={`flex-row items-center gap-1 ${isMine ? "flex-row-reverse" : "flex-row"}`}
        style={{
          // De leesmaat: ~60 tekens op 16px. Het percentage zit op de
          // wikkel hierboven; hier alleen de harde bovengrens.
          maxWidth: BUBBLE_MAX_W,
          minWidth: 0,
          marginLeft: showAvatarSlot ? 44 : 0,
          transform: [{ translateX: Platform.OS !== "web" ? swipeX : 0 }],
        }}
      >
        {/* Telegram: de avatar links onderaan, naast de láátste bubbel van
            een reeks; de naam staat ín de eerste. Zo lees je een reeks als
            één blok van één persoon. */}
        {showAvatar && showAvatarSlot ? (
          <View style={{ position: "absolute", left: -40, bottom: 0 }}>
            {senderAvatarUrl ? (
              <Avatar name={senderName} avatarUrl={senderAvatarUrl} size="sm" />
            ) : (
              // Zonder foto de initiaal in de kleur van de afzender — dezelfde
              // cirkel als in de gesprekkenlijst (magazine een ring, anders
              // een vol vlak).
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  ...(mag ? { borderWidth: 1, borderColor: senderColor.fill } : { backgroundColor: senderColor.fill }),
                }}
              >
                <Text style={[mag ? serif() : sans(700), { fontSize: mag ? 19 : 14, lineHeight: mag ? 22 : 17, color: mag ? senderColor.fill : senderColor.ink }]}>
                  {(senderName ?? "?").trim().charAt(0).toUpperCase() || "?"}
                </Text>
              </View>
            )}
          </View>
        ) : null}
        <View style={{ minWidth: 0 }} className={isMine ? "items-end flex-1" : "items-start flex-1"}>
      <Pressable
        onLongPress={onLongPress}
        onPress={failed && onRetry ? onRetry : (Platform.OS === "web" ? onSelect : undefined)}
        delayLongPress={300}
        // @ts-ignore — onContextMenu is een web-only prop voor rechtermuisknop
        onContextMenu={Platform.OS === "web" ? (e: any) => { e.preventDefault(); onSelect?.(); } : undefined}
        /**
          * Donker blad is "van mij", licht blad is "van iemand anders".
          *
          * Het bericht van de ander heeft een tijd lang een zwart kader
          * van anderhalve pixel gedragen. Dat kader is in de feed het
          * raster; om één zin heen leest het als een doos, en het vecht
          * met de actiebalk die er bij selectie onder komt en wél een
          * kader hoort te hebben (een popover is een kader).
          *
          * Nu is het een licht blad (`page-alt`: wit in de lichte stand,
          * bijna-wit lavendel in de donkere) met een haarlijn eromheen.
          * De haarlijn is er alleen omdat het blad in de lichte stand
          * anders bijna in het paginavlak verdwijnt — hij moet niet
          * opvallen, en `rule.soft` valt niet op.
          */
        style={[
          {
            opacity: pending ? 0.65 : 1,
            // Kleur en magazine: anderhalve pixel inkt om elke bubbel
            // (prototype THREAD: `border: 1.5px solid` naast `--bw`).
            borderWidth: 1.5,
            borderColor: failed ? color("red") : selected && accent ? accent : color("ink"),
          },
          /**
           * Modern kent geen kaders en geen rechte hoeken. Daar is een
           * bubbel een afgeronde vorm met één korte hoek aan de kant waar
           * hij vandaan komt — 20/20/6/20 voor die van jou, 20/20/20/6 voor
           * die van de ander (prototype). De jouwe is een inktvlak zonder
           * rand; die van de ander een lichte inkttint met een haarlijn.
           */
          mag
            ? {
                borderWidth: 1,
                borderColor: failed ? color("red") : selected && accent ? accent : color("ink", "postRule"),
                ...(isMine || failed ? null : { backgroundColor: color("paper2") }),
              }
            : null,
          modern
            ? {
                borderWidth: isMine ? 0 : 1,
                borderColor: failed
                  ? color("red")
                  : selected && accent
                    ? accent
                    : color("ink", "postRule"),
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                borderBottomRightRadius: isMine ? 6 : 20,
                borderBottomLeftRadius: isMine ? 20 : 6,
                backgroundColor: failed ? color("red") : isMine ? color("ink") : color("ink", "onDark"),
              }
            : null,
          fill && !failed ? { backgroundColor: fill.fill } : null,
        ]}
        className={`${
          hasAttachment ? "" : content?.reply ? "pt-0 pb-2.5" : "px-4 py-2.5"
        } ${modern ? "" : failed ? "bg-flame" : isMine ? "bg-ink" : "bg-page-alt"}`}
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
              🔒 Niet leesbaar op dit toestel — nieuw toestel? Koppel het via je profiel.
            </Text>
          )
        ) : (
          <>
            {showSenderHeader && showAvatarSlot && !hasAttachment ? (
              <Text
                numberOfLines={1}
                style={[
                  sans(700),
                  {
                    fontSize: 13,
                    lineHeight: 17,
                    color: senderHue,
                    paddingHorizontal: content.reply ? space.lg : 0,
                    paddingTop: content.reply ? space.md : 0,
                    marginBottom: content.reply ? 0 : 2,
                  },
                ]}
              >
                {senderName ?? "Onbekend"}
              </Text>
            ) : null}
            {showSenderHeader && showAvatarSlot && hasAttachment ? (
              <Text numberOfLines={1} style={[sans(700), { fontSize: 13, lineHeight: 17, color: senderHue, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 }]}>
                {senderName ?? "Onbekend"}
              </Text>
            ) : null}
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
            <View
              style={
                hasAttachment
                  ? undefined
                  : { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "flex-end", columnGap: 10 }
              }
            >
            {hasText && (
              <View
                className={hasAttachment ? "px-3 py-2" : content?.reply ? "px-4 pt-1" : ""}
                style={hasAttachment ? undefined : { flexShrink: 1, flexGrow: 1, minWidth: 0 }}
              >
                <MentionsText
                  text={content.text!}
                  isMine={isMine}
                  // Een URL zonder spaties is één woord; zonder deze regel
                  // bepaalt zijn lengte de minimumbreedte van de bubbel en
                  // loopt die de kolom uit. `anywhere` breekt hem waar nodig.
                  style={[
                    Platform.OS === "web" ? ({ overflowWrap: "anywhere", wordBreak: "break-word" } as object) : null,
                    // Berichten in een gewone schreefloze letter, ook in
                    // magazine: een gesprek lees je snel, de serif is voor
                    // koppen en namen.
                    mag && !emojiOnly ? { ...sans(), fontSize: 16, lineHeight: 22 } : null,
                    fill ? { color: fill.ink } : null,
                  ]}
                  className={`${
                    /^[\p{Extended_Pictographic}\u200d\ufe0f\s]{1,6}$/u.test(content.text!)
                      ? "text-[34px] leading-[40px]"
                      : "text-base"
                  } ${isMine ? "text-cream" : "text-ink"}`}
                />
              </View>
            )}
            <View
              className={`flex-row items-center justify-end ${
                hasAttachment ? "px-3 pb-2" : content?.reply ? "px-4 mt-0.5 pb-0.5" : ""
              }`}
              style={hasAttachment ? undefined : { marginLeft: "auto", paddingBottom: 1 }}
            >
              <Text
                style={[
                  lincinType.micro,
                  mag ? { ...sans(700), fontSize: 9, letterSpacing: 0.9 } : null,
                  { textTransform: "none", color: isMine ? creamOnDark.muted : feed.inkDim },
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
                // ✓ verstuurd, ✓✓ gelezen — zoals Telegram en WhatsApp.
                <Ionicons
                  name={read ? "checkmark-done" : "checkmark"}
                  size={read ? 13 : 12}
                  color={read ? creamOnDark.DEFAULT : creamOnDark.muted}
                  accessibilityLabel={read ? "Gelezen" : "Verstuurd"}
                  style={{ marginLeft: 4 }}
                />
              )}
              {failed && (
                <Text className="text-cream text-[10px] ml-2 underline">
                  Tik om opnieuw te proberen
                </Text>
              )}
            </View>
            </View>
          </>
        )}
      </Pressable>
        </View>
      </Animated.View>
      </SwipeWrap>

      {/*
          De actiebalk — verschijnt bij tik (web) of lang drukken (native).

          Hij stond in de rij naast de bubbel, en dat ging twee keer mis:
          bij een lang bericht kneep hij de bubbel smaller, en zijn knoppen
          hadden drie verschillende maten (32, 36 en 44), zodat de rij nooit
          op één lijn stond. Nu staat hij ónder de bubbel, tegen dezelfde
          kant uitgelijnd, als één popover: licht blad, het kader van het
          feed-raster, en élke knop op dezelfde maat. Een haarlijn scheidt
          "reageren" van "doen met dit bericht". Alleen verwijderen is rood.
      */}
      {selected && (
        <View
          className={`flex-row items-center mt-1 bg-page-alt ${isMine ? "self-end" : "self-start"}`}
          style={{
            marginLeft: showAvatarSlot ? 44 : 0,
            borderWidth: FEED_BORDER,
            borderColor: feed.ink,
          }}
        >
          {onReply && (
            <ToolbarButton label="Antwoorden op dit bericht" onPress={onReply}>
              <Ionicons name="return-down-back-outline" color={feed.ink} size={TOOLBAR_ICON} />
            </ToolbarButton>
          )}
          <ToolbarButton label="Reageren met een hartje" onPress={() => onToggleReaction("❤️")}>
            <Text style={TOOLBAR_EMOJI}>❤️</Text>
          </ToolbarButton>
          <ToolbarButton label="Reageren met een duim" onPress={() => onToggleReaction("👍")}>
            <Text style={TOOLBAR_EMOJI}>👍</Text>
          </ToolbarButton>
          {(onCopy || onEdit || onDelete) && (
            <View
              style={{
                width: StyleSheet.hairlineWidth,
                alignSelf: "stretch",
                marginVertical: space.sm,
                backgroundColor: rule.card,
              }}
            />
          )}
          {onCopy && (
            <ToolbarButton label="Bericht kopiëren" onPress={onCopy}>
              <Ionicons name="copy-outline" color={feed.ink} size={TOOLBAR_ICON} />
            </ToolbarButton>
          )}
          {/* De enige ingang naar het bewerken — zie renderItem voor
              waarom die er tot nu toe niet was. Náást verwijderen, want
              de twee horen bij elkaar: het zijn allebei dingen die je
              alleen met je eigen bericht kunt. */}
          {onEdit && (
            <ToolbarButton label="Bericht bewerken" onPress={onEdit}>
              <Ionicons name="pencil-outline" color={feed.ink} size={TOOLBAR_ICON} />
            </ToolbarButton>
          )}
          {onDelete && (
            <ToolbarButton label="Bericht verwijderen" onPress={onDelete}>
              <Ionicons name="trash-outline" color={flameDeep} size={TOOLBAR_ICON} />
            </ToolbarButton>
          )}
        </View>
      )}

      {reactions.length > 0 && (
        <View
          className={`flex-row gap-1 mt-1 ${isMine ? "self-end pr-1" : "self-start"}`}
          style={showAvatarSlot ? { marginLeft: 44 } : undefined}
        >
          {reactions.map((r) => (
            <Pressable
              key={r.emoji}
              {...who.chip(r)}
              onPress={() => onToggleReaction(r.emoji)}
              onLongPress={() => onReactionLongPress?.(r.emoji, r.userIds)}
              delayLongPress={300}
              // Geen vulling: onder een bubbel die zélf al vol of leeg is
              // zou een derde vlak niets meer zeggen. De lijn verzwaart als
              // de reactie van jou is — zelfde tweedeling, ander middel.
              className="flex-row items-center px-2 py-0.5"
              style={{
                borderWidth: BORDER,
                borderColor: line(),
                backgroundColor: color("paper"),
              }}
            >
              <Text style={{ fontSize: 13 }}>{r.emoji}</Text>
              <Text
                style={[
                  feedType.label,
                  { marginLeft: 4, fontWeight: "700", color: color("ink") },
                ]}
              >
                {who.chipLabel(r)}
              </Text>
            </Pressable>
          ))}
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
  // `[]` betekende "de taal van het besturingssysteem", en op een toestel
  // dat op Engels staat gaf dat `3:45 PM` — in dezelfde bubbel als een
  // Nederlandse datum. Zie lib/locale.ts.
  const time = new Date(msg.created_at).toLocaleTimeString(NL, {
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
  // Elke foto stond als vierkant van 240 met `cover`: een staande foto
  // verloor boven en onder, een liggende de zijkanten. Nu 240 breed en zo
  // hoog als de foto zelf (begrensd 4:5–1.91:1, zie lib/lincin/ratio), en
  // wat buiten die grenzen valt wordt ingepast in plaats van afgesneden.
  const ratio = useImageRatio(uri);
  const thumbH = Math.round(240 / ratio);

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
            style={{ width: 240, height: thumbH }}
            contentFit="contain"
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
 * expo-audio voor native én web; de hook ruimt de speler zelf op.
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
  // Zolang het bestand nog ontsleuteld wordt is de bron leeg; zodra de uri
  // er is maakt de hook een nieuwe speler (hij sleutelt op de bron).
  const player = useAudioPlayer(uri ? { uri } : null);
  const status = useAudioPlayerStatus(player);
  const isPlaying = status.playing;
  // expo-audio rekent in seconden; de opmaak hieronder in milliseconden.
  const position = status.currentTime * 1000;
  const duration = Number.isFinite(status.duration) && status.duration > 0 ? status.duration * 1000 : 0;

  async function togglePlay() {
    if (!uri) return;
    try {
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (status.playing) {
        player.pause();
        return;
      }
      // Herstart als klaar
      const atEnd =
        status.didJustFinish ||
        (status.duration > 0 && status.currentTime >= status.duration - 0.05);
      if (atEnd) await player.seekTo(0);
      player.play();
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
 * Tap opent een fullscreen modal met expo-video (native + web).
 */
function VideoWithPlayer({ uri, loading }: { uri: string | null; loading: boolean }) {
  const [open, setOpen] = useState(false);
  const { width: screenW, height: screenH } = useWindowDimensions();
  // Het stilstaande eerste beeld als poster. Afspelen gebeurt in het
  // modaal, met een eigen speler die pas bestaat zodra het open is.
  const poster = useVideoPlayer(uri, (p) => {
    p.muted = true;
  });

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
              {/* Het eerste beeld als poster */}
              <VideoView
                player={poster}
                style={{ width: 240, height: 240, position: "absolute" }}
                contentFit="cover"
                nativeControls={false}
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
          {uri && open ? (
            <FullscreenVideo uri={uri} width={screenW} height={screenH} />
          ) : null}
        </View>
      </Modal>
    </>
  );
}

/** De speler in het modaal: start meteen, en verdwijnt mét het modaal. */
function FullscreenVideo({ uri, width, height }: { uri: string; width: number; height: number }) {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width, height }}
      contentFit="contain"
      nativeControls
      allowsFullscreen
    />
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
                  {new Date(slot.starts_at).toLocaleDateString(NL, { weekday: "short", day: "numeric", month: "short" })}
                </Text>
                <Text style={[feedType.label, { color: onDarkDim, marginTop: 1 }]}>
                  {new Date(slot.starts_at).toLocaleTimeString(NL, { hour: "2-digit", minute: "2-digit" })} – {new Date(slot.ends_at).toLocaleTimeString(NL, { hour: "2-digit", minute: "2-digit" })}
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
