import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  groupPostReactions,
  listReactionsForPosts,
  togglePostReaction,
  type GroupedPostReaction,
  type PostReactionRow,
} from "@/lib/api/post-reactions";

/**
 * De emoji onder een stel bijdragen: één vraag voor allemaal, en een tik
 * die meteen zichtbaar is en pas daarna naar de server gaat.
 *
 * Gedeeld door de feed, het profiel en de bladzijde, zodat een reactie
 * overal hetzelfde telt en toggelt.
 */
export function usePostReactions(postIds: string[], myUserId: string) {
  const key = postIds.join(",");
  const q = useQuery({
    queryKey: ["post-reactions-batch", key],
    queryFn: () => listReactionsForPosts(postIds),
    enabled: postIds.length > 0,
    staleTime: 15_000,
  });
  const [overrides, setOverrides] = useState<Record<string, PostReactionRow[]>>({});
  useEffect(() => setOverrides({}), [q.data]);

  const rows = useMemo(() => {
    const m: Record<string, PostReactionRow[]> = {};
    for (const r of q.data ?? []) (m[r.post_id] ??= []).push(r);
    return { ...m, ...overrides };
  }, [q.data, overrides]);

  const toggle = useCallback(
    async (postId: string, emoji: string) => {
      const current = rows[postId] ?? [];
      const mine = current.some((r) => r.user_id === myUserId && r.emoji === emoji);
      const next = mine
        ? current.filter((r) => !(r.user_id === myUserId && r.emoji === emoji))
        : [...current, { post_id: postId, user_id: myUserId, emoji }];
      setOverrides((o) => ({ ...o, [postId]: next }));
      try {
        await togglePostReaction({ postId, userId: myUserId, emoji });
      } catch {
        setOverrides((o) => {
          const c = { ...o };
          delete c[postId];
          return c;
        });
      }
    },
    [rows, myUserId],
  );

  const grouped = useCallback(
    (postId: string): GroupedPostReaction[] => groupPostReactions(rows[postId] ?? [], myUserId),
    [rows, myUserId],
  );

  return { grouped, toggle, refetch: q.refetch };
}
