import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ActionSheet } from "@/components/ActionSheet";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { Avatar } from "@/components/Avatar";
import { DetailState } from "@/components/DetailState";
import { useWide } from "@/components/Editorial";
import {
  approveEventJoinRequest,
  contributeToEvent,
  declineEventJoinRequest,
  deleteContribution,
  eventStatusLabel,
  getEvent,
  listEventContributions,
  listEventJoinRequests,
  listEventMembers,
  setEventJoinPolicy,
  subscribeToEventContributions,
  buildEventJoinUrl,
  type ContributionWithAuthor,
  type EventJoinPolicy,
  type EventJoinRequest,
} from "@/lib/api/events";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { useHeroTag } from "@/lib/hero-transition";
import { humanizeError } from "@/lib/errors";
import { plural } from "@/lib/plural";
import { safeBack } from "@/lib/nav";
import { copyToClipboard, shareText } from "@/lib/share";
import { supabase } from "@/lib/supabase/client";
import { creamOnDark, feed, FEED_BORDER, feedType, flameDeep, space } from "@/lib/design/type";
import { usePageTitle } from "@/lib/page-title";

export default function EventDetailScreen() {
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id!;
  // Zie useHeroTag: twee elementen met dezelfde naam laat de browser de
  // hele overgang overslaan.
  const heroStyle = useHeroTag(`event-${eventId}`);

  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guestsOpen, setGuestsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  /** Hoeveel van hoeveel, tijdens een reeks uploads. */
  const [uploadProgress, setUploadProgress] = useState<
    { done: number; total: number } | null
  >(null);
  /**
   * Of dit scherm er nog is.
   *
   * Een reeks van tien video's duurt lang genoeg om ondertussen weg te
   * navigeren, en dan schreef de lus zijn voortgang naar een onderdeel dat
   * niet meer bestond.
   */
  const cancelledRef = useRef(false);
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const event = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => getEvent(eventId, myUserId),
    refetchInterval: 30_000,
  });

  const contributions = useQuery({
    queryKey: ["event-contributions", eventId],
    queryFn: () => listEventContributions(eventId, myUserId),
  });

  /**
   * Openstaande toegangsverzoeken. De RPC geeft alleen rijen terug aan de
   * host, dus deze query is voor een gast simpelweg leeg — geen aparte
   * enable-voorwaarde nodig die pas klopt zodra `event` binnen is.
   */
  /** De gasten zelf — namen en gezichten, niet alleen een aantal. */
  const members = useQuery({
    queryKey: ["event-members", eventId],
    queryFn: () => listEventMembers(eventId),
    enabled: !!eventId,
  });

  const joinRequests = useQuery({
    queryKey: ["event-join-requests", eventId],
    queryFn: () => listEventJoinRequests(eventId),
    refetchInterval: 60_000,
  });

  /** Hoeveel mensen op je goedkeuring wachten — telt in de knop. */
  const pendingCount = (joinRequests.data ?? []).length;

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
      qc.invalidateQueries({ queryKey: ["event-join-requests", eventId] });
    }, [eventId, qc])
  );

  async function refreshAccess() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["event-join-requests", eventId] }),
      qc.invalidateQueries({ queryKey: ["event", eventId] }),
      qc.invalidateQueries({ queryKey: ["events", myUserId] }),
    ]);
  }

  async function onApproveRequest(request: EventJoinRequest) {
    setError(null);
    try {
      await approveEventJoinRequest(eventId, request.user_id);
      await refreshAccess();
    } catch (e: any) {
      setError(e?.message ?? "Kon het verzoek niet goedkeuren.");
    }
  }

  async function onDeclineRequest(request: EventJoinRequest) {
    const name =
      request.profile?.display_name ?? request.profile?.username ?? "Deze persoon";
    const ok = await confirm(
      "Verzoek weigeren?",
      `${name} krijgt geen toegang tot dit event. Er gaat geen bericht naar hen.`,
      { affirmativeLabel: "Weiger", destructive: true }
    );
    if (!ok) return;
    setError(null);
    try {
      await declineEventJoinRequest(eventId, request.user_id);
      await refreshAccess();
    } catch (e: any) {
      setError(e?.message ?? "Kon het verzoek niet weigeren.");
    }
  }

  async function onChangeJoinPolicy(policy: EventJoinPolicy) {
    setError(null);
    try {
      await setEventJoinPolicy(eventId, policy);
      await refreshAccess();
    } catch (e: any) {
      setError(e?.message ?? "Kon de toegang niet aanpassen.");
    }
  }

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

  /**
   * Uit je bibliotheek. Foto's én video's in dezelfde keuze, en meer dan
   * één tegelijk: na een middag samen kies je niet zes keer achter elkaar
   * één bestand.
   */
  async function pickFromGallery(mediaTypes: ("images" | "videos")[] = ["images", "videos"]) {
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
      allowsMultipleSelection: true,
      selectionLimit: 10,
    });
    if (result.canceled || result.assets.length === 0) return;

    /**
     * Tien foto's, en wat er gebeurde als er één omviel.
     *
     * De lus zat in één `try`. Er stond bij dat "een fout op de vierde de
     * eerste drie niet ongedaan mag maken" — dat klopte, maar het probleem
     * lag aan de andere kant: nummer vier gooide, de `catch` ving, en
     * nummer vijf tot en met tien werden nooit geprobeerd. Je koos tien
     * foto's, er kwamen er drie aan, en de melding zei alleen dat er iets
     * misging. Welke, en hoeveel er wél doorkwamen, stond nergens.
     *
     * Nu een `try` per bestand. De lus loopt af, en wat er daarna staat is
     * een telling in plaats van een vermoeden.
     *
     * En een teller terwijl het loopt, want dit is het enige in de app dat
     * honderd megabyte kan zijn: zonder dat is het verschil tussen "hij is
     * bezig" en "hij hangt" niet te zien. Geen bytes maar bestanden — de
     * voortgang ván één upload komt niet uit `contributeToEvent`, en "4 van
     * 10" zegt hier meer dan een balk die tien keer opnieuw begint.
     */
    setUploading(true);
    setUploadProgress({ done: 0, total: result.assets.length });
    setError(null);
    let failed = 0;
    for (const [i, asset] of result.assets.entries()) {
      try {
        await contributeToEvent({
          eventId,
          userId: myUserId,
          imageUri: asset.uri,
          mimeType:
            asset.mimeType ??
            (asset.type === "video" ? "video/mp4" : "image/jpeg"),
        });
      } catch (e: any) {
        failed += 1;
        // De eerste fout bepaalt de zin; de rest is meestal dezelfde
        // oorzaak, en drie keer hetzelfde onder elkaar helpt niemand.
        if (failed === 1) {
          setError(
            humanizeError(
              e,
              "event-contribute",
              "Er ging iets mis bij het plaatsen. Probeer het opnieuw."
            )
          );
        }
      }
      // `cancelledRef` en niet een gewone vlag: als je halverwege wegloopt
      // is dit onderdeel al ontkoppeld, en een `setState` daarna is een
      // update op iets wat er niet meer is.
      if (cancelledRef.current) return;
      setUploadProgress({ done: i + 1, total: result.assets.length });
    }

    const ok = result.assets.length - failed;
    if (failed > 0) {
      setError(
        (prev) =>
          `${plural(ok, "bestand", "bestanden")} toegevoegd, ${failed} niet. ` +
          (prev ?? "Probeer de rest opnieuw.")
      );
    }

    await qc.invalidateQueries({ queryKey: ["event-contributions", eventId] });
    await qc.invalidateQueries({ queryKey: ["event", eventId] });
    if (cancelledRef.current) return;
    setUploadProgress(null);
    setUploading(false);
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

  usePageTitle(event.data?.name ?? null);

  // Drie standen, geen één. Zolang dit `isLoading || !data` was, las een
  // verwijderd event en een mislukte query allebei als "laden…" — voor
  // altijd, en zonder terug-knop. Zie components/DetailState.tsx.
  if (event.isLoading || event.isError || !event.data) {
    return (
      <DetailState
        kind={event.isError ? "error" : event.isLoading ? "loading" : "missing"}
        subject="Dit event"
        error={event.error}
        onRetry={() => event.refetch()}
        backLabel="Alle events"
        onBack={() => safeBack(router, "/(app)/events")}
      />
    );
  }

  const ev = event.data;
  const contribs = contributions.data?.contributions ?? [];
  const revealed = contributions.data?.revealed ?? false;
  const status = eventStatusLabel(ev);
  const start = new Date(ev.starts_at);

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top", "left", "right"]}>
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        backLabel="Alle events"
        onBack={() => safeBack(router, "/(app)/events")}
        gutter={false}
        contentStyle={{ paddingBottom: 100 }}
      >
        <View>
          {/* ============ HERO ============
              Zelfde opbouw als de uitgelichte vondst in de feed: kicker en
              kop links, de feiten rechts, en het beeld eronder dat de rest
              van het scherm vult. Zie DESIGN.md §5, "Layout, top to
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
                  {`${plural(ev.members_count, "gast", "gasten")} · ${plural(
                    ev.contributions_count,
                    "bijdrage",
                    "bijdragen"
                  )}`}
                </Text>

                {/* En wie dat dan zijn. Een aantal zegt hoevéél mensen er
                    komen; de gezichten zeggen of jouw mensen erbij zijn, en
                    dat is wat je wil weten. */}
                {(members.data ?? []).length > 0 ? (
                  <Pressable
                    onPress={() => setGuestsOpen(true)}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      alignSelf: wide ? "flex-end" : "flex-start",
                      marginTop: space.sm,
                    }}
                  >
                    {(members.data ?? []).slice(0, 6).map((m, i) => (
                      <View key={m.user_id} style={{ marginLeft: i === 0 ? 0 : -space.sm }}>
                        <Avatar
                          name={m.profile?.display_name ?? m.profile?.username}
                          avatarUrl={m.profile?.avatar_url}
                          size="sm"
                          tint="light"
                        />
                      </View>
                    ))}
                    {(members.data ?? []).length > 6 ? (
                      <Text style={[feedType.label, { color: feed.ink, marginLeft: space.sm }]}>
                        {`+${(members.data ?? []).length - 6}`}
                      </Text>
                    ) : null}
                  </Pressable>
                ) : null}
                <Text
                  style={[
                    feedType.label,
                    { color: "#3A3540", lineHeight: 16, textAlign: wide ? "right" : "left" },
                  ]}
                >
                  {ev.join_policy === "closed"
                    ? "Gesloten · op goedkeuring"
                    : "Open · iedereen met de link"}
                </Text>
              </View>
            </View>

            {/* Het beeld vult de rest van de hero. `heroTag` maakt hem het
                gedeelde element met de cover van de eventkaart: op web morpht
                de browser het ene naar het andere. Zie lib/hero-transition. */}
            <View
              style={{
                width: "100%",
                aspectRatio: wide ? 16 / 7 : 4 / 3,
                borderWidth: FEED_BORDER,
                borderColor: feed.ink,
                backgroundColor: feed.postFill,
                ...heroStyle,
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

          {/* ============ ACTIES — één kader ============
              Alles wat je met dit event kunt doen staat in hetzelfde kader,
              op één rij van gelijke cellen. Wat de host instelt — wie er
              binnen mag, wie er staat te wachten — zat eerder als tweede
              omkaderd blok eronder; dat is beheer en geen actie, en het
              hoort dus niet in de leesrichting van de pagina. Het zit nu
              achter de laatste cel, met een teller als er iemand wacht. */}
          <View
            style={{
              marginHorizontal: wide ? space.xxxl : space.lg,
              marginTop: space.xl,
              borderWidth: FEED_BORDER,
              borderColor: feed.ink,
              flexDirection: "row",
            }}
          >
            {/* Heette "Bewaren", met een downloadpijl ernaast, en kopieerde
                de uitnodigingslink naar je klembord. Drie keer hetzelfde
                misverstand: het woord, het icoon, en het feit dat er
                helemaal niets bewaard wordt. */}
            <ActionCell label="Kopieer link" onPress={onCopyInvite} icon="link-outline" />
            <ActionCell label="Uitnodigen" onPress={onOpenInvite} icon="qr-code-outline" />
            {ev.is_host ? (
              <ActionCell
                label={
                  pendingCount > 0 ? `Instellingen · ${pendingCount}` : "Instellingen"
                }
                onPress={() => setSettingsOpen(true)}
                icon="options-outline"
              />
            ) : null}
            <ActionCell
              label={
                uploadProgress
                  ? `${uploadProgress.done} van ${uploadProgress.total}`
                  : uploading
                    ? "Bezig…"
                    : "Voeg toe"
              }
              onPress={() => setAddMenuOpen(true)}
              icon="add"
              filled
              disabled={uploading}
              last
            />
          </View>

          {copied ? (
            <Text
              style={[
                feedType.label,
                { color: flameDeep, textAlign: "center", paddingTop: space.md },
              ]}
            >
              Link gekopieerd
            </Text>
          ) : null}
          {error ? (
            <Text
              style={[
                feedType.label,
                { color: flameDeep, textAlign: "center", paddingTop: space.md },
              ]}
            >
              {error}
            </Text>
          ) : null}

          {/* Privacy note: event media is not end-to-end encrypted like chats. */}
          <View className="flex-row items-center justify-center mt-3 px-4">
            <Ionicons name="information-circle-outline" color={feed.inkDim} size={13} />
            <Text className="text-ink-muted text-[11px] ml-1.5 text-center">
              Event-media is niet end-to-end versleuteld zoals je chats.
            </Text>
          </View>

          {/* De volledige gastenlijst. */}
          <ActionSheet
            visible={guestsOpen}
            onClose={() => setGuestsOpen(false)}
            title={`Gasten (${(members.data ?? []).length})`}
            actions={(members.data ?? []).map((m) => ({
              label: `${m.profile?.display_name ?? m.profile?.username ?? "Onbekend"}${
                m.role === "host" ? " · gastheer" : ""
              }`,
              icon: "person-outline" as const,
              onPress: () => {
                const handle = m.profile?.username;
                if (handle) router.push(`/user/${handle}`);
              },
            }))}
          />

          {/* Beheer van de host: wie mag binnen, en wie wacht. */}
          <Modal
            visible={settingsOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setSettingsOpen(false)}
          >
            <View style={{ flex: 1, justifyContent: "center" }}>
              <Pressable
                onPress={() => setSettingsOpen(false)}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(11,10,12,0.55)",
                }}
              />
              <View
                style={{
                  width: "100%",
                  maxWidth: 520,
                  alignSelf: "center",
                  marginHorizontal: space.lg,
                  backgroundColor: feed.lav,
                  borderWidth: FEED_BORDER,
                  borderColor: feed.ink,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingHorizontal: space.lg,
                    paddingVertical: space.lg,
                    borderBottomWidth: FEED_BORDER,
                    borderBottomColor: feed.ink,
                  }}
                >
                  <Text
                    style={[
                      feedType.kicker,
                      { color: flameDeep, letterSpacing: 0.55, flex: 1 },
                    ]}
                  >
                    TOEGANG
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sluiten"
                    onPress={() => setSettingsOpen(false)} hitSlop={8}>
                    <Ionicons name="close" color={feed.ink} size={20} />
                  </Pressable>
                </View>

                <View style={{ paddingHorizontal: space.lg, paddingVertical: space.lg }}>
                  <Text
                    style={[feedType.body, { fontSize: 13, lineHeight: 19, color: feed.inkDim }]}
                  >
                    {ev.join_policy === "closed"
                      ? "Gesloten: wie je link of QR gebruikt, komt eerst bij jou langs."
                      : "Open: iedereen met je link of QR staat meteen in de gastenlijst."}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    borderTopWidth: FEED_BORDER,
                    borderTopColor: feed.ink,
                  }}
                >
                  <PolicyCell
                    label="Gesloten"
                    active={ev.join_policy === "closed"}
                    onPress={() => onChangeJoinPolicy("closed")}
                  />
                  <PolicyCell
                    label="Open"
                    active={ev.join_policy === "open"}
                    onPress={() => onChangeJoinPolicy("open")}
                    last
                  />
                </View>

                {pendingCount > 0 ? (
                  <View style={{ borderTopWidth: FEED_BORDER, borderTopColor: feed.ink }}>
                    <View
                      style={{
                        paddingHorizontal: space.lg,
                        paddingTop: space.md,
                        paddingBottom: space.sm,
                      }}
                    >
                      <Text style={[feedType.kicker, { color: feed.ink, letterSpacing: 0.55 }]}>
                        {`${pendingCount} WACHT${pendingCount === 1 ? "" : "EN"} OP JE`}
                      </Text>
                    </View>
                    {(joinRequests.data ?? []).map((request) => (
                      <JoinRequestRow
                        key={request.user_id}
                        request={request}
                        onApprove={() => onApproveRequest(request)}
                        onDecline={() => onDeclineRequest(request)}
                      />
                    ))}
                  </View>
                ) : (
                  <View
                    style={{
                      borderTopWidth: FEED_BORDER,
                      borderTopColor: feed.ink,
                      paddingHorizontal: space.lg,
                      paddingVertical: space.lg,
                    }}
                  >
                    <Text style={[feedType.label, { color: feed.inkDim }]}>
                      Geen openstaande verzoeken.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </Modal>

          <ActionSheet
            visible={addMenuOpen}
            onClose={() => setAddMenuOpen(false)}
            title="Bijdrage toevoegen"
            subtitle="Maak een foto, of kies foto's en video's uit je bibliotheek."
            actions={[
              {
                label: "Maak een foto met de camera",
                icon: "camera-outline",
                onPress: onOpenCamera,
              },
              {
                label: "Kies uit je foto's en video's",
                icon: "images-outline",
                onPress: () => pickFromGallery(),
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
                {"\n"}Toevoegen kan nu al: maak een foto met de camera, of kies
                foto's en video's uit je bibliotheek.
              </Text>
            </View>
          ) : contribs.length === 0 ? (
            <View className="mt-5 bg-paper-soft p-6 items-center">
              <View className="w-14 h-14 bg-paper-warm items-center justify-center mb-3">
                <Ionicons name="images-outline" color={feed.ink} size={24} />
              </View>
              <Text className="text-ink font-semibold text-base mb-1">
                Nog niets toegevoegd
              </Text>
              <Text className="text-ink-soft text-sm text-center leading-5">
                Wees de eerste. Tap "Voeg toe" bovenaan: maak een foto met de
                camera, of kies foto's en video's uit je bibliotheek.
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
      </PageScroll>
    </SafeAreaView>
  );
}

/** Eén helft van de open/gesloten-schakelaar. Dezelfde vorm als de actierij. */
function PolicyCell({
  label,
  active,
  onPress,
  last = false,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={active}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: "center",
        paddingVertical: 13,
        backgroundColor: active ? feed.ink : pressed ? feed.panel : "transparent",
        ...(last ? null : { borderRightWidth: FEED_BORDER, borderRightColor: feed.ink }),
      })}
    >
      <Text
        style={[
          feedType.label,
          { fontSize: 12, fontWeight: "700", color: active ? creamOnDark.DEFAULT : feed.ink },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Eén openstaand toegangsverzoek: wie het is, en de twee knoppen. */
function JoinRequestRow({
  request,
  onApprove,
  onDecline,
}: {
  request: EventJoinRequest;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const name =
    request.profile?.display_name ?? request.profile?.username ?? "Onbekend";

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 18,
        paddingVertical: 12,
      }}
    >
      <Avatar
        name={name}
        avatarUrl={request.profile?.avatar_url ?? null}
        size="sm"
        tint="light"
      />
      <View style={{ flex: 1, paddingHorizontal: 12 }}>
        <Text
          style={[feedType.label, { fontSize: 13, fontWeight: "700", color: feed.ink }]}
          numberOfLines={1}
        >
          {name}
        </Text>
        {request.profile?.username ? (
          <Text style={[feedType.label, { color: feed.inkDim, marginTop: 2 }]} numberOfLines={1}>
            {`@${request.profile.username}`}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onDecline}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginRight: 8,
          borderWidth: FEED_BORDER,
          borderColor: feed.ink,
          backgroundColor: pressed ? feed.panel : "transparent",
        })}
      >
        <Text style={[feedType.label, { fontSize: 12, color: feed.ink }]}>Weiger</Text>
      </Pressable>
      <Pressable
        onPress={onApprove}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: pressed ? flameDeep : feed.ink,
        })}
      >
        <Text style={[feedType.label, { fontSize: 12, fontWeight: "700", color: creamOnDark.DEFAULT }]}>
          Toelaten
        </Text>
      </Pressable>
    </View>
  );
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
        // Alles in dit systeem is vierkant (§7); dit was de enige ronding
        // op de pagina.
        style={{ aspectRatio: 1 }}
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
              <Ionicons name="videocam" color={creamOnDark.DEFAULT} size={11} />
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
            accessibilityRole="button"
            accessibilityLabel="Bijdrage verwijderen"
            onPress={onDelete}
            hitSlop={8}
            className="absolute top-2 right-2 w-7 h-7 bg-shell/70 items-center justify-center"
          >
            <Ionicons name="trash-outline" color={creamOnDark.DEFAULT} size={14} />
          </Pressable>
        )}
      </View>
      <Text className="text-ink-muted text-[11px] mt-1 px-1" numberOfLines={1}>
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
  const { width } = useWindowDimensions();
  /**
   * Onder de 520 punten staat het label ónder het icoon.
   *
   * Vier cellen naast elkaar met icoon en tekst op één regel vroeg meer
   * breedte dan er was. En omdat de cel geen `minWidth: 0` had, mocht de
   * tekst niet krimpen: hij liep gewoon door over de scheidingslijn heen,
   * de buurcel in. Dat is wat je zag — geen tekst die te lang was, maar een
   * cel die weigerde smaller te worden dan zijn inhoud.
   *
   * Gestapeld krijgt elk woord de volle celbreedte in plaats van de helft.
   */
  const stacked = width < 520;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: filled ? 1.3 : 1,
        // Zonder dit weigert een flex-kind smaller te worden dan zijn
        // inhoud, en dan helpt afkappen niets.
        minWidth: 0,
        flexDirection: stacked ? "column" : "row",
        alignItems: "center",
        justifyContent: "center",
        gap: stacked ? 5 : 0,
        paddingVertical: stacked ? 12 : 16,
        paddingHorizontal: 6,
        backgroundColor: filled ? (pressed ? flameDeep : feed.ink) : "transparent",
        ...(last ? null : { borderRightWidth: FEED_BORDER, borderRightColor: feed.ink }),
        opacity: disabled ? 0.5 : 1,
      })}
    >
      <Ionicons name={icon} color={filled ? creamOnDark.DEFAULT : feed.ink} size={stacked ? 17 : 15} />
      <Text
        numberOfLines={1}
        style={[
          feedType.label,
          {
            fontSize: stacked ? 11 : 13,
            fontWeight: "700",
            color: filled ? creamOnDark.DEFAULT : feed.ink,
            marginLeft: stacked ? 0 : 8,
            flexShrink: 1,
            textAlign: "center",
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
