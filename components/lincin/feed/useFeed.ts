import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";


import type { PrivateTarget } from "@/components/lincin/PrivateSheet";
import { listMyFriendships } from "@/lib/api/friends";
import { listUnifiedFeed, type FeedItem } from "@/lib/api/posts";
import { useAuth } from "@/lib/auth/provider";
import { useLang, useT, type Dict } from "@/lib/i18n";
import { openPost as openPostAnywhere, openProfile as openProfileAnywhere, useIsDesktop } from "@/lib/lincin/desktop";
import { useHueChoices } from "@/lib/design/theme";
import { groupByFriend, groupByTime, numberMap, toCardPost, type CardPost, type FriendGroup } from "@/lib/lincin/model";
import { isFriendOpen, setFriendOpen, setFriendsOpen, setPref, usePrefs, type FeedView } from "@/lib/lincin/prefs";
import { usePostReactions } from "@/lib/lincin/reactions";
import { markSeen, useSeenPosts } from "@/lib/read-state";

/**
 * Wat élke feed nodig heeft, ongeacht het thema (HANDOFF §Themes: "all
 * three consume the same posts / friends query").
 *
 *   - de bijdragen van je vrienden als kaarten, per vriend en op tijd
 *   - de reacties (één vraag voor allemaal, optimistisch)
 *   - wat je al zag
 *   - de weergave (per vriend | op tijd), per gebruiker onthouden
 *   - de handelingen: openen, naar een profiel, een bericht
 *
 * De twee lay-outs — `FeedKleur` en `FeedMagazine` — tekenen
 * hier elk hun eigen blad omheen.
 */

export type { FeedView } from "@/lib/lincin/prefs";

export function useFeed() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const desktop = useIsDesktop();

  // ---- de weergave en wie er open staat: per gebruiker, ook op de server ----
  const prefs = usePrefs(myUserId);
  /**
   * Editie bestaat alleen op desktop; daar is hij ook de standaard. Een
   * telefoon die "editie" erft van desktop toont Per vriend.
   */
  const stored = prefs.feedView ?? (desktop ? "editie" : "friends");
  const view: FeedView = !desktop && stored === "editie" ? "friends" : stored;
  const changeView = useCallback((v: FeedView) => setPref(myUserId, "feedView", v), [myUserId]);

  /**
   * Ingeklapt of open (HANDOFF 23 sep): STANDAARD STAAT ELKE VRIEND
   * INGEKLAPT — naam, status en de titels van zijn bijdragen. Een tik opent
   * de tegels, en die keuze blijft staan (`prefs.openFriends`), ook op een
   * ander toestel. "Bijdragen staan open" in Instellingen draait de
   * standaard om.
   */
  const isOpen = useCallback((key: string) => isFriendOpen(prefs, key), [prefs]);
  const toggleOpen = useCallback(
    (key: string) => setFriendOpen(myUserId, key, !isFriendOpen(prefs, key)),
    [myUserId, prefs],
  );
  const setAllOpen = useCallback((keys: string[], open: boolean) => setFriendsOpen(myUserId, keys, open), [myUserId]);

  // ---- gegevens ----
  const feed = useQuery({
    queryKey: ["unified-feed", myUserId],
    queryFn: () => listUnifiedFeed(myUserId),
    refetchOnWindowFocus: true,
  });
  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
    staleTime: 60_000,
  });
  const friendCount = (friendships.data ?? []).filter((f) => f.status === "accepted").length;

  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] });
    }, [qc, myUserId]),
  );

  // Je eigen bijdragen staan er ook tussen, onder "Jij" — in elke weergave
  // en elk thema. Ze tellen nooit als nieuw en je stuurt jezelf geen bericht.
  const cards = useMemo(() => ownCards(feed.data, t, myUserId), [feed.data, t, myUserId]);
  const isMine = useCallback((authorId: string) => authorId === myUserId, [myUserId]);
  // De kleur van een groep volgt jouw keuze per persoon (hueFor).
  const hueChoices = useHueChoices();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => groupByFriend(cards), [cards, hueChoices]);
  const timeGroups = useMemo(() => groupByTime(cards, t, lang), [cards, t, lang]);
  /** Nieuwste eerst, over alle vrienden heen. */
  const byTime = useMemo(() => [...cards].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [cards]);
  /**
   * Het hero van magazine: de foto waar de laatste maand het meest mee
   * gedaan is (comments, emoji, duwen). Bij gelijkstand de nieuwste. Geen
   * foto in de feed: de nieuwste bijdrage.
   */
  const heroPost = useMemo(() => {
    const photos = byTime.filter((c) => c.media.kind === "foto" && !c.media.video);
    if (!photos.length) return byTime[0];
    return photos.reduce((best, c) => (c.monthInteractions > best.monthInteractions ? c : best), photos[0]);
  }, [byTime]);
  /**
   * Het nummer van een bijdrage: "№ 01" is de oudste in de feed, zoals het
   * prototype zijn bijdragen telt. Magazine zet het in de inhoudsopgave.
   */
  const numberOf = useMemo(() => {
    const m = numberMap(cards);
    return (id: string) => m.get(id) ?? "—";
  }, [cards]);

  // ---- reacties: één vraag voor de hele feed, optimistisch bijgewerkt ----
  const postIds = useMemo(() => cards.filter((c) => c.reactable).map((c) => c.id), [cards]);
  const reactions = usePostReactions(postIds, myUserId);

  // ---- gelezen ----
  const { isSeen } = useSeenPosts();
  /**
   * Gezien: wat er al stond bij je vorige bezoek, wat je opende of voorbij
   * scrolde, en alles wat je zelf maakte.
   */
  const seen = useMemo(
    () => new Set(cards.filter((c) => c.authorId === myUserId || isSeen(c.id, c.createdAt)).map((c) => c.id)),
    [isSeen, cards, myUserId],
  );
  const fresh = useMemo(() => cards.filter((c) => !seen.has(c.id)).length, [cards, seen]);

  /**
   * Nieuw en Gezien (HANDOFF 23 sep): twee groepen, nieuwe vrienden eerst.
   *
   * Een vriend blijft tijdens een bezoek in de groep waar hij begon: wie een
   * bijdrage opent of voorbij scrolt, springt niet onder je vinger naar
   * Gezien. Hij verhuist pas bij "Markeer als gelezen", of bij het volgende
   * bezoek. Komt er iets nieuws bij, dan gaat hij wél naar Nieuw.
   */
  const placed = useRef(new Map<string, { isNew: boolean; fresh: number }>());
  const [placeTick, setPlaceTick] = useState(0);
  const sections = useMemo(() => {
    const neu: FriendGroup[] = [];
    const old: FriendGroup[] = [];
    for (const g of groups) {
      const n = g.posts.filter((p) => !seen.has(p.id)).length;
      const was = placed.current.get(g.key);
      const isNew = was ? was.isNew || n > was.fresh : n > 0;
      placed.current.set(g.key, { isNew, fresh: Math.max(n, was && !was.isNew ? 0 : was?.fresh ?? 0) });
      (isNew ? neu : old).push(g);
    }
    return { neu, old };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups, seen, placeTick]);
  const freshIn = useCallback((g: FriendGroup) => g.posts.filter((p) => !seen.has(p.id)), [seen]);
  const markAllRead = useCallback(() => {
    for (const g of sections.neu) {
      for (const p of g.posts) markSeen(p.id);
      placed.current.set(g.key, { isNew: false, fresh: 0 });
    }
    setPlaceTick((n) => n + 1);
  }, [sections]);

  const refresh = useCallback(
    () => Promise.all([qc.invalidateQueries({ queryKey: ["unified-feed", myUserId] }), reactions.refetch()]),
    [qc, myUserId, reactions],
  );

  // ---- handelingen ----
  const [sheet, setSheet] = useState<PrivateTarget | null>(null);
  // Op een telefoon een scherm, op desktop het paneel rechts (lib/lincin/desktop.ts).
  const openPost = useCallback((p: CardPost) => {
    if (!p.href) return;
    markSeen(p.id);
    // Een poll heeft zijn eigen bladzijde (app/poll/[id].tsx).
    if (p.kind === "poll") router.push(p.href as never);
    else openPostAnywhere(p.id);
  }, [router]);
  const openProfile = useCallback(
    (g: { username: string | null; authorId?: string }) => {
      // Ook je eigen naam opent je profiel — de pagina die je vrienden zien,
      // met al je bijdragen. Zonder gebruikersnaam: Jij.
      if (g.username) openProfileAnywhere(g.username);
      else if (g.authorId === myUserId) router.push("/profile");
    },
    [myUserId, router],
  );
  const privateAbout = useCallback((g: { authorId: string; name: string }, p?: CardPost) => {
    if (g.authorId === myUserId) return;
    setSheet({
      friendId: g.authorId,
      friendName: g.name,
      quote: p ? p.caption || p.title : undefined,
      // Alleen een bijdrage kan als verwijzing mee; een poll niet.
      postId: p?.href && p.kind !== "poll" ? p.id : undefined,
      postTitle: p?.title,
    });
  }, [myUserId]);
  const compose = useCallback(() => router.push("/post-compose"), [router]);

  const empty = !feed.isLoading && cards.length === 0;

  return {
    myUserId,
    t,
    lang,
    router,
    view,
    changeView,
    feed,
    friendCount,
    cards,
    groups,
    timeGroups,
    byTime,
    heroPost,
    isOpen,
    toggleOpen,
    setAllOpen,
    sections,
    freshIn,
    markAllRead,
    desktop,
    numberOf,
    reactions,
    seen,
    fresh,
    refresh,
    sheet,
    setSheet,
    openPost,
    openProfile,
    privateAbout,
    isMine,
    compose,
    empty,
  };
}

export type Feed = ReturnType<typeof useFeed>;

/**
 * Eén bijdrage uit dezelfde feed als de rasters: het nummer ("07") en de
 * kaart (naam van de auteur, soort). De bladzijde en de paneelkop lezen
 * dit; ze keken eerst alleen in de cache, en bij een rechtstreekse URL is
 * die leeg — dan stond er "BIJDRAGE · FOTO" zonder nummer. Dezelfde
 * sleutel als `useFeed`, dus de feed wordt hooguit één keer opgehaald.
 */
export function useFeedCard(id: string | undefined) {
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";
  const t = useT();
  const feed = useQuery({
    queryKey: ["unified-feed", myUserId],
    queryFn: () => listUnifiedFeed(myUserId),
    enabled: !!myUserId,
    staleTime: 30_000,
  });
  return useMemo(() => {
    const cards = ownCards(feed.data, t, myUserId);
    const card = id ? cards.find((c) => c.id === id) ?? null : null;
    return { card, number: id ? numberMap(cards).get(id) ?? null : null };
  }, [feed.data, t, myUserId, id]);
}

/** Alle kaarten van de feed; die van jezelf onder de naam "Jij". */
function ownCards(items: FeedItem[] | undefined, t: Dict, myUserId: string): CardPost[] {
  return (items ?? [])
    .map((i) => toCardPost(i, t))
    .filter((c): c is CardPost => !!c)
    .map((c) => (c.authorId === myUserId ? { ...c, authorName: t.me, initial: t.me.slice(0, 1).toUpperCase() } : c));
}
