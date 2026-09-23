import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { DetailState } from "@/components/DetailState";
import { LincinScreen, vfade } from "@/components/lincin/Chrome";
import { CloseBox, DesktopShell, MonoLink, TopBar } from "@/components/lincin/desktop/Shell";
import {
  ContributionGrid,
  ContributionsHead,
  EventActions,
  EventEmpty,
  EventHero,
  EventNotice,
  EventSheet,
  type EventAction,
  type EventFacts,
  type Face,
} from "@/components/lincin/EventPage";
import { openLightbox } from "@/components/lincin/Lightbox";
import { listRsvps, setRsvp, type EventRsvp, type RsvpStatus } from "@/lib/api/event-rsvps";
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
import { color, friendColor, hueFor, RASTER, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { useHeroTag } from "@/lib/hero-transition";
import { humanizeError } from "@/lib/errors";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { plural } from "@/lib/plural";
import { safeBack, useBackTarget } from "@/lib/nav";
import { copyToClipboard } from "@/lib/share";
import { supabase } from "@/lib/supabase/client";
import { usePageTitle } from "@/lib/page-title";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { hhmm } from "@/lib/lincin/model";
import { useToast } from "@/lib/toast";

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };

export default function EventDetailScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const toast = useToast();
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  // De grote vorm alleen op desktop: op de telefoon staat de pagina in de
  // kolom van LincinScreen, ook op een tablet.
  const desktop = useIsDesktop();
  const wide = desktop;
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

  /** "Ik kom" / "Misschien" (0072), dezelfde antwoorden als op Events. */
  const rsvps = useQuery({
    queryKey: ["event-rsvps", [eventId]],
    queryFn: () => listRsvps([eventId]),
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

  async function onCopyInvite() {
    if (!event.data) return;
    const url = buildEventJoinUrl(event.data.join_code);
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }


  async function onAnswer(next: RsvpStatus | null) {
    const key = ["event-rsvps", [eventId]];
    const prev = qc.getQueryData<EventRsvp[]>(key) ?? [];
    const rest = prev.filter((r) => r.user_id !== myUserId);
    qc.setQueryData<EventRsvp[]>(key, next ? [...rest, { event_id: eventId, user_id: myUserId, status: next }] : rest);
    try {
      await setRsvp(eventId, myUserId, next);
      // Events toont hetzelfde antwoord; die lijst hoort het ook te weten.
      qc.invalidateQueries({ queryKey: ["event-rsvps"] });
    } catch (e: any) {
      qc.setQueryData(key, prev);
      toast.error(e?.message ?? t.failed);
    }
  }

  usePageTitle(event.data?.name ?? null);
  const back = useBackTarget(router, "/events");

  // Drie standen, geen één. Zolang dit `isLoading || !data` was, las een
  // verwijderd event en een mislukte query allebei als "laden…" — voor
  // altijd, en zonder terug-knop. Zie components/DetailState.tsx.
  if (event.isLoading || event.isError || !event.data) {
    // Ook laden en mislukken in de rail, zodat het scherm niet van vorm
    // wisselt zodra het event binnen is.
    if (desktop) {
      return (
        <DesktopShell active="events" mode="full">
          <TopBar left={<MonoLink label={`← ${back.label}`} active onPress={back.go} />} />
          <View style={{ padding: 24, gap: 12, alignItems: "flex-start" }}>
            <MonoLink
              on={false}
              label={event.isLoading ? t.loading : event.isError ? "Dit event kon niet laden." : "Dit event bestaat niet meer."}
            />
            {event.isError ? <MonoLink label={t.retry} active onPress={() => event.refetch()} /> : null}
          </View>
        </DesktopShell>
      );
    }
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
  const end = new Date(ev.ends_at);
  const locale = LOCALE[lang];
  const weekday = (d: Date) => d.toLocaleDateString(locale, { weekday: "short" }).replace(".", "");
  const sameDay = start.toDateString() === end.toDateString();
  const past = end.getTime() <= Date.now();
  const memberList = members.data ?? [];
  const nameOf = (userId: string) => {
    if (userId === myUserId) return t.me.toLowerCase();
    const m = memberList.find((x) => x.user_id === userId);
    return m?.profile?.display_name ?? m?.profile?.username ?? "linc";
  };
  const going = (rsvps.data ?? []).filter((r) => r.status === "yes").map((r) => nameOf(r.user_id));
  const mine = (rsvps.data ?? []).find((r) => r.user_id === myUserId)?.status ?? null;
  const facts: EventFacts = {
    title: ev.name,
    description: ev.description?.trim() || null,
    day: String(start.getDate()).padStart(2, "0"),
    month: start.toLocaleDateString(locale, { month: "short" }).replace(".", ""),
    when: sameDay ? `${weekday(start)} ${hhmm(ev.starts_at)}` : `${weekday(start)} — ${weekday(end)}`,
    date: `${start.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })} · ${hhmm(ev.starts_at)}`,
    host: ev.is_host ? t.me : nameOf(ev.host_user_id),
    place: ev.place?.trim() ?? "",
    status,
    live: ev.is_active,
    past,
    guests: ev.members_count,
    contributions: ev.contributions_count,
    open: ev.join_policy !== "closed",
    whoGo: going.length ? going.join(", ") : `${ev.members_count} ${ev.members_count === 1 ? "linc" : "lincs"}`,
    fill: friendColor(hueFor(ev.host_user_id), scheme),
  };
  const faces: Face[] = memberList.map((m) => ({
    id: m.user_id,
    name: m.profile?.display_name ?? m.profile?.username,
    avatarUrl: m.profile?.avatar_url,
  }));

  // Het beeld. `heroStyle` maakt hem het gedeelde element met de cover van
  // de eventkaart: op web morpht de browser het ene naar het andere. Zie
  // lib/hero-transition.
  const cover = ev.cover_url ? (
    <Pressable
      accessibilityRole="imagebutton"
      accessibilityLabel={ev.name}
      onPress={() => openLightbox({ uris: [ev.cover_url], author: ev.name, kind: "event", time: hhmm(ev.starts_at), title: ev.description ?? "" })}
      style={[{ width: "100%", height: "100%", ...heroStyle }, Platform.OS === "web" ? ({ cursor: "zoom-in" } as object) : null]}
    >
      <Image source={{ uri: ev.cover_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
    </Pressable>
  ) : null;

  // Wat je met dit event kunt doen. "Kopieer link" heette "Bewaren", met
  // een downloadpijl, en er werd niets bewaard. Wat de host instelt — wie
  // er binnen mag, wie er wacht — zit achter "Instellingen", met een teller
  // als er iemand wacht.
  const actions: EventAction[] = [
    { label: copied ? "Gekopieerd" : "Kopieer link", icon: "link-outline", onPress: onCopyInvite },
    { label: "Uitnodigen", icon: "qr-code-outline", onPress: onOpenInvite },
    ...(ev.is_host
      ? [{ label: pendingCount > 0 ? `Instellingen · ${pendingCount}` : "Instellingen", icon: "options-outline" as const, onPress: () => setSettingsOpen(true) }]
      : []),
    {
      label: uploadProgress ? `${uploadProgress.done} van ${uploadProgress.total}` : uploading ? "Bezig…" : "Voeg toe",
      icon: "add",
      onPress: () => setAddMenuOpen(true),
      primary: true,
      disabled: uploading,
    },
  ];

  const openPhoto = (c: ContributionWithAuthor) => {
    // Alle foto's van het event als diavoorstelling, vanaf deze.
    const photos = contribs.filter((x) => x.media_type !== "video" && x.image_url);
    openLightbox({
      uris: photos.map((x) => x.image_url),
      cacheKeys: photos.map((x) => x.image_path ?? undefined),
      index: photos.indexOf(c),
      author: c.author?.display_name ?? c.author?.username ?? "",
      kind: "foto",
      time: hhmm(c.created_at),
      title: ev.name,
    });
  };

  const body = (
    <EventSheet wide={wide}>
      <EventHero f={facts} wide={wide} cover={cover} faces={faces} onGuests={() => setGuestsOpen(true)} />
      <EventActions wide={wide} rsvp={past ? null : { mine, onAnswer }} actions={actions} />

      {error ? <EventNotice text={error} tone="red" /> : null}
      {/* Event-media is niet end-to-end versleuteld zoals je chats. */}
      <EventNotice text="Event-media is niet end-to-end versleuteld zoals je chats." />

      <ContributionsHead count={contribs.length} wide={wide} />
      {!revealed ? (
        <EventEmpty
          icon="lock-closed"
          title="Onthulling vergrendeld"
          body={`${
            ev.reveal === "after"
              ? "Foto's worden onthuld na afloop van het event."
              : ev.reveal === "delayed"
                ? `Foto's worden onthuld ${ev.reveal_delay_hours}u na afloop.`
                : "Foto's worden zichtbaar tijdens het event."
          } Toevoegen kan nu al: maak een foto met de camera, of kies foto's en video's uit je bibliotheek.`}
        />
      ) : contribs.length === 0 ? (
        <EventEmpty
          icon="images-outline"
          title="Nog niets toegevoegd"
          body={`Wees de eerste. Tik op "Voeg toe": maak een foto met de camera, of kies foto's en video's uit je bibliotheek.`}
        />
      ) : (
        <ContributionGrid
          items={contribs}
          wide={wide}
          canDelete={(c) => c.user_id === myUserId || ev.is_host}
          onDelete={onDeleteContribution}
          onOpen={openPhoto}
        />
      )}

      {/* De volledige gastenlijst. */}
      <ActionSheet
        visible={guestsOpen}
        onClose={() => setGuestsOpen(false)}
        title={`Gasten (${memberList.length})`}
        actions={memberList.map((m) => ({
          label: `${m.profile?.display_name ?? m.profile?.username ?? "Onbekend"}${m.role === "host" ? " · gastheer" : ""}`,
          icon: "person-outline" as const,
          onPress: () => {
            const handle = m.profile?.username;
            if (handle) router.push(`/user/${handle}`);
          },
        }))}
      />

      <AccessModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        policy={ev.join_policy}
        onPolicy={onChangeJoinPolicy}
        requests={joinRequests.data ?? []}
        onApprove={onApproveRequest}
        onDecline={onDeclineRequest}
      />

      <ActionSheet
        visible={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        title="Bijdrage toevoegen"
        subtitle="Maak een foto, of kies foto's en video's uit je bibliotheek."
        actions={[
          { label: "Maak een foto met de camera", icon: "camera-outline", onPress: onOpenCamera },
          { label: "Kies uit je foto's en video's", icon: "images-outline", onPress: () => pickFromGallery() },
          { label: "Voeg link toe", icon: "link-outline", onPress: onOpenLinkCompose },
        ]}
      />
    </EventSheet>
  );

  // Op het brede scherm staat een event in de Lincin-rail, net als de
  // vondsten en gesprekken die je daar opent. De inhoud is voor beide
  // vormen dezelfde; het thema bepaalt de vorm (components/lincin/EventPage).
  if (desktop) {
    return (
      <DesktopShell active="events" mode="full" tint={facts.fill.fill} tabTint={facts.fill.fill}>
        <TopBar
          left={
            <>
              <MonoLink label={`← ${back.label}`} active onPress={back.go} />
              <MonoLink numberOfLines={1} on={false} label={`Event · ${ev.name}`} />
            </>
          }
          right={<CloseBox label="Sluit" onPress={() => safeBack(router, "/events")} />}
        />
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      </DesktopShell>
    );
  }

  return (
    <LincinScreen tab="events" tint={facts.fill.fill} counter="Event" back="/events">
      <ScrollView style={[{ flex: 1 }, vfade()]} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {body}
      </ScrollView>
    </LincinScreen>
  );
}

/**
 * Beheer van de host: wie mag binnen, en wie wacht. Een blad in de vorm van
 * het thema: kader (kleur), tweede papier (magazine), tegel (modern).
 */
function AccessModal({
  visible,
  onClose,
  policy,
  onPolicy,
  requests,
  onApprove,
  onDecline,
}: {
  visible: boolean;
  onClose: () => void;
  policy: EventJoinPolicy;
  onPolicy: (p: EventJoinPolicy) => void;
  requests: EventJoinRequest[];
  onApprove: (r: EventJoinRequest) => void;
  onDecline: (r: EventJoinRequest) => void;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const ink = color("ink");
  const rule = th === "kleur" ? ink : color("ink", "postRule");
  const B = spec.border;
  const round = th === "modern";
  const label = (size: number, c: string) =>
    th === "magazine"
      ? { ...sans(500), fontSize: size, lineHeight: size + 4, letterSpacing: size * 0.2, textTransform: "uppercase" as const, color: c }
      : { ...mono(500), fontSize: size, lineHeight: size + 4, letterSpacing: size * 0.1, textTransform: "uppercase" as const, color: c };
  const btn = (text: string, onPress: () => void, filled: boolean, key?: string) => (
    <Pressable
      key={key ?? text}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        height: 36,
        paddingHorizontal: 14,
        justifyContent: "center",
        borderRadius: round || th === "magazine" ? 999 : 0,
        borderWidth: filled ? 0 : B,
        borderColor: rule,
        backgroundColor: filled ? ink : "transparent",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={label(9.5, filled ? color("paper") : ink)}>{text}</Text>
    </Pressable>
  );
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "center", padding: 18 }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(11,10,12,0.55)" }} />
        <View
          style={{
            width: "100%",
            maxWidth: 520,
            alignSelf: "center",
            backgroundColor: th === "magazine" ? color("paper2") : color("paper"),
            borderWidth: th === "kleur" ? B : 0,
            borderColor: ink,
            borderRadius: round ? RASTER.tileRadius : 0,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", padding: 18, borderBottomWidth: B, borderBottomColor: rule }}>
            <Text
              style={[
                th === "magazine" ? { ...serif(), fontSize: 30, lineHeight: 32 } : th === "modern" ? { ...sans(400), fontSize: 24, lineHeight: 28, letterSpacing: -0.7 } : { ...head(), fontSize: 26, lineHeight: 26 },
                { color: ink, flex: 1 },
              ]}
            >
              Toegang
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Sluiten" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" color={ink} size={20} />
            </Pressable>
          </View>

          <Text style={[th === "magazine" ? { ...serif(true), fontSize: 17, lineHeight: 23 } : { ...sans(400), fontSize: 13, lineHeight: 19 }, { color: color("ink", "inkDim"), padding: 18 }]}>
            {policy === "closed"
              ? "Gesloten: wie je link of QR gebruikt, komt eerst bij jou langs."
              : "Open: iedereen met je link of QR staat meteen in de gastenlijst."}
          </Text>

          <View style={{ flexDirection: "row", gap: round || th === "magazine" ? 6 : 0, paddingHorizontal: th === "kleur" ? 0 : 18, paddingBottom: th === "kleur" ? 0 : 18, borderTopWidth: th === "kleur" ? B : 0, borderTopColor: ink }}>
            {(["closed", "open"] as const).map((p, i) => {
              const on = policy === p;
              return (
                <Pressable
                  key={p}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  onPress={() => onPolicy(p)}
                  disabled={on}
                  style={({ pressed }) => ({
                    flex: 1,
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? ink : pressed ? color("ink", "postRule") : "transparent",
                    borderRadius: th === "kleur" ? 0 : 999,
                    borderWidth: th === "kleur" ? 0 : 1,
                    borderColor: on ? ink : rule,
                    ...(th === "kleur" && i > 0 ? { borderLeftWidth: B, borderLeftColor: ink } : null),
                  })}
                >
                  <Text style={label(10, on ? color("paper") : ink)}>{p === "closed" ? "Gesloten" : "Open"}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={{ borderTopWidth: B, borderTopColor: rule, paddingVertical: 8 }}>
            {requests.length ? (
              <>
                <Text style={[label(9.5, ink), { paddingHorizontal: 18, paddingVertical: 8 }]}>
                  {`${requests.length} ${requests.length === 1 ? "wacht" : "wachten"} op je`}
                </Text>
                {requests.map((r) => {
                  const name = r.profile?.display_name ?? r.profile?.username ?? "Onbekend";
                  return (
                    <View key={r.user_id} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 8, gap: 10 }}>
                      <Avatar name={name} avatarUrl={r.profile?.avatar_url ?? null} size="sm" tint="light" />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={[sans(500), { fontSize: 14, lineHeight: 18, color: ink }]}>
                          {name}
                        </Text>
                        {r.profile?.username ? (
                          <Text numberOfLines={1} style={label(9, color("ink", "inkDim"))}>
                            {`@${r.profile.username}`}
                          </Text>
                        ) : null}
                      </View>
                      {btn("Weiger", () => onDecline(r), false, `d-${r.user_id}`)}
                      {btn("Toelaten", () => onApprove(r), true, `a-${r.user_id}`)}
                    </View>
                  );
                })}
              </>
            ) : (
              <Text style={[label(9.5, color("ink", "inkDim")), { padding: 18, paddingVertical: 10 }]}>Geen openstaande verzoeken.</Text>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
