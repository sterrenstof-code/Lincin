import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import {
  contributeToEvent,
  eventStatusLabel,
  getEvent,
  listEventContributions,
  subscribeToEventContributions,
  buildEventJoinUrl,
} from "@/lib/api/events";
import { useAuth } from "@/lib/auth/provider";
import { safeBack } from "@/lib/nav";
import { copyToClipboard, shareText } from "@/lib/share";
import { supabase } from "@/lib/supabase/client";

const SCREEN_WIDTH = Math.min(Dimensions.get("window").width, 600);

export default function EventDetailScreen() {
  const router = useRouter();
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
      <SafeAreaView className="flex-1 bg-shell">
        <ScreenContainer>
          <View className="flex-1 items-center justify-center">
            <Text className="text-cream-soft">Event laden…</Text>
          </View>
        </ScreenContainer>
      </SafeAreaView>
    );
  }

  const ev = event.data;
  const contribs = contributions.data?.contributions ?? [];
  const revealed = contributions.data?.revealed ?? false;
  const status = eventStatusLabel(ev);
  const start = new Date(ev.starts_at);

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top", "left", "right"]}>
      <ScreenContainer>
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => safeBack(router, "/(app)/events")}
            className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
          >
            <Ionicons name="chevron-back" color="#1A1714" size={20} />
          </Pressable>
          <Text className="flex-1 text-cream text-lg font-semibold ml-3" numberOfLines={1}>
            {ev.name}
          </Text>
        </View>

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* Hero */}
          <View className="bg-paper rounded-3xl p-6">
            <Text className="text-4xl font-bold tracking-tight text-ink" numberOfLines={2}>
              {ev.name}
            </Text>
            {ev.description && (
              <Text className="text-ink-soft text-base mt-1 leading-6">
                {ev.description}
              </Text>
            )}

            <View className="mt-4 gap-2">
              <StatRow icon="time-outline" label={status} />
              <StatRow
                icon="calendar-outline"
                label={start.toLocaleString("nl-BE", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
              <StatRow
                icon="people-outline"
                label={`${ev.members_count} gasten`}
              />
              <StatRow
                icon="images-outline"
                label={`${ev.contributions_count} foto's`}
              />
            </View>

            {/* Action buttons row */}
            <View className="flex-row gap-2 mt-5">
              <Pressable
                onPress={onCopyInvite}
                className="flex-1 flex-row items-center justify-center bg-paper-warm active:bg-paper rounded-full px-3 py-3"
              >
                <Ionicons name="download-outline" color="#1A1714" size={16} />
                <Text className="text-ink font-semibold ml-1.5 text-sm">Save</Text>
              </Pressable>
              <Pressable
                onPress={onOpenInvite}
                className="flex-1 flex-row items-center justify-center bg-paper-warm active:bg-paper rounded-full px-3 py-3"
              >
                <Ionicons name="qr-code-outline" color="#1A1714" size={16} />
                <Text className="text-ink font-semibold ml-1.5 text-sm">Invite</Text>
              </Pressable>
              <Pressable
                onPress={() => setAddMenuOpen(true)}
                disabled={uploading}
                className="flex-row items-center justify-center bg-cream active:bg-cream-soft rounded-full px-5 py-3"
                style={{ flex: 1.4 }}
              >
                <Ionicons name="add" color="#1A1714" size={16} />
                <Text className="text-ink font-semibold ml-2 text-sm">
                  {uploading ? "Bezig…" : "Voeg toe"}
                </Text>
              </Pressable>
            </View>

            {copied && (
              <Text className="text-ink text-xs text-center mt-2">✓ Link gekopieerd</Text>
            )}
            {error && (
              <Text className="text-red-700 text-xs text-center mt-2">{error}</Text>
            )}
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
            <View className="mt-5 bg-paper-soft rounded-3xl p-6 items-center">
              <View className="w-14 h-14 rounded-full bg-paper-warm items-center justify-center mb-3">
                <Ionicons name="lock-closed" color="#1A1714" size={24} />
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
            <View className="mt-5 bg-paper-soft rounded-3xl p-6 items-center">
              <View className="w-14 h-14 rounded-full bg-paper-warm items-center justify-center mb-3">
                <Ionicons name="images-outline" color="#1A1714" size={24} />
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
                <View key={c.id} className="w-1/2 p-[3px]">
                  <View
                    className="bg-paper-warm overflow-hidden"
                    style={{ aspectRatio: 1, borderRadius: 18 }}
                  >
                    {c.image_url ? (
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
                  </View>
                  <Text className="text-cream-muted text-[11px] mt-1 px-1" numberOfLines={1}>
                    {c.author?.display_name ?? c.author?.username ?? "Onbekend"}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </ScreenContainer>
    </SafeAreaView>
  );
}

function humanizeContributeError(err: any): string {
  const msg = err?.message ?? String(err ?? "Onbekende fout");
  if (/row-level security|permission denied/i.test(msg)) {
    return "Toegang geweigerd. Run migratie 0019_event_storage_repair.sql in Supabase SQL Editor — die fixt de bucket-policies én voegt missing host-memberships toe.";
  }
  if (/mime type|not supported/i.test(msg)) {
    return "Bestandstype niet toegelaten. Foto's (JPG/PNG/HEIC/WebP) en video's (MP4/MOV/WebM) werken.";
  }
  if (/exceeded|too large/i.test(msg)) {
    return "Bestand te groot. Max 100 MB.";
  }
  return msg;
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
      <Ionicons name={icon} color="#5A4F40" size={14} />
      <Text className="text-ink-soft text-sm ml-2">{label}</Text>
    </View>
  );
}
