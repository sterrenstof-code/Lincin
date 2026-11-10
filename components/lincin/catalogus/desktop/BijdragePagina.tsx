import type { ReactNode } from "react";

import { TekstMetNamen } from "./Delen";
import { Paneel } from "./Paneel";
import type { PaneelInhoud, PaneelNav } from "./typen";

/**
 * De pagina van een bijdrage op desktop (`/post/[id]?pagina=1`). Niet apart
 * ontworpen: links het stuk groot op het grijze vlak, rechts dezelfde kolom
 * van 440 als het paneel van de feed (kaartje, titel, hartje, reacties, de
 * draad, het invoerveld, en ⋯ bij je eigen bijdrage).
 *
 * Het stuk:
 *   foto    alle foto's onder elkaar, zo groot als het vlak toelaat
 *   tekst   een artikel: geen kader, een leeskolom van hoogstens 680 met een
 *           regel, de titel groot, het onderschrift als inleiding, en de
 *           tekst in alinea's zoals in een boek (Artikel)
 *   anders  het voorwerp van de telefoon, anderhalf keer zo groot
 * Bijschrift en lopende tekst van een foto staan eronder, in dezelfde kolom.
 */

export type BijdrageStuk =
  | { soort: "foto"; fotos: string[] }
  | { soort: "tekst"; tekst: string; titel: string; regel: string }
  | { soort: "voorwerp"; node: ReactNode; b: number; h: number };

export function BijdragePagina({
  stuk,
  onder,
  terug,
  kop,
  inhoud,
  profiel,
}: {
  stuk: BijdrageStuk;
  /** Bijschrift en tekst van een foto; leeg bij een tekst (die staat al links). */
  onder?: string;
  terug: () => void;
  /** Het kaartje van de bijdrage (datum, wie, soort). */
  kop: [string, string][];
  /** De inhoud van de kolom rechts; null tot de bijdrage er is. */
  inhoud: PaneelInhoud | null;
  profiel?: (gebruiker: string) => void;
}) {
  const nav: PaneelNav = { plaat: "", kop };
  const aantal = stuk.soort === "foto" && stuk.fotos.length > 1 ? `${stuk.fotos.length} foto's` : null;
  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 440px" }} data-meet="bijdrage-pagina">
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0, minWidth: 0 }}>
        <div className="strip" style={{ padding: "0 16px 0 6px" }}>
          <button className="S" style={{ height: 44, display: "flex", alignItems: "center", gap: 10, padding: "0 10px" }} onClick={terug} data-meet="terug">
            <span aria-hidden="true" style={{ fontSize: 20, letterSpacing: 0 }}>
              ←
            </span>
            Terug
          </button>
          {aantal ? <span className="S dim">{aantal}</span> : null}
        </div>
        <div className="scroll" style={{ flex: 1, background: "var(--g)", padding: "48px 48px 64px", display: "flex", flexDirection: "column", alignItems: "center", gap: 32 }} data-meet="bijdrage-stuk">
          {stuk.soort === "foto" ? (
            stuk.fotos.map((f, i) => (
              <img
                key={i}
                src={f}
                alt=""
                style={{ maxWidth: "100%", maxHeight: "calc(100vh - 56px - 2px - 56px - 2px - 96px)", objectFit: "contain", boxShadow: "0 30px 70px rgba(20,18,16,.18)", flex: "none" }}
                data-meet="bijdrage-foto"
              />
            ))
          ) : stuk.soort === "tekst" ? (
            <Artikel stuk={stuk} inleiding={onder} profiel={profiel} />
          ) : (
            <span style={{ width: stuk.b * 1.5, height: stuk.h * 1.5, flex: "none", position: "relative" }}>
              <span style={{ position: "absolute", left: 0, top: 0, width: stuk.b, height: stuk.h, transform: "scale(1.5)", transformOrigin: "0 0" }}>{stuk.node}</span>
            </span>
          )}
          {onder && stuk.soort !== "tekst" ? (
            <div style={{ width: "100%", maxWidth: 640, fontSize: 17, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "break-word" }} data-meet="bijdrage-onder">
              <TekstMetNamen tekst={onder} profiel={profiel} />
            </div>
          ) : null}
        </div>
      </section>
      <aside style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
        {inhoud ? (
          <Paneel inhoud={inhoud} nav={nav} />
        ) : (
          <div className="panel">
            <div className="S dim" style={{ padding: "18px 20px" }}>
              Laden
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}

/**
 * Een tekst als artikel. Een regel tekst is een alinea; een volgende alinea
 * springt in, zoals in een boek, en een lege regel geeft een witregel
 * (zoals de schrijver ze typte). De eerste letter staat groot.
 */
function Artikel({
  stuk,
  inleiding,
  profiel,
}: {
  stuk: { tekst: string; titel: string; regel: string };
  inleiding?: string;
  profiel?: (gebruiker: string) => void;
}) {
  const regels = stuk.tekst.replace(/\r/g, "").split("\n");
  const alineas: { tekst: string; na: boolean }[] = [];
  let witregel = false;
  for (const r of regels) {
    const t = r.trim();
    if (!t) {
      witregel = alineas.length > 0;
      continue;
    }
    alineas.push({ tekst: t, na: witregel });
    witregel = false;
  }
  return (
    <article className="artikel" lang="nl" data-meet="bijdrage-tekst">
      <header>
        <span className="S dim">{stuk.regel}</span>
        <h1 className="T">{stuk.titel}</h1>
        {inleiding ? (
          <p className="inleiding">
            <TekstMetNamen tekst={inleiding} profiel={profiel} />
          </p>
        ) : null}
      </header>
      <div className="lijf">
        {alineas.map((a, i) => (
          <p key={i} className={i === 0 ? "eerste" : a.na ? "na-wit" : undefined}>
            <TekstMetNamen tekst={a.tekst} profiel={profiel} />
            {i === alineas.length - 1 ? <span className="slot" aria-hidden="true" /> : null}
          </p>
        ))}
      </div>
    </article>
  );
}
