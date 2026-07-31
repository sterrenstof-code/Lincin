import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { AppChrome, PAGE_MAX, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import {
  contributeToEvent,
  deleteContribution,
  eventStatusLabel,
  getEvent,
  listEventContributions,
  subscribeToEventContributions,
  buildEventJoinUrl,
  type ContributionWithAuthor,
} from "@/lib/api/events";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { safeBack } from "@/lib/nav";
import { copyToClipboard, shareText } from "@/lib/share";
import { supabase } from "@/lib/supabase/client";
import { feed, FEED_BORDER, feedType, flameDeep } from "@/lib/design/type";

export default function EventDetailScreen() {
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id!;

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const event = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => getEvent(eventId, myUserId),
    refetchInterval: 30_000,
  });

  const contributions = useQuery({
    queryKey: ["event-contributions", eventId],
    queryFn: () => listEventContributions(eventId, myUserId),
  });

  useEffect(() => {
    const channel = subscribeToEventContributions(eventId, () => {
      qc.invalidateQueries({ queryKey: ["event-contributions", eventId] });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, qc]);

  // Re-fetch when the screen regains focus so signed image URLs are fresh
  // (they expire) and the reveal state / counts are up to date.
  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["event-contributions", eventId] });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
    }, [eventId, qc])
  );

  async function onDeleteContribution(c: ContributionWithAuthor) {
    const ok = await confirm(
      "Bijdrage verwijderen?",
      "Dit verwijdert de foto of bijdrage definitief.",
      { affirmativeLabel: "Verwijder", destructive: true }
    );
    if (!ok) return;
    try {
      await deleteContribution({ contributionId: c.id, imagePath: c.image_path });
      await qc.invalidateQueries({ queryKey: ["event-contributions", eventId] });
      await qc.invalidateQueries({ queryKey: ["event", eventId] });
    } catch (e: any) {
      setError(e?.message ?? "Kon bijdrage niet verwijderen.");
    }
  }

  function onOpenCamera() {
    setAddMenuOpen(false);
    router.push(`/event-camera/${eventId}`);
  }

  function onOpenInvite() {
    router.push(`/event-qr/${eventId}`);
  }

  function onOpenLinkCompose() {
    setAddMenuOpen(false);
    router.push(`/event-link/${eventId}`);
  }

  async function pickFromGallery(mediaTypes: ("images" | "videos")[]) {
    setAddMenuOpen(false);
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError("Geen toegang tot je foto's. Geef Lincin permissie in je systeeminstellingen.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes,
      quality: 0.85,
      allowsEditing: false,
      selectionLimit: 1,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];

    setUploading(true);
    try {
      await contributeToEvent({
        eventId,
        userId: myUserId,
        imageUri: asset.uri,
        mimeType:
          asset.mimeType ??
          (asset.type === "video" ? "video/mp4" : "image/jpeg"),
      });
      await qc.invalidateQueries({ queryKey: ["event-contributions", eventId] });
      await qc.invalidateQueries({ queryKey: ["event", eventId] });
    } catch (e: any) {
      setError(humanizeContributeError(e));
    } finally {
      setUploading(false);
    }
  }

  async function onShareInvite() {
    if (!event.data) return;
    const url = buildEventJoinUrl(event.data.join_code);
    const result = await shareText({
      title: `Join "${event.data.name}" op Lincin`,
      message: `Je bent uitgenodigd voor "${event.data.name}" op Lincin: ${url}`,
    });
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  async function onCopyInvite() {
    if (!event.data) return;
    const url = buildEventJoinUrl(event.data.join_code);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  if (event.isLoading || !event.data) {
    return (
      <SafeAreaView className="flex-1 bg-feed-lav">
        <View className="flex-1 items-center justify-center">
          <Text style={[feedType.label, { color: feed.inkDim }]}>Event laden…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const ev = event.data;
  const contribs = contributions.data?.contributions ?? [];
  const revealed = contributions.data?.revealed ?? false;
  const status = eventStatusLabel(ev);
  const start = new Date(ev.starts_at);

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top", "left", "right"]}>
      <ScrollView
        stickyHeaderIndices={[0]}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <AppChrome wide={wide} progress={chrome.progress} />

        <View style={{ width: "100%", maxWidth: PAGE_MAX, alignSelf: "center" }}>
          {/* ============ HERO ============
              Zelfde opbouw als de uitgelichte vondst in de feed: kicker en
              kop links, de feiten rechts, en het beeld eronder dat de rest
              van het scherm vult. Zie DESIGN_V3_FEED.md, "Layout, top to
              bottom", punt 3. */}
          <View
            style={{
              paddingHorizontal: wide ? 32 : 18,
              paddingTop: 20,
              paddingBottom: 28,
              borderBottomWidth: FEED_BORDER,
              borderBottomColor: feed.ink,
            }}
          >
            <Pressable
              onPress={() => safeBack(router, "/(app)/events")}
              hitSlop={8}
              style={{ flexDirection: "row", alignItems: "center", marginBottom: 18 }}
            >
              <Ionicons name="chevron-back" color={feed.ink} size={16} />
              <Text style={[feedType.label, { color: feed.ink, marginLeft: 4 }]}>
                Alle events
              </Text>
            </Pressable>

            <View
              style={{
                flexDirection: wide ? "row" : "column",
                justifyContent: "space-between",
                alignItems: wide ? "flex-start" : "stretch",
                marginBottom: 22,
              }}
            >
              <View style={wide ? { flex: 1, maxWidth: 640, paddingRight: 24 } : undefined}>
                <Text
                  style={[
                    feedType.kicker,
                    { color: flameDeep, letterSpacing: 0.55, fontSize: 11, marginBottom: 10 },
                  ]}
                >
                  {`EVENT · ${status.toUpperCase()}`}
                </Text>
                <Text
                  style={[wide ? feedType.hero : feedType.heroSmall, { color: feed.ink }]}
                  numberOfLines={3}
                >
                  {ev.name}
                </Text>
                {ev.description ? (
                  <Text
                    style={[feedType.body, { color: feed.inkDim, marginTop: 14, maxWidth: 560 }]}
                  >
                    {ev.description}
                  </Text>
                ) : null}
              </View>

              {/* De feitenkolom rechts — dezelfde plek waar de feed de deler
                  en de bron zet. */}
              <View style={wide ? { alignItems: "flex-end", paddingTop: 4 } : { marginTop: 20 }}>
                <Text
                  style={[
                    feedType.label,
                    { fontSize: 15, fontWeight: "700", color: feed.ink, marginBottom: 6,
                      textAlign: wide ? "right" : "left" },
                  ]}
                >
                  {start.toLocaleString("nl-BE", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </Text>
                <Text
                  style={[
                    feedType.label,
                    { color: "#3A3540", lineHeight: 16, textAlign: wide ? "right" : "left" },
                  ]}
                >
                  {start.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <Text
                  style={[
                    feedType.label,
                    { color: "#3A3540", lineHeight: 16, textAlign: wide ? "right" : "left" },
                  ]}
                >
                  {`${ev.members_count} gasten · ${ev.contributions_count} foto's`}
                </Text>
              </View>
            </View>

            {/* Het beeld vult de rest van de hero. */}
            <View
              style={{
                width: "100%",
                aspectRatio: wide ? 16 / 7 : 4 / 3,
                borderWidth: FEED_BORDER,
                borderColor: feed.ink,
                backgroundColor: feed.post,
              }}
            >
              {ev.cover_url ? (
                <Image
                  source={{ uri: ev.cover_url }}
                  style={{ width: "100%", height: "100%" }}
                  contentFit="cover"
                  transition={150}
                />
              ) : null}
            </View>
          </View>

          {/* ============ ACTIES — één gekaderde rij ============ */}
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: FEED_BORDER,
              borderBottomColor: feed.ink,
            }}
          >
            <ActionCell label="Bewaren" onPress={onCopyInvite} icon="download-outline" />
            <ActionCell label="Uitnodigen" onPress={onOpenInvite} icon="qr-code-outline" />
            <ActionCell
              label={uploading ? "Bezig…" : "Voeg toe"}
              onPress={() => setAddMenuOpen(true)}
              icon="add"
              filled
              disabled={uploading}
              last
            />
          </View>

          {copied ? (
            <Text style={[feedType.label, { color: flameDeep, textAlign: "center", paddingTop: 10 }]}>
              Link gekopieerd
            </Text>
          ) : null}
          {error ? (
            <Text style={[feedType.label, { color: flameDeep, textAlign: "center", paddingTop: 10 }]}>
              {error}
            </Text>
          ) : null}

          {/* Privacy note: event media is not end-to-end encrypted like chats. */}
          <View className="flex-row items-center justify-center mt-3 px-4">
            <Ionicons name="information-circle-outline" color={feed.inkDim} size={13} />
            <Text className="text-cream-muted text-[11px] ml-1.5 text-center">
              Event-media is niet end-to-end versleuteld zoals je chats.
            </Text>
          </View>

          <ActionSheet
            visible={addMenuOpen}
            onClose={() => setAddMenuOpen(false)}
            title="Bijdrage toevoegen"
            actions={[
              {
                label: "Maak een foto",
                icon: "camera-outline",
                onPress: onOpenCamera,
              },
              {
                label: "Kies foto uit galerij",
                icon: "images-outline",
                onPress: () => pickFromGallery(["images"]),
              },
              {
                label: "Kies video uit galerij",
                icon: "videocam-outline",
                onPress: () => pickFromGallery(["videos"]),
              },
              {
                label: "Voeg link toe",
                icon: "link-outline",
                onPress: onOpenLinkCompose,
              },
            ]}
          />

          {/* Photo grid / reveal lock */}
          {!revealed ? (
            <View className="mt-5 bg-paper-soft p-6 items-center">
              <View className="w-14 h-14 bg-paper-warm items-center justify-center mb-3">
                <Ionicons name="lock-closed" color={feed.ink} size={24} />
              </View>
              <Text className="text-ink font-semibold text-lg text-center mb-1">
                Onthulling vergrendeld
              </Text>
              <Text className="text-ink-soft text-sm text-center leading-5">
                {ev.reveal === "after"
                  ? "Foto's worden onthuld na afloop van het event."
                  : ev.reveal === "delayed"
                    ? `Foto's worden onthuld ${ev.reveal_delay_hours}u na afloop.`
                    : "Foto's worden zichtbaar tijdens het event."}
                {"\n"}Tot dan kan je wel zelf bijdragen toevoegen via Camera.
              </Text>
            </View>
          ) : contribs.length === 0 ? (
            <View className="mt-5 bg-paper-soft p-6 items-center">
              <View className="w-14 h-14 bg-paper-warm items-center justify-center mb-3">
                <Ionicons name="images-outline" color={feed.ink} size={24} />
              </View>
              <Text className="text-ink font-semibold text-base mb-1">
                Nog geen foto's
              </Text>
              <Text className="text-ink-soft text-sm text-center">
                Wees de eerste. Tap Camera bovenaan.
              </Text>
            </View>
          ) : (
            <View className="mt-5 flex-row flex-wrap" style={{ marginHorizontal: -3 }}>
              {contribs.map((c) => (
                <ContributionTile
                  key={c.id}
                  contribution={c}
                  canDelete={c.user_id === myUserId || ev.is_host}
                  onDelete={() => onDeleteContribution(c)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function humanizeContributeError(err: any): string {
  const msg = err?.message ?? String(err ?? "Onbekende fout");
  // Log the technical detail for debugging, but never surface it to users.
  console.warn("[event] contribute error:", msg);
  if (/row-level security|permission denied/i.test(msg)) {
    return "Kon je bijdrage niet plaatsen. Controleer of je nog deelnemer bent van dit event en probeer opnieuw.";
  }
  if (/mime type|not supported/i.test(msg)) {
    return "Dit bestandstype werkt niet. Gebruik een foto (JPG, PNG, HEIC of WebP) of video (MP4, MOV of WebM).";
  }
  if (/exceeded|too large/i.test(msg)) {
    return "Dit bestand is te groot. De limiet is 100 MB.";
  }
  return "Er ging iets mis bij het plaatsen. Probeer het opnieuw.";
}

/**
 * Eén tegel in de bijdrage-grid: foto, video (met play-badge) of tekst/link.
 * Toont een verwijder-knopje wanneer de kijker de bijdrage mag verwijderen
 * (eigen bijdrage of host).
 */
function ContributionTile({
  contribution: c,
  canDelete,
  onDelete,
}: {
  contribution: ContributionWithAuthor;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <View className="w-1/2 p-[3px]">
      <View
        className="bg-paper-warm overflow-hidden"
        style={{ aspectRatio: 1, borderRadius: 18 }}
      >
        {c.media_type === "video" && c.image_url ? (
          <>
            <Video
              source={{ uri: c.image_url }}
              style={{ width: "100%", height: "100%" }}
              resizeMode={ResizeMode.COVER}
              useNativeControls
              isMuted
            />
            <View
              pointerEvents="none"
              className="absolute top-2 left-2 bg-shell/70 px-2 py-0.5 flex-row items-center"
            >
              <Ionicons name="videocam" color={feed.text} size={11} />
            </View>
          </>
        ) : c.image_url ? (
          <Image
            source={{ uri: c.image_url }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-3">
            <Text className="text-ink text-sm" numberOfLines={4}>
              {c.caption ?? c.link_url ?? ""}
            </Text>
          </View>
        )}

        {canDelete && (
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            className="absolute top-2 right-2 w-7 h-7 bg-shell/70 items-center justify-center"
          >
            <Ionicons name="trash-outline" color={feed.text} size={14} />
          </Pressable>
        )}
      </View>
      <Text className="text-cream-muted text-[11px] mt-1 px-1" numberOfLines={1}>
        {c.author?.display_name ?? c.author?.username ?? "Onbekend"}
      </Text>
    </View>
  );
}

function StatRow({
  icon,
  label,
}: {
  icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View className="flex-row items-center">
      <Ionicons name={icon} color={feed.inkDim} size={14} />
      <Text className="text-ink-soft text-sm ml-2">{label}</Text>
    </View>
  );
}

/**
 * Eén cel in de actierij onder de hero. De cellen delen hun kaders, net als
 * de tegelrij in de feed: geen losse knoppen met tussenruimte maar één
 * doorlopende band.
 */
function ActionCell({
  label,
  icon,
  onPress,
  filled = false,
  disabled = false,
  last = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  filled?: boolean;
  disabled?: boolean;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: filled ? 1.3 : 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 16,
        backgroundColor: filled ? (pressed ? flameDeep : feed.ink) : "transparent",
        ...(last ? null : { borderRightWidth: FEED_BORDER, borderRightColor: feed.ink }),
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Ionicons name={icon} color={filled ? feed.text : feed.ink} size={15} />
      <Text
        style={[
          feedType.label,
          { fontSize: 13, fontWeight: "700", color: filled ? feed.text : feed.ink, marginLeft: 8 },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
