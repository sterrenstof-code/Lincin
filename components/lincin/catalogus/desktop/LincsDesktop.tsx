import { useEffect, useRef, useState } from "react";

import { Pic, Spec, Sq, klikbaar } from "./Delen";

/**
 * Mijn lincs op desktop. Niet apart ontworpen: de inhoud van ontwerp 12 (elke
 * linc als voorwerp, met wat je van hem nog niet zag) in de opbouw van Jij.
 *
 *   links (340)   de tellers en "+ Linc toevoegen"
 *   rechts        de lincs als vakken, zoveel kolommen als er passen; het
 *                 laatste vak voegt er een toe
 */

export type LincDesktop = {
  id: string;
  naam: string;
  gebruiker?: string | null;
  /** "3", of "—" als er niets nieuws is. */
  nieuw: string;
  linc: { beeld?: string | null; kleur?: string | null; initiaal: string };
  open: () => void;
};

export function LincsDesktop({ lincs, totaal, toevoegen }: { lincs: LincDesktop[]; totaal: number; toevoegen: () => void }) {
  const raster = useRef<HTMLDivElement>(null);
  const [kolommen, setKolommen] = useState(1);
  useEffect(() => {
    const el = raster.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setKolommen(Math.max(1, Math.floor((el.clientWidth + 2) / 222))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const n = lincs.length + 1;
  const leeg = (kolommen - (n % kolommen)) % kolommen;
  return (
    <div className="grid" style={{ gridTemplateColumns: "340px minmax(0,1fr)" }} data-meet="lincs">
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        <div style={{ background: "var(--g)", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
          <span className="T" style={{ fontSize: 38 }}>
            Mijn lincs
          </span>
          <Spec
            rijen={[
              ["Lincs", lincs.length],
              ["Nieuw", `${totaal} ${totaal === 1 ? "bijdrage" : "bijdragen"}`],
            ]}
          />
          <button className="btn S" style={{ alignSelf: "flex-start" }} onClick={toevoegen}>
            + Linc toevoegen
          </button>
        </div>
        <span style={{ flex: 1, background: "var(--g)" }} />
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0, minWidth: 0 }}>
        <div className="strip">
          <Spec rijen={[["Lincs", lincs.length]]} />
          <span className="S dim">QR, je link, of een naam zoeken</span>
        </div>
        <div className="scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 2 }}>
          <div ref={raster} className="grid" style={{ flex: "none", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gridAutoRows: 280 }}>
            {lincs.map((l) => (
              <a key={l.id} className="tile" aria-label={`Profiel van ${l.naam}`} {...klikbaar(l.open)} data-meet="linc">
                <span className="S dim" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Nieuw</span>
                  <span style={{ color: l.nieuw === "—" ? undefined : "var(--k)" }}>{l.nieuw}</span>
                </span>
                <span className="obj">
                  {l.linc.beeld ? <Pic stuk={{ beeld: l.linc.beeld }} b={128} h={160} /> : <Sq kleur={l.linc.kleur ?? null} initiaal={l.linc.initiaal} maat={128} />}
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                  <span style={{ fontSize: 20, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.naam}</span>
                  {l.gebruiker ? <span className="S dim">@{l.gebruiker}</span> : null}
                </span>
              </a>
            ))}
            <a className="tile" style={{ alignItems: "center", justifyContent: "center", gap: 12 }} {...klikbaar(toevoegen)} aria-label="Linc toevoegen">
              <span style={{ width: 128, height: 160, border: "1px dashed var(--k)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, fontWeight: 200 }}>+</span>
              <span className="S">Linc toevoegen</span>
            </a>
            {Array.from({ length: leeg }, (_, i) => (
              <span key={`leeg${i}`} style={{ background: "var(--g)" }} aria-hidden="true" />
            ))}
          </div>
          <span style={{ flex: 1, minHeight: 0, background: "var(--g)" }} />
        </div>
      </section>
    </div>
  );
}
