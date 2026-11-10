import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";

import type { PrivateTarget } from "@/components/lincin/PrivateSheet";
import type { EntityComment } from "@/lib/api/entity-comments";
import { deletePost, getPost, type PostWithAuthor } from "@/lib/api/posts";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { useLang, useT } from "@/lib/i18n";
import { useComments } from "@/lib/lincin/comments";
import { useDraft } from "@/lib/lincin/drafts";
import { LIKE, usePostLikes } from "@/lib/lincin/likes";
import { displayName, fromPost, relTime } from "@/lib/lincin/model";
import { safeBack } from "@/lib/nav";
import { invalidatePostCaches } from "@/lib/post-cache";
import { markSeen } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

import { lincKleur } from "../stijl";
import type { MenuRegel, Reactie } from "./BijdrageView";

/**
 * De inhoud van een bijdrage in catalogus: de bijdrage, de likes, de
 * reacties en antwoorden, het concept, het privébericht, bewerken en
 * verwijderen. Dezelfde haken als app/post/[id].tsx.
 *
 * Twee vormen lezen hieruit: de bijdragepagina op de telefoon
 * (`BijdrageCatalogus`, met `BijdrageView`) en het paneel op desktop
 * (`PaneelEcht`, zonder het beeld).
 *
 * `naVerwijderen`: waar je heen gaat als je je eigen bijdrage verwijdert.
 */
export function useBijdrage(id: string, { naVerwijderen }: { naVerwijderen?: () => void } = {}) {
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const lang = useLang();
  const toast = useToast();
  const { session } = useAuth();
  const me = session?.user.id ?? "";

  const post = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(id),
    enabled: !!id,
    initialData: () => {
      const feed = qc.getQueryData<{ type: string; data: PostWithAuthor }[]>(["unified-feed", me]);
      return feed?.find((i) => i.type === "post" && i.data.id === id)?.data;
    },
  });
  useEffect(() => {
    if (id) markSeen(id);
  }, [id]);
  const p = post.data ?? null;
  const card = useMemo(() => (p ? fromPost(p) : null), [p]);

  const likes = usePostLikes(id || undefined, me);
  const m = useComments({ entityType: "post", entityId: id || undefined, myUserId: me, ownerId: p?.user_id });
  const [draft, setDraft, clearDraft] = useDraft(id ? `post:${id}` : null);
  const [replyTo, setReplyTo] = useState<EntityComment | null>(null);
  const [menu, setMenu] = useState(false);
  const [focus, setFocus] = useState(0);
  const [sheet, setSheet] = useState<PrivateTarget | null>(null);
  const [bewerk, setBewerk] = useState(false);

  const own = !!p && p.user_id === me;
  const naam = p ? displayName(p.author) : "";

  /** De reacties, de antwoorden direct onder hun reactie (`antwoordenIngesprongen`: ingesprongen tonen). */
  const reacties = (antwoordenIngesprongen: boolean): Reactie[] => {
    const een = (c: EntityComment, antwoord: boolean): Reactie => {
      const a = m.authorOf(c);
      const n = c.user_id === me ? t.me : displayName(a);
      const l = m.likesOf(c.id);
      return {
        id: c.id,
        naam: n,
        tijd: relTime(c.created_at, t, lang),
        tekst: c.body,
        linc: { beeld: a?.avatar_url, kleur: lincKleur(c.user_id), initiaal: n.slice(0, 1).toUpperCase() },
        antwoord,
        hartjes: l.count,
        vindIkLeuk: l.liked,
      };
    };
    const uit = m.roots.flatMap((r) => [een(r, false), ...m.repliesOf(r.id).map((c) => een(c, antwoordenIngesprongen))]);
    for (const w of m.pendingFor(null)) {
      uit.push({
        id: w.tempId,
        naam: t.me,
        tijd: w.status === "failed" ? t.failed : "…",
        tekst: w.body,
        linc: { kleur: lincKleur(me), initiaal: t.me.slice(0, 1).toUpperCase() },
        antwoord: false,
        hartjes: 0,
        vindIkLeuk: false,
      });
    }
    return uit;
  };

  // Wie het leuk vond: de eerste drie gezichten en een zin.
  const fans = likes.reactors.filter((r) => r.emojis.includes(LIKE));
  const namen = fans.map((r) => (r.me ? "jou" : displayName(r.profile)));
  const zin = namen.length === 0 ? "" : namen.length === 1 ? namen[0] : `${namen.slice(0, -1).join(", ")} en ${namen[namen.length - 1]}`;
  const leukDoor = fans.length
    ? {
        gezichten: fans.slice(0, 3).map((r) =>
          r.me
            ? { kleur: null, initiaal: "jij" }
            : { beeld: r.profile?.avatar_url, kleur: lincKleur(r.userId), initiaal: displayName(r.profile).slice(0, 1).toUpperCase() },
        ),
        zin: `Leuk gevonden door ${zin}`,
      }
    : null;

  const praatOver = () => {
    if (!p || !card) return;
    setSheet({
      friendId: p.user_id,
      friendName: naam,
      quote: card.caption || card.title,
      postId: p.id,
      postTitle: card.title,
    } as PrivateTarget);
  };

  async function verwijder() {
    setMenu(false);
    const ok = await confirm("Bijdrage verwijderen?", "Je vrienden zien hem dan niet meer.", { affirmativeLabel: "Verwijder", destructive: true });
    if (!ok || !p) return;
    try {
      await deletePost(p);
      invalidatePostCaches(qc);
      if (naVerwijderen) naVerwijderen();
      else safeBack(router, "/feed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    }
  }

  const menuRegels: MenuRegel[] = own
    ? [
        { label: "Bewerk deze bijdrage", doe: () => (setMenu(false), setBewerk(true)) },
        { label: "Reageer", doe: () => (setMenu(false), setFocus((n) => n + 1)) },
        { label: "Verwijder deze bijdrage", gevaar: true, doe: verwijder },
      ]
    : [
        { label: `Stuur ${naam} een bericht hierover`, doe: () => (setMenu(false), praatOver()) },
        { label: "Reageer", doe: () => (setMenu(false), setFocus((n) => n + 1)) },
      ];

  function stuur() {
    const body = draft.trim();
    if (!body) return;
    m.send({ body, imageUri: null, parentId: replyTo?.id ?? null });
    clearDraft();
    setReplyTo(null);
    invalidatePostCaches(qc);
  }

  function antwoord(cid: string) {
    const c = m.find(cid);
    if (!c) return;
    setReplyTo(c);
    // Een antwoord op een antwoord begint met @naam, zoals op de gewone bladzijde.
    const a = c.user_id === me ? null : m.authorOf(c);
    if (c.parent_id && a?.username && !draft.includes(`@${a.username}`)) setDraft((d) => `@${a.username} ${d}`);
    setFocus((n) => n + 1);
  }

  const antwoordNaam = replyTo ? (replyTo.user_id === me ? t.me : displayName(m.authorOf(replyTo))) : null;
  const onder = card ? [card.caption, card.body].filter(Boolean).join("\n\n") : "";

  return {
    t,
    post,
    p,
    card,
    own,
    naam,
    likes,
    comments: m,
    reacties,
    leukDoor,
    draft,
    setDraft,
    stuur,
    antwoord,
    stopAntwoord: () => setReplyTo(null),
    antwoordNaam,
    praatOver,
    sheet,
    setSheet,
    menu,
    setMenu,
    menuRegels,
    verwijder,
    bewerk,
    setBewerk,
    focus,
    setFocus,
    onder,
  };
}

export type Bijdrage = ReturnType<typeof useBijdrage>;
