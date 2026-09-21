import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";


import type { PrivateTarget } from "@/components/lincin/PrivateSheet";
import { listMyFriendships } from "@/lib/api/friends";
import { listUnifiedFeed, type FeedItem } from "@/lib/api/posts";
import { useAuth } from "@/lib/auth/provider";
import { useLang, useT, type Dict } from "@/lib/i18n";
import { openPost as openPostAnywhere, openProfile as openProfileAnywhere } from "@/lib/lincin/desktop";
import { useHueChoices } from "@/lib/design/theme";
import { groupByFriend, groupByTime, numberMap, toCardPost, type CardPost } from "@/lib/lincin/model";
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

type FeedView = "friends" | "time";

export function useFeed() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();

  // ---- de weergave: per vriend of op tijd, onthouden per gebruiker ----
  const viewKey = `lincin.feed.view.${myUserId}`;
  const [view, setView] = useState<FeedView>("friends");
  useEffect(() => {
    AsyncStorage.getItem(viewKey)
      .then((v) => {
        if (v === "friends" || v === "time") setView(v);
      })
      .catch(() => {});
  }, [viewKey]);
  const changeView = useCallback(
    (v: FeedView) => {
      setView(v);
      AsyncStorage.setItem(viewKey, v).catch(() => {});
    },
    [viewKey],
  );

  /**
   * Ingeklapt: welke vrienden je klein houdt, onthouden per gebruiker.
   *
   * STANDAARD STAAT ALLES UITGEKLAPT. `{}` betekent: niemand ingeklapt.
   * Alleen een vriend die je zelf dichtklapte staat in de lijst, en die
   * keuze komt terug bij het volgende bezoek. Klap je iedereen in, dan is
   * de feed een gekleurde lijst van je vrienden.
   *
   * Twee dingen die eerder niet klopten:
   *
   * 1. Het bewaren gebeurde ín de `setState`-functie. Die hoort zuiver te
   *    zijn — React mag hem twee keer aanroepen of zijn uitkomst weggooien,
   *    en dan schreven we een staat weg die nooit op het scherm kwam. Het
   *    schrijven staat nu in een effect dat de staat volgt.
   * 2. Het lezen kon een keuze overschrijven die je net had gemaakt: klapte
   *    je iets dicht vóórdat de opslag antwoordde, dan won de opslag. Nu
   *    wint jouw tik — dezelfde regel als bij het thema.
   */
  const collapsedKey = `lincin.feed.collapsed.${myUserId}`;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  /** Heb je in deze sessie zelf iets in- of uitgeklapt? */
  const collapseTouched = useRef(false);
  /** Heeft de opslag geantwoord? Pas daarna mogen we erin schrijven. */
  const collapseLoaded = useRef(false);

  useEffect(() => {
    let alive = true;
    collapseTouched.current = false;
    collapseLoaded.current = false;
    AsyncStorage.getItem(collapsedKey)
      .then((raw) => {
        if (!alive) return;
        if (raw && !collapseTouched.current) {
          try {
            setCollapsed(JSON.parse(raw) as Record<string, boolean>);
          } catch {
            // Onleesbaar bewaard? Dan begint hij gewoon uitgeklapt.
          }
        }
        collapseLoaded.current = true;
      })
      .catch(() => {
        collapseLoaded.current = true;
      });
    return () => {
      alive = false;
    };
  }, [collapsedKey]);

  // Bewaren zodra de staat verandert — maar nooit vóór het lezen klaar is,
  // anders overschrijft de lege beginstaat wat er al lag.
  useEffect(() => {
    if (!collapseLoaded.current) return;
    AsyncStorage.setItem(collapsedKey, JSON.stringify(collapsed)).catch(() => {});
  }, [collapsed, collapsedKey]);

  const toggleCollapsed = useCallback((key: string) => {
    collapseTouched.current = true;
    setCollapsed((c) => {
      const next = { ...c };
      if (next[key]) delete next[key];
      else next[key] = true;
      return next;
    });
  }, []);

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
  const { seen: seenPosts } = useSeenPosts();
  /** Gelezen: wat je opende of voorbij scrolde, en alles wat je zelf maakte. */
  const seen = useMemo(() => {
    const own = cards.filter((c) => c.authorId === myUserId).map((c) => c.id);
    return own.length ? new Set([...seenPosts, ...own]) : seenPosts;
  }, [seenPosts, cards, myUserId]);
  const fresh = useMemo(() => cards.filter((c) => !seen.has(c.id)).length, [cards, seen]);

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
    collapsed,
    toggleCollapsed,
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
