import { useMemo, useState } from "react";

import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { useFeed } from "@/components/lincin/feed/useFeed";
import { getLang } from "@/lib/i18n";
import { LIKE } from "@/lib/lincin/likes";
import type { CardPost } from "@/lib/lincin/model";

import { CardVoorwerp, datumVan, titelVan } from "../kaart";
import { useCatNav } from "../nav";
import { HomeView, type HomeStuk } from "./HomeView";

const LOCALE = { nl: "nl-NL", en: "en-GB", de: "de-DE" } as const;

/** "ma 9 nov 2026" */
export function vandaag(): string {
  const d = new Date();
  const loc = LOCALE[getLang() as keyof typeof LOCALE] ?? "nl-NL";
  const dag = d.toLocaleDateString(loc, { weekday: "short" }).replace(".", "");
  const rest = d.toLocaleDateString(loc, { day: "numeric", month: "short", year: "numeric" }).replace(".", "");
  return `${dag} ${rest}`;
}

/**
 * De home van catalogus op echte gegevens (`useFeed`): het uitgelichte stuk
 * van de maand over de volle breedte, daaronder alles in twee kolommen,
 * nieuwste eerst.
 */
export function FeedCatalogus() {
  const f = useFeed();
  const nav = useCatNav();
  const [hartjesStand, setHartjesStand] = useState(false);
  const [opgetild, setOpgetild] = useState<string | null>(null);
  const [scrollY, setScrollY] = useState(0);

  const volgorde = useMemo(() => {
    const hero = f.heroPost;
    const rest = f.cards.filter((c) => c.id !== hero?.id);
    return hero ? [hero, ...rest] : rest;
  }, [f.cards, f.heroPost]);
  const perId = useMemo(() => new Map(volgorde.map((c) => [c.id, c])), [volgorde]);

  const hart = (c: CardPost) => f.reactions.grouped(c.id).find((g) => g.emoji === LIKE);

  const stukken: HomeStuk[] = volgorde.map((c, i) => {
    const breed = i === 0 && c.id === f.heroPost?.id;
    const h = hart(c);
    return {
      id: c.id,
      voorwerp: <CardVoorwerp card={c} plek={breed ? "uitgelicht" : "vak"} />,
      regels: breed
        ? [
            { label: "Wie", waarde: c.authorName },
            { label: "Soort", waarde: `${c.kind} · uitgelicht` },
            { label: "Datum", waarde: datumVan(c) },
            { label: "Reacties", waarde: String(c.commentCount) },
          ]
        : [
            { label: "Wie", waarde: c.authorName },
            { label: "Titel", waarde: titelVan(c) },
            { label: "Datum", waarde: datumVan(c) },
          ],
      regelsKort: breed
        ? [
            { label: "Wie", waarde: c.authorName },
            { label: "Soort", waarde: `${c.kind} · uitgelicht` },
            { label: "Datum", waarde: datumVan(c) },
          ]
        : [
            { label: "Wie", waarde: c.authorName },
            { label: "Titel", waarde: titelVan(c) },
          ],
      breed,
      label: `${titelVan(c)}, ${c.authorName}`,
      hartjes: h?.count ?? 0,
      reacties: c.commentCount,
      vindIkLeuk: !!h?.mine,
      wie: c.authorName,
      eigen: f.isMine(c.authorId),
    };
  });

  const met = (id: string, fn: (c: CardPost) => void) => {
    const c = perId.get(id);
    if (c) fn(c);
  };
  const leuk = (c: CardPost) => {
    if (!c.reactable) return;
    f.reactions.toggle(c.id, LIKE);
    setHartjesStand(true);
  };

  return (
    <>
      <HomeView
        regels={[
          { label: "Lincin", waarde: f.edition ? `Editie № ${f.edition}` : "Editie" },
          { label: "Datum", waarde: vandaag() },
          { label: "Inhoud", waarde: `${volgorde.length} ${volgorde.length === 1 ? "bijdrage" : "bijdragen"}` },
        ]}
        stukken={stukken}
        nieuweMeldingen={nav.nieuweMeldingen}
        ongelezen={nav.ongelezen}
        hartjesStand={hartjesStand}
        opgetild={opgetild}
        scrollY={scrollY}
        onScroll={(e) => setScrollY(e.nativeEvent.contentOffset.y)}
        laden={f.feed.isLoading}
        fout={f.feed.isError && !f.cards.length ? { tekst: "De bijdragen laadden niet.", opnieuw: () => f.refresh() } : undefined}
        doe={{
          open: (id) => met(id, (c) => f.openPost(c)),
          leuk: (id) =>
            met(id, (c) => {
              leuk(c);
              setOpgetild(null);
            }),
          dubbel: (id) =>
            met(id, (c) => {
              if (!hart(c)?.mine) leuk(c);
            }),
          reageer: (id) =>
            met(id, (c) => {
              setOpgetild(null);
              if (c.kind === "poll") f.openPost(c);
              else nav.router.push(`/post/${c.id}?reageer=1` as never);
            }),
          bericht: (id) =>
            met(id, (c) => {
              setOpgetild(null);
              f.privateAbout({ authorId: c.authorId, name: c.authorName }, c);
            }),
          tilOp: setOpgetild,
          zetNeer: () => setOpgetild(null),
          meldingen: nav.meldingen,
          nieuw: f.compose,
          tab: nav.tab,
        }}
      />
      <PrivateSheet target={f.sheet} onClose={() => f.setSheet(null)} />
    </>
  );
}
