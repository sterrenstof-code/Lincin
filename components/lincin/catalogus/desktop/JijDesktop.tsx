import { useEffect, useRef, useState } from "react";

import { Pic, Spec, Sq, klikbaar } from "./Delen";
import type { DStuk } from "./typen";

/**
 * Jij op desktop. Niet apart ontworpen: dezelfde opbouw als Gesprekken en
 * Events (kolommen met naden van 2, stroken van 56, vakken) en de inhoud van
 * Jij op de telefoon (ontwerp 04).
 *
 *   links (340)   je beeld en naam, het kaartje (naam, lincs, bijdragen, sinds),
 *                 en de ingangen als rijen: lincs, thema, instellingen, QR
 *   rechts        al je bijdragen als vakken, zoveel kolommen als er passen
 */

export type JijIngang = { label: string; rechts: string; open: () => void; nieuw?: boolean };
export type JijStuk = Pick<DStuk, "id" | "nr" | "titel" | "soort" | "datum" | "beeld" | "voorwerp" | "b" | "h" | "fotos"> & { open: () => void };

/** Het voorwerp in een vak: zijn eigen verhouding, binnen 150 × 190. */
function inVak(s: JijStuk): { b: number; h: number } {
  const f = Math.min(150 / s.b, 190 / s.h, 1);
  return { b: Math.round(s.b * f), h: Math.round(s.h * f) };
}

export function JijDesktop({
  naam,
  linc,
  regels,
  ingangen,
  bijdragen,
  stand,
  bio,
  knoppen,
  bijdragenLabel = "Mijn bijdragen",
}: {
  naam: string;
  linc: { beeld?: string | null; kleur: string | null; initiaal: string };
  regels: [string, string][];
  ingangen: JijIngang[];
  bijdragen: JijStuk[];
  /** Een tekst in plaats van de bijdragen: laden, mislukt, nog niets. */
  stand?: string | null;
  /** Het profiel van een ander: zijn bio onder de naam. */
  bio?: string;
  /** Het profiel van een ander: Gesprek, Samen plannen, Linc toevoegen… De eerste gevuld. */
  knoppen?: { tekst: string; doe: () => void }[];
  /** De kop van de rechterkolom (standaard "Mijn bijdragen"). */
  bijdragenLabel?: string;
}) {
  // Hoeveel kolommen er passen (minstens 220 breed), om de laatste rij te vullen.
  const raster = useRef<HTMLDivElement>(null);
  const [kolommen, setKolommen] = useState(1);
  useEffect(() => {
    const el = raster.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setKolommen(Math.max(1, Math.floor((el.clientWidth + 2) / 222))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [bijdragen.length, stand]);
  const leeg = (kolommen - (bijdragen.length % kolommen)) % kolommen;
  return (
    <div className="grid" style={{ gridTemplateColumns: "340px minmax(0,1fr)" }} data-meet="jij">
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        <div className="scroll" style={{ display: "flex", flexDirection: "column", gap: 2, flex: "0 1 auto", minHeight: 0 }}>
          <div style={{ background: "var(--g)", padding: "24px 16px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16, flex: "none" }}>
            {linc.beeld ? <Pic stuk={{ beeld: linc.beeld }} b={120} h={150} /> : <Sq kleur={linc.kleur} initiaal={linc.initiaal} maat={120} />}
            <span className="T" style={{ alignSelf: "flex-start", fontSize: 38, overflowWrap: "break-word", maxWidth: "100%" }}>
              {naam}
            </span>
            {bio ? <span style={{ alignSelf: "stretch", fontSize: 15, lineHeight: 1.45, color: "var(--two)", overflowWrap: "break-word" }}>{bio}</span> : null}
            <span style={{ alignSelf: "stretch" }}>
              <Spec rijen={regels} />
            </span>
            {knoppen?.length ? (
              <span style={{ alignSelf: "stretch", display: "flex", gap: 6 }}>
                {knoppen.map((k, i) => (
                  <button key={k.tekst} className={i === 0 ? "btn S" : "btn S ghost"} style={{ flex: 1, justifyContent: "center" }} onClick={k.doe}>
                    {k.tekst}
                  </button>
                ))}
              </span>
            ) : null}
          </div>
          {ingangen.map((i) => (
            <a
              key={i.label}
              className="tile"
              style={{ height: 72, flex: "none", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "0 16px" }}
              {...klikbaar(i.open)}
              data-meet="ingang"
            >
              <span style={{ fontSize: 20, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.label}</span>
              <span className="S" style={{ display: "flex", alignItems: "center", gap: 8, flex: "none", color: i.nieuw ? "var(--k)" : "var(--dim)" }}>
                {i.nieuw ? <span className="dot" /> : null}
                {i.rechts}
              </span>
            </a>
          ))}
        </div>
        <span style={{ flex: 1, background: "var(--g)" }} />
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0, minWidth: 0 }}>
        <div className="strip">
          <Spec
            rijen={[
              [bijdragenLabel, bijdragen.length],
              ["Nieuwste", bijdragen[0]?.datum ?? "—"],
            ]}
          />
        </div>
        {stand || !bijdragen.length ? (
          <div style={{ flex: 1, background: "var(--g)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="S dim">{stand ?? "Nog geen bijdragen"}</span>
          </div>
        ) : (
          <div className="scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div ref={raster} className="grid" style={{ flex: "none", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gridAutoRows: 300 }}>
            {bijdragen.map((s) => {
              const m = inVak(s);
              return (
                <a key={s.id} className="tile" aria-label={s.titel} {...klikbaar(s.open)} data-meet="mijnstuk">
                  <span className="S dim" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{s.nr}</span>
                    <span>{s.soort}</span>
                  </span>
                  <span className="obj">
                    <Pic stuk={s} b={m.b} h={m.h} />
                  </span>
                  <Spec
                    rijen={[
                      ["Titel", s.titel],
                      ["Datum", s.datum],
                    ]}
                  />
                </a>
              );
            })}
            {/* De rest van de laatste rij: lege vakken, geen gat in de naad. */}
            {Array.from({ length: leeg }, (_, i) => (
              <span key={`leeg${i}`} style={{ background: "var(--g)" }} aria-hidden="true" />
            ))}
          </div>
          <span style={{ flex: 1, minHeight: 0, background: "var(--g)" }} />
          </div>
        )}
      </section>
    </div>
  );
}
