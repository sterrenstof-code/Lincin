import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  addEntityComment,
  deleteEntityComment,
  hideEntityComment,
  listEntityComments,
  listHiddenCommentIds,
  reportEntityComment,
  type EntityComment,
  type EntityType,
} from "@/lib/api/entity-comments";
import { clearMyCommentReactions, listReactionsForComments, toggleCommentReaction, type CommentReactionRow } from "@/lib/api/comment-reactions";
import { getProfiles, type Profile } from "@/lib/api/profiles";
import { setPref, usePrefs, type CommentSort } from "@/lib/lincin/prefs";
import { uniqueTopic } from "@/lib/supabase/channel";
import { supabase } from "@/lib/supabase/client";

import { LIKE, tick } from "./likes";

/**
 * De reacties onder een bijdrage of poll — HANDOFF okt 2026, "Reacties" en
 * "Gesprekken binnen één reactie".
 *
 *   - Hoofdreacties nieuwste eerst (of oudste: per gebruiker onthouden),
 *     twintig tegelijk en dan "Meer reacties". Geen oneindig scrollen.
 *   - Antwoorden hangen één niveau diep onder hun hoofdreactie, oudste
 *     eerst — een gesprek lees je van boven naar beneden. Standaard
 *     ingeklapt; open/dicht geldt voor deze sessie.
 *   - Een hart op een reactie is een like (een ❤️ in `comment_reactions`);
 *     het aantal telt unieke personen, ook wie vroeger een andere emoji gaf.
 *     Zo'n oude emoji zet je hart ook aan: er is geen lade meer om hem
 *     anders weg te halen, dus uitzetten haalt al jouw reacties weg.
 *   - Versturen verschijnt meteen ("verzenden…"); mislukt het, dan blijft
 *     hij staan met "niet verzonden · opnieuw".
 *   - Verwijderen (je eigen, of elke op wat jij maakte), verbergen en
 *     rapporteren (0084).
 *   - Live: nieuwe, aangepaste en verwijderde reacties en hartjes.
 */

const PAGE = 20;

/** Welke draden open staan: per sessie, over schermen heen. */
const openThreads = new Set<string>();

export type PendingComment = {
  tempId: string;
  body: string;
  parentId: string | null;
  imageUri: string | null;
  createdAt: string;
  status: "sending" | "failed";
};

export type CommentLikes = { count: number; liked: boolean };

export function useComments({
  entityType,
  entityId,
  myUserId,
  ownerId,
}: {
  entityType: EntityType;
  entityId: string | undefined;
  myUserId: string;
  /** Wie de bijdrage maakte: die mag elke reactie verwijderen, en krijgt de melding. */
  ownerId?: string | null;
}) {
  const qc = useQueryClient();
  const listKey = ["entity-comments", entityType, entityId];
  const comments = useQuery({
    queryKey: listKey,
    queryFn: () => listEntityComments(entityType, entityId!),
    enabled: !!entityId,
  });
  const hidden = useQuery({
    queryKey: ["comment-hides", myUserId],
    queryFn: () => listHiddenCommentIds(myUserId),
    enabled: !!myUserId,
    staleTime: 60_000,
  });

  const all = useMemo(() => (comments.data ?? []).filter((c) => !hidden.data?.has(c.id)), [comments.data, hidden.data]);
  const ids = useMemo(() => all.map((c) => c.id), [all]);

  // ---- hartjes ----
  const likesQ = useQuery({
    queryKey: ["comment-likes", entityType, entityId, ids.join(",")],
    queryFn: () => listReactionsForComments(ids),
    enabled: ids.length > 0,
    staleTime: 10_000,
  });
  const [likeOverride, setLikeOverride] = useState<Record<string, CommentReactionRow[]>>({});
  useEffect(() => setLikeOverride({}), [likesQ.data]);
  const likeRows = useMemo(() => {
    const m: Record<string, CommentReactionRow[]> = {};
    for (const r of likesQ.data ?? []) (m[r.comment_id] ??= []).push(r);
    return { ...m, ...likeOverride };
  }, [likesQ.data, likeOverride]);

  const likesOf = useCallback(
    (id: string): CommentLikes => {
      const rows = likeRows[id] ?? [];
      return { count: new Set(rows.map((r) => r.user_id)).size, liked: rows.some((r) => r.user_id === myUserId) };
    },
    [likeRows, myUserId],
  );

  /** Wie op een reactie reageerde, met welke emoji (voor het paneel). */
  const likersOf = useCallback(
    (id: string): { userId: string; emojis: string[]; latest: string }[] => {
      const byUser = new Map<string, { userId: string; emojis: string[]; latest: string }>();
      for (const r of likeRows[id] ?? []) {
        const cur = byUser.get(r.user_id) ?? { userId: r.user_id, emojis: [], latest: (r as { created_at?: string }).created_at ?? "" };
        if (!cur.emojis.includes(r.emoji)) cur.emojis.push(r.emoji);
        byUser.set(r.user_id, cur);
      }
      return Array.from(byUser.values());
    },
    [likeRows],
  );

  const toggleLike = useCallback(
    async (commentId: string) => {
      const current = likeRows[commentId] ?? [];
      const on = current.some((r) => r.user_id === myUserId);
      const next = on
        ? current.filter((r) => r.user_id !== myUserId)
        : [...current, { comment_id: commentId, user_id: myUserId, emoji: LIKE }];
      setLikeOverride((o) => ({ ...o, [commentId]: next }));
      tick();
      try {
        if (on) await clearMyCommentReactions(commentId, myUserId);
        else await toggleCommentReaction({ commentId, userId: myUserId, emoji: LIKE, on: false });
      } catch {
        setLikeOverride((o) => ({ ...o, [commentId]: current }));
      }
    },
    [likeRows, myUserId],
  );

  // ---- live ----
  useEffect(() => {
    if (!entityId) return;
    const refetchList = () => qc.invalidateQueries({ queryKey: ["entity-comments", entityType, entityId] });
    const refetchLikes = () => qc.invalidateQueries({ queryKey: ["comment-likes", entityType, entityId] });
    const ch = supabase
      .channel(uniqueTopic(`comments:${entityType}:${entityId}`))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "entity_comments", filter: `entity_id=eq.${entityId}` }, refetchList)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "entity_comments", filter: `entity_id=eq.${entityId}` }, refetchList)
      // Een verwijderde rij draagt onder RLS alleen zijn id: kijk zelf of hij van ons is.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "entity_comments" }, (p) => {
        const id = (p.old as { id?: string })?.id;
        if (id && (comments.data ?? []).some((c) => c.id === id)) refetchList();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "comment_reactions" }, (p) => {
        const row = (p.new && Object.keys(p.new).length ? p.new : p.old) as { comment_id?: string };
        if (row?.comment_id && ids.includes(row.comment_id)) refetchLikes();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [entityType, entityId, qc, comments.data, ids]);

  // ---- volgorde en bladzijden ----
  const prefs = usePrefs(myUserId);
  const sort: CommentSort = prefs.commentSort;
  const setSort = useCallback((s: CommentSort) => setPref(myUserId, "commentSort", s), [myUserId]);
  const [limit, setLimit] = useState(PAGE);

  const roots = useMemo(() => {
    const list = all.filter((c) => !c.parent_id);
    list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    if (sort === "newest") list.reverse();
    return list;
  }, [all, sort]);

  const replies = useMemo(() => {
    const m = new Map<string, EntityComment[]>();
    for (const c of all) if (c.parent_id) (m.get(c.parent_id) ?? m.set(c.parent_id, []).get(c.parent_id)!).push(c);
    for (const list of m.values()) list.sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    return m;
  }, [all]);

  // ---- draden open/dicht (per sessie) ----
  const [, rerender] = useState(0);
  const isOpen = useCallback((rootId: string) => openThreads.has(rootId), []);
  const setOpen = useCallback((rootId: string, open: boolean) => {
    if (open) openThreads.add(rootId);
    else openThreads.delete(rootId);
    rerender((n) => n + 1);
  }, []);

  // ---- versturen ----
  const [pending, setPending] = useState<PendingComment[]>([]);

  const post = useCallback(
    async (p: PendingComment) => {
      setPending((list) => list.map((x) => (x.tempId === p.tempId ? { ...x, status: "sending" } : x)));
      try {
        await addEntityComment({
          entityType,
          entityId: entityId!,
          userId: myUserId,
          body: p.body,
          ownerId: ownerId ?? undefined,
          imageUri: p.imageUri,
          parentId: p.parentId,
        });
        await qc.invalidateQueries({ queryKey: ["entity-comments", entityType, entityId] });
        setPending((list) => list.filter((x) => x.tempId !== p.tempId));
      } catch {
        setPending((list) => list.map((x) => (x.tempId === p.tempId ? { ...x, status: "failed" } : x)));
      }
    },
    [entityType, entityId, myUserId, ownerId, qc],
  );

  /** Een reactie of antwoord: meteen zichtbaar, daarna naar de server. */
  const send = useCallback(
    (args: { body: string; parentId?: string | null; imageUri?: string | null }) => {
      if (!entityId || (!args.body.trim() && !args.imageUri)) return;
      // Een antwoord op een antwoord hangt onder dezelfde hoofdreactie (0084 doet dat ook).
      const parent = args.parentId ? all.find((c) => c.id === args.parentId) : null;
      const rootId = parent ? (parent.parent_id ?? parent.id) : null;
      const p: PendingComment = {
        tempId: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        body: args.body.trim(),
        parentId: rootId,
        imageUri: args.imageUri ?? null,
        createdAt: new Date().toISOString(),
        status: "sending",
      };
      if (rootId) setOpen(rootId, true);
      setPending((list) => [...list, p]);
      tick();
      post(p);
      return p.tempId;
    },
    [entityId, all, post, setOpen],
  );

  const retry = useCallback((tempId: string) => {
    const p = pending.find((x) => x.tempId === tempId);
    if (p) post(p);
  }, [pending, post]);

  const discard = useCallback((tempId: string) => setPending((list) => list.filter((x) => x.tempId !== tempId)), []);

  // ---- weg, verbergen, rapporteren ----
  const removed = useState(() => new Set<string>());
  const [gone, setGone] = removed;

  const canDelete = useCallback((c: EntityComment) => c.user_id === myUserId || (!!ownerId && ownerId === myUserId), [myUserId, ownerId]);

  const remove = useCallback(
    async (id: string) => {
      setGone((s) => new Set(s).add(id));
      try {
        await deleteEntityComment(id);
        await qc.invalidateQueries({ queryKey: ["entity-comments", entityType, entityId] });
      } catch {
        setGone((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        throw new Error("Verwijderen lukte niet");
      }
    },
    [qc, entityType, entityId, setGone],
  );

  const hide = useCallback(
    async (id: string) => {
      setGone((s) => new Set(s).add(id));
      try {
        await hideEntityComment(myUserId, id);
        await qc.invalidateQueries({ queryKey: ["comment-hides", myUserId] });
      } catch {
        setGone((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      }
    },
    [myUserId, qc, setGone],
  );

  const report = useCallback(
    (id: string) => reportEntityComment({ commentId: id, postId: entityType === "post" ? entityId : null }),
    [entityType, entityId],
  );

  // ---- wie schreef wat: profielen voor naam en kleur ----
  const visibleRoots = roots.filter((c) => !gone.has(c.id));
  const shownRoots = visibleRoots.slice(0, limit);

  const authorIds = useMemo(() => Array.from(new Set(all.map((c) => c.user_id))), [all]);
  const authors = useQuery({
    queryKey: ["profiles", ...authorIds.slice().sort()],
    queryFn: () => getProfiles(authorIds),
    enabled: authorIds.length > 0,
    staleTime: 60_000,
  });
  const authorOf = useCallback(
    (c: EntityComment): Profile | null => c.author ?? authors.data?.find((p) => p.id === c.user_id) ?? null,
    [authors.data],
  );

  return {
    isLoading: comments.isLoading,
    isError: comments.isError,
    /** Alle zichtbare reacties en antwoorden (voor de teller). */
    total: all.filter((c) => !gone.has(c.id)).length,
    rootCount: visibleRoots.length,
    roots: shownRoots,
    hasMore: visibleRoots.length > limit,
    moreCount: Math.max(0, visibleRoots.length - limit),
    loadMore: () => setLimit((n) => n + PAGE),
    /** Zorg dat deze hoofdreactie getoond wordt (een melding naar reactie 31). */
    reveal: (rootId: string) => {
      const i = visibleRoots.findIndex((c) => c.id === rootId);
      if (i >= limit) setLimit(Math.ceil((i + 1) / PAGE) * PAGE);
    },
    repliesOf: (rootId: string) => (replies.get(rootId) ?? []).filter((c) => !gone.has(c.id)),
    pendingFor: (rootId: string | null) => pending.filter((p) => p.parentId === rootId),
    find: (id: string) => all.find((c) => c.id === id) ?? null,
    sort,
    setSort,
    isOpen,
    setOpen,
    likesOf,
    likersOf,
    toggleLike,
    send,
    retry,
    discard,
    canDelete,
    remove,
    hide,
    report,
    authorOf,
  };
}

export type CommentsModel = ReturnType<typeof useComments>;
