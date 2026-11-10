import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

import { EditPost } from "@/components/lincin/EditPost";
import { PrivateSheet, type PrivateTarget } from "@/components/lincin/PrivateSheet";
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
import { usePageTitle } from "@/lib/page-title";
import { invalidatePostCaches } from "@/lib/post-cache";
import { markSeen } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

import { CardVoorwerp, datumVan } from "../kaart";
import { lincKleur } from "../stijl";
import { ExtraRegel, Stand } from "./Lijsten";
import { BijdrageView, type MenuRegel, type Reactie } from "./BijdrageView";

/**
 * De bijdrage in catalogus op echte gegevens: dezelfde haken als
 * app/post/[id].tsx (likes, reacties, concept, privébericht, bewerken en
 * verwijderen), in de vorm van ontwerp 05 en 14–16.
 */
export function BijdrageCatalogus({ id }: { id: string }) {
  const { reageer } = useLocalSearchParams<{ reageer?: string }>();
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
  usePageTitle(card?.title ?? null);

  const likes = usePostLikes(id || undefined, me);
  const m = useComments({ entityType: "post", entityId: id || undefined, myUserId: me, ownerId: p?.user_id });
  const [draft, setDraft, clearDraft] = useDraft(id ? `post:${id}` : null);
  const [replyTo, setReplyTo] = useState<EntityComment | null>(null);
  const [actief, setActief] = useState(!!reageer);
  const [menu, setMenu] = useState(false);
  const [focus, setFocus] = useState(reageer ? 1 : 0);
  const [sheet, setSheet] = useState<PrivateTarget | null>(null);
  const [bewerk, setBewerk] = useState(false);

  const own = !!p && p.user_id === me;
  const naam = p ? displayName(p.author) : "";
  const wakker = () => setActief(true);
  const terug = () => safeBack(router, "/feed");

  if (!p || !card) {
    return (
      <BijdrageView
        kop={[{ label: "Bijdrage", waarde: post.isError ? t.failed : t.loading }]}
        voorwerp={null}
        titelTekst=""
        regels={[]}
        actief={false}
        hartjes=""
        vindIkLeuk={false}
        aantalReacties=""
        berichtAan={null}
        leukDoor={null}
        reacties={[]}
        antwoordAan={null}
        invoer=""
        menu={null}
        meer={<Stand tekst={post.isError ? t.failed : t.loading} />}
        doe={{
          terug,
          meer: () => {},
          sluitMenu: () => {},
          leuk: () => {},
          reacties: () => {},
          wakker: () => {},
          leukReactie: () => {},
          antwoord: () => {},
          stopAntwoord: () => {},
          tekst: () => {},
          stuur: () => {},
        }}
      />
    );
  }

  const reactie = (c: EntityComment, antwoord: boolean): Reactie => {
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
  const reacties: Reactie[] = m.roots.flatMap((r) => [reactie(r, false), ...m.repliesOf(r.id).map((c) => reactie(c, actief))]);
  for (const w of m.pendingFor(null)) {
    reacties.push({ id: w.tempId, naam: t.me, tijd: w.status === "failed" ? t.failed : "…", tekst: w.body, linc: { kleur: lincKleur(me), initiaal: t.me.slice(0, 1).toUpperCase() }, antwoord: false, hartjes: 0, vindIkLeuk: false });
  }

  // Wie het leuk vond: de eerste drie gezichten en een zin.
  const fans = likes.reactors.filter((r) => r.emojis.includes(LIKE));
  const namen = fans.map((r) => (r.me ? "jou" : displayName(r.profile)));
  const zin =
    namen.length === 0 ? "" : namen.length === 1 ? namen[0] : `${namen.slice(0, -1).join(", ")} en ${namen[namen.length - 1]}`;
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

  const praatOver = () =>
    setSheet({
      friendId: p.user_id,
      friendName: naam,
      quote: card.caption || card.title,
      postId: p.id,
      postTitle: card.title,
    } as PrivateTarget);

  async function verwijder() {
    setMenu(false);
    const ok = await confirm("Bijdrage verwijderen?", "Je vrienden zien hem dan niet meer.", { affirmativeLabel: "Verwijder", destructive: true });
    if (!ok || !p) return;
    try {
      await deletePost(p);
      invalidatePostCaches(qc);
      safeBack(router, "/feed");
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

  const antwoordNaam = replyTo ? (replyTo.user_id === me ? t.me : displayName(m.authorOf(replyTo))) : null;
  const onder = [card.caption, card.body].filter(Boolean).join("\n\n");

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <BijdrageView
        kop={[
          { label: "Bijdrage", waarde: datumVan(card) },
          { label: "Wie", waarde: naam },
          { label: "Soort", waarde: card.kind },
        ]}
        voorwerp={<CardVoorwerp card={card} plek={actief ? "bijdrageActief" : "bijdrage"} />}
        titelTekst={card.title}
        regels={[
          { label: "Wie", waarde: naam },
          { label: "Soort", waarde: card.kind },
          { label: "Datum", waarde: datumVan(card) },
          { label: "Reacties", waarde: String(m.total) },
        ]}
        actief={actief}
        hartjes={likes.count}
        vindIkLeuk={likes.liked}
        aantalReacties={m.total}
        berichtAan={own ? null : naam}
        leukDoor={leukDoor}
        reacties={reacties}
        antwoordAan={antwoordNaam}
        invoer={draft}
        focus={focus}
        onder={onder || undefined}
        menu={menu ? { kop: `${datumVan(card)} · ${naam}`, regels: menuRegels } : null}
        meer={
          <>
            {m.hasMore ? <ExtraRegel label="Meer reacties" rechts={`${m.moreCount} →`} onPress={m.loadMore} /> : null}
            {bewerk ? <EditPost post={p} onDone={() => setBewerk(false)} /> : null}
          </>
        }
        doe={{
          terug,
          meer: () => (wakker(), setMenu(true)),
          sluitMenu: () => setMenu(false),
          leuk: () => (wakker(), likes.toggle(LIKE)),
          reacties: () => (wakker(), setFocus((n) => n + 1)),
          bericht: () => praatOver(),
          wakker,
          leukReactie: (cid) => m.toggleLike(cid),
          antwoord: (cid) => {
            const c = m.find(cid);
            if (!c) return;
            setReplyTo(c);
            // Een antwoord op een antwoord begint met @naam, zoals op de gewone bladzijde.
            const a = c.user_id === me ? null : m.authorOf(c);
            if (c.parent_id && a?.username && !draft.includes(`@${a.username}`)) setDraft((d) => `@${a.username} ${d}`);
            setFocus((n) => n + 1);
          },
          stopAntwoord: () => setReplyTo(null),
          tekst: setDraft,
          stuur,
        }}
      />
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </KeyboardAvoidingView>
  );
}
