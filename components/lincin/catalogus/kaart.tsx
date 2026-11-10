import { useAuth } from "@/lib/auth/provider";
import { getLang } from "@/lib/i18n";
import { usePoll } from "@/lib/lincin/poll";
import { shortDate, waveform, type CardPost } from "@/lib/lincin/model";
import { openExternal } from "@/lib/safe-url";

import type { Regel } from "./Kaartje";
import { Foto, KleurVlak, LinkBlad, MuziekBlad, PlekKaart, PollBlad, SpraakBlad, TekstBlad, type Maat } from "./Voorwerp";

/**
 * Van een bijdrage (`CardPost`, lib/lincin/model.ts) naar een voorwerp op
 * de maat van zijn vak, en naar de regels van zijn kaartje.
 *
 * De maten per plek komen uit het ontwerp: het uitgelichte stuk op de home
 * (foto 250 × 300), een gewoon vak (132 × 168, een blad 150 × 180), het
 * profiel (120 × 150) en de bijdrage zelf (290 × 370, actief 270 × 340).
 */
export type Plek = "uitgelicht" | "vak" | "profiel" | "bijdrage" | "bijdrageActief";

const FOTO: Record<Plek, Maat> = {
  uitgelicht: { b: 250, h: 300 },
  vak: { b: 132, h: 168 },
  profiel: { b: 120, h: 150 },
  bijdrage: { b: 290, h: 370 },
  bijdrageActief: { b: 270, h: 340 },
};

const BLAD: Record<Plek, Maat | undefined> = {
  uitgelicht: { b: 200, h: 240 },
  vak: undefined,
  profiel: { b: 140, h: 168 },
  bijdrage: { b: 260, h: 312 },
  bijdrageActief: { b: 240, h: 288 },
};

export function CardVoorwerp({ card, plek }: { card: CardPost; plek: Plek }) {
  const m = card.media;
  const foto = FOTO[plek];
  const blad = BLAD[plek];
  switch (m.kind) {
    case "foto":
      return <Foto b={foto.b} h={foto.h} beeld={m.uri} cacheKey={m.cacheKey} />;
    case "tekst":
      return <TekstBlad tekst={m.text || card.title} maat={blad} />;
    case "poll":
      return <PollVoorwerp card={card} maat={blad} />;
    case "muziek":
      return (
        <MuziekBlad
          nummer={m.track || card.title}
          artiest={m.artist}
          speelt={false}
          voortgang={0}
          maat={blad}
          onSpeel={m.url ? () => openExternal(m.url!) : undefined}
        />
      );
    case "kleur":
      return <KleurVlak hex={m.hex} b={foto.b} h={foto.h} />;
    case "link":
      return <LinkBlad beeld={m.image} titel={m.title || m.site} maat={blad} />;
    case "plek":
      return <PlekKaart b={blad?.b ?? 150} h={blad?.h ?? 168} />;
    case "spraak":
      // Een spraakbijdrage heeft in de app (nog) geen geluid: alleen de golf.
      return <SpraakBlad golf={waveform(card.id, 14).map((v) => Math.round(8 + (v / 100) * 26))} duur={m.duration} speelt={false} maat={blad} />;
  }
}

/** Een poll in het vak: stemmen kan meteen; de twee eerste keuzes passen. */
function PollVoorwerp({ card, maat }: { card: CardPost; maat?: Maat }) {
  const { session } = useAuth();
  const p = card.media.kind === "poll" ? card.media.poll : null;
  const model = usePoll(p?.id, session?.user.id ?? "");
  const poll = model.poll ?? p;
  if (!poll) return null;
  const totaal = Math.max(1, poll.voter_count || model.totalVotes || 0);
  const opties = [...poll.options]
    .sort((a, b) => a.position - b.position)
    .slice(0, 2)
    .map((o) => {
      const n = model.counts.get(o.id) ?? o.vote_count;
      const procent = Math.round((n / totaal) * 100);
      return { id: o.id, label: o.label, procent, gekozen: model.mine.has(o.id), tekst: `${procent}%` };
    });
  return <PollBlad vraag={poll.question} opties={opties} maat={maat} onStem={model.closed ? undefined : (id) => model.vote(id)} />;
}

/** De soort zoals het kaartje hem noemt. */
export function soortVan(card: CardPost): string {
  return card.kind;
}

export function datumVan(card: CardPost): string {
  return shortDate(card.createdAt, getLang());
}

/** De titel in een kaartje: de eigen titel, of anders de soort. */
export function titelVan(card: CardPost): string {
  return card.untitled ? datumVan(card) : card.title || card.kind;
}

/** Wat het kaartje over een poll of muziek zegt. */
export function toestandVan(card: CardPost): Regel | null {
  const m = card.media;
  if (m.kind === "poll") return { label: "Toestand", waarde: m.poll.my_vote_option_ids?.length ? "jij stemde" : `${m.poll.voter_count} stemmen` };
  if (m.kind === "muziek") return { label: "Artiest", waarde: m.artist || "—" };
  if (m.kind === "link") return { label: "Bron", waarde: m.site || "—" };
  if (m.kind === "kleur") return { label: "Kleur", waarde: m.hex.toUpperCase() };
  if (m.kind === "plek") return { label: "Waar", waarde: m.place };
  return null;
}
