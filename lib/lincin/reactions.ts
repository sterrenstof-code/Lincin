import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  groupPostReactions,
  listReactionsForPosts,
  togglePostReaction,
  type GroupedPostReaction,
  type PostReactionRow,
} from "@/lib/api/post-reactions";
import {
  listReactionsForComments,
  toggleCommentReaction,
  type CommentReactionRow,
} from "@/lib/api/comment-reactions";

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

// ---------------------------------------------------------------
// Onder een comment (HANDOFF 2.1)
// ---------------------------------------------------------------

/**
 * De emoji onder de comments van één bijdrage: één vraag voor allemaal,
 * een tik die meteen zichtbaar is. Zelfde werkwijze als `usePostReactions`.
 */
export function useCommentReactions(commentIds: string[], myUserId: string) {
  const key = commentIds.join(",");
  const q = useQuery({
    queryKey: ["comment-reactions", key],
    queryFn: () => listReactionsForComments(commentIds),
    enabled: commentIds.length > 0,
    staleTime: 15_000,
  });
  const [overrides, setOverrides] = useState<Record<string, CommentReactionRow[]>>({});
  useEffect(() => setOverrides({}), [q.data]);

  const rows = useMemo(() => {
    const m: Record<string, CommentReactionRow[]> = {};
    for (const r of q.data ?? []) (m[r.comment_id] ??= []).push(r);
    return { ...m, ...overrides };
  }, [q.data, overrides]);

  const toggle = useCallback(
    async (commentId: string, emoji: string) => {
      const current = rows[commentId] ?? [];
      const on = current.some((r) => r.user_id === myUserId && r.emoji === emoji);
      const next = on
        ? current.filter((r) => !(r.user_id === myUserId && r.emoji === emoji))
        : [...current, { comment_id: commentId, user_id: myUserId, emoji }];
      setOverrides((o) => ({ ...o, [commentId]: next }));
      try {
        await toggleCommentReaction({ commentId, userId: myUserId, emoji, on });
      } catch {
        setOverrides((o) => ({ ...o, [commentId]: current }));
      }
    },
    [rows, myUserId],
  );

  /** Zelfde vorm als bij een bijdrage; volgorde = wie het eerst kwam. */
  const grouped = useCallback(
    (commentId: string): GroupedPostReaction[] => {
      const byEmoji = new Map<string, GroupedPostReaction>();
      for (const r of rows[commentId] ?? []) {
        const g = byEmoji.get(r.emoji) ?? { emoji: r.emoji, count: 0, userIds: [], mine: false };
        g.count++;
        g.userIds.push(r.user_id);
        if (r.user_id === myUserId) g.mine = true;
        byEmoji.set(r.emoji, g);
      }
      return Array.from(byEmoji.values());
    },
    [rows, myUserId],
  );

  return { grouped, toggle };
}
