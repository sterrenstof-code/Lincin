import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";

import { getProfiles, type Profile } from "@/lib/api/profiles";
import { uniqueTopic } from "@/lib/supabase/channel";
import { supabase } from "@/lib/supabase/client";

/**
 * Likes en emoji op een bijdrage — het Instagram-patroon (HANDOFF okt
 * 2026, "Likes & emoji-reacties op een bijdrage").
 *
 *   - Een like ís een ❤️: het hart en de ❤️ in de lade zijn hetzelfde.
 *   - Iemand kan meerdere emoji geven; nog eens tikken haalt hem weg.
 *   - De teller telt unieke personen die likete óf een emoji gaf. Oude
 *     emoji van buiten de zes van de lade tellen dus gewoon mee.
 *   - "Geliked door X en N anderen": X is jij als je reageerde, anders de
 *     meest recente. Het paneel: jij bovenaan, daarna op recentheid.
 *   - Alles optimistisch (meteen zichtbaar, terug bij een fout) en live:
 *     wie anders reageert terwijl de pagina openstaat, verschijnt meteen.
 *
 * Opgeslagen in `post_reactions` (post_id, user_id, emoji, created_at),
 * dezelfde tabel als voorheen; er is niets gemigreerd.
 */

export const LIKE = "❤️";
/** De lade: zes vaste emoji (HANDOFF). "Meer" opent de volledige keuze. */
export const DRAWER_EMOJI = ["❤️", "🥹", "🔥", "👏", "😂", "🎉"] as const;

type Row = { post_id: string; user_id: string; emoji: string; created_at: string };

export type Reactor = {
  userId: string;
  /** In de volgorde waarin hij ze gaf. */
  emojis: string[];
  /** Zijn laatste reactie. */
  latest: string;
  profile: Profile | null;
  me: boolean;
};

export function tick() {
  if (Platform.OS === "web") return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function usePostLikes(postId: string | undefined, myUserId: string) {
  const qc = useQueryClient();
  const key = ["post-likes", postId];
  const q = useQuery({
    queryKey: key,
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("post_reactions")
        .select("post_id, user_id, emoji, created_at")
        .eq("post_id", postId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
    staleTime: 10_000,
  });

  // Live: een nieuwe reactie komt binnen gefilterd op de bijdrage. Een
  // weggehaalde draagt (onder RLS) alleen zijn sleutel mee — die bevat de
  // post_id, dus daar kijken we zelf naar.
  useEffect(() => {
    if (!postId) return;
    const refetch = () => qc.invalidateQueries({ queryKey: ["post-likes", postId] });
    const ch = supabase
      .channel(uniqueTopic(`post-likes:${postId}`))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "post_reactions", filter: `post_id=eq.${postId}` }, refetch)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "post_reactions" }, (p) => {
        if ((p.old as { post_id?: string })?.post_id === postId) refetch();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [postId, qc]);

  // Optimistisch: wat jij net deed staat erbovenop tot de server antwoordt.
  const [override, setOverride] = useState<Row[] | null>(null);
  useEffect(() => setOverride(null), [q.data]);
  const rows = useMemo(() => override ?? q.data ?? [], [override, q.data]);

  const ids = useMemo(() => Array.from(new Set(rows.map((r) => r.user_id))), [rows]);
  const profiles = useQuery({
    queryKey: ["profiles", ...ids.slice().sort()],
    queryFn: () => getProfiles(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
  });

  const reactors = useMemo<Reactor[]>(() => {
    const byUser = new Map<string, Reactor>();
    const byId = new Map((profiles.data ?? []).map((p) => [p.id, p]));
    for (const r of rows) {
      const cur = byUser.get(r.user_id) ?? { userId: r.user_id, emojis: [], latest: r.created_at, profile: byId.get(r.user_id) ?? null, me: r.user_id === myUserId };
      if (!cur.emojis.includes(r.emoji)) cur.emojis.push(r.emoji);
      if (r.created_at > cur.latest) cur.latest = r.created_at;
      byUser.set(r.user_id, cur);
    }
    return Array.from(byUser.values()).sort((a, b) => (a.me !== b.me ? (a.me ? -1 : 1) : a.latest < b.latest ? 1 : -1));
  }, [rows, profiles.data, myUserId]);

  const mine = useMemo(() => new Set(rows.filter((r) => r.user_id === myUserId).map((r) => r.emoji)), [rows, myUserId]);

  const write = useCallback(
    async (emoji: string, on: boolean) => {
      if (!postId) return;
      const before = rows;
      const next = on
        ? [...rows, { post_id: postId, user_id: myUserId, emoji, created_at: new Date().toISOString() }]
        : rows.filter((r) => !(r.user_id === myUserId && r.emoji === emoji));
      setOverride(next);
      tick();
      const res = on
        ? await supabase.from("post_reactions").insert({ post_id: postId, user_id: myUserId, emoji })
        : await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", myUserId).eq("emoji", emoji);
      // Bestond hij al (dubbel getikt op twee toestellen), dan is dat goed.
      if (res.error && !(on && res.error.code === "23505")) setOverride(before);
      else qc.invalidateQueries({ queryKey: ["post-likes", postId] });
    },
    [rows, postId, myUserId, qc],
  );

  /** Het hart, of een emoji uit de lade: aan als hij uit stond, en andersom. */
  const toggle = useCallback((emoji: string) => write(emoji, !mine.has(emoji)), [write, mine]);
  /** Dubbeltik op de foto: altijd een like, nooit een unlike. */
  const like = useCallback(() => {
    if (!mine.has(LIKE)) write(LIKE, true);
  }, [write, mine]);

  return {
    reactors,
    /** Unieke personen die likete of een emoji gaf. */
    count: reactors.length,
    liked: mine.has(LIKE),
    mine,
    toggle,
    like,
    isLoading: q.isLoading,
  };
}

export type PostLikes = ReturnType<typeof usePostLikes>;
