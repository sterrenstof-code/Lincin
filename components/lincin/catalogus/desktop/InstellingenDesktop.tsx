import { useRef } from "react";

import type { Instelling } from "../schermen/OverigeViews";
import { Spec, klikbaar } from "./Delen";

/**
 * Instellingen op desktop. Niet apart ontworpen: dezelfde regels als op de
 * telefoon (ontwerp 11, het type `Instelling`), in de opbouw van Gesprekken.
 *
 *   links (340)   je account en de groepen als inhoudsopgave
 *   rechts        elke groep met een strook erboven, en zijn regels: een
 *                 schakelaar, een keuze met alle opties naast elkaar, of een
 *                 regel met → naar een eigen pagina
 */

type Groep = { titel: string; regels: Exclude<Instelling, { soort: "groep" }>[] };

function groepen(regels: Instelling[]): Groep[] {
  const uit: Groep[] = [];
  for (const r of regels) {
    if (r.soort === "groep") uit.push({ titel: r.titel, regels: [] });
    else (uit[uit.length - 1] ?? (uit[uit.push({ titel: "", regels: [] }) - 1])).regels.push(r);
  }
  return uit;
}

function Schakelaar({ aan, zet, label }: { aan: boolean; zet: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={aan}
      aria-label={label}
      onClick={() => zet(!aan)}
      style={{ width: 48, height: 24, flex: "none", border: "1px solid var(--k)", background: aan ? "var(--k)" : "transparent", position: "relative" }}
    >
      <span style={{ position: "absolute", top: 3, left: aan ? 27 : 3, width: 16, height: 16, background: aan ? "var(--onk)" : "var(--k)" }} />
    </button>
  );
}

export function InstellingenDesktop({ kop, regels }: { kop: [string, string][]; regels: Instelling[] }) {
  const lijst = groepen(regels);
  const rechts = useRef<HTMLDivElement>(null);
  const naar = (i: number) => rechts.current?.querySelector(`[data-groep="${i}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return (
    <div className="grid" style={{ gridTemplateColumns: "340px minmax(0,1fr)" }} data-meet="instellingen">
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        <div style={{ background: "var(--g)", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 18, flex: "none" }}>
          <span className="T" style={{ fontSize: 38 }}>
            Instellingen
          </span>
          <Spec rijen={kop} />
        </div>
        {lijst.map((g, i) => (
          <a key={g.titel || i} className="tile" style={{ height: 56, flex: "none", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }} {...klikbaar(() => naar(i))}>
            <span style={{ fontSize: 17 }}>{g.titel}</span>
            <span className="S dim">{g.regels.length} →</span>
          </a>
        ))}
        <span style={{ flex: 1, background: "var(--g)" }} />
      </section>
      <section ref={rechts} className="scroll" style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0, minWidth: 0 }}>
        {lijst.map((g, i) => (
          <div key={g.titel || i} data-groep={i} style={{ display: "flex", flexDirection: "column", gap: 2, flex: "none" }}>
            <div className="strip S" style={{ height: 48 }}>
              {g.titel}
            </div>
            {g.regels.map((r) => (
              <div
                key={r.label}
                className={r.soort === "regel" && r.open ? "tile" : undefined}
                style={{ minHeight: 64, background: "var(--g)", display: "grid", gridTemplateColumns: "220px minmax(0,1fr) auto", alignItems: "center", gap: 16, padding: "10px 16px" }}
                {...(r.soort === "regel" && r.open ? klikbaar(r.open) : {})}
                data-meet="instelling"
              >
                <span className="S dim">{r.label}</span>
                {r.soort === "keuze" ? (
                  <span role="radiogroup" aria-label={r.label} style={{ display: "flex", maxWidth: 480 }}>
                    {r.opties.map((o) => (
                      <button
                        key={o.label}
                        role="radio"
                        aria-checked={o.aan}
                        className="S"
                        onClick={o.kies}
                        style={{ flex: 1, height: 40, padding: "0 14px", marginLeft: -1, ...(o.aan ? { background: "var(--k)", color: "var(--onk)", border: "1px solid var(--k)" } : { border: "1px solid var(--k)" }) }}
                      >
                        {o.label}
                      </button>
                    ))}
                  </span>
                ) : (
                  <span style={{ fontSize: 16, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>{r.waarde}</span>
                )}
                {r.soort === "schakelaar" ? (
                  <Schakelaar aan={r.aan} zet={r.zet} label={r.label} />
                ) : r.soort === "regel" && r.open && r.pijl !== false ? (
                  <span aria-hidden="true" style={{ fontSize: 20 }}>
                    →
                  </span>
                ) : (
                  <span />
                )}
              </div>
            ))}
          </div>
        ))}
        <span style={{ flex: 1, minHeight: 40, background: "var(--g)" }} />
      </section>
    </div>
  );
}
