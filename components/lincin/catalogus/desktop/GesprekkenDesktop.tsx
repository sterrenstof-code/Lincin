import type { ReactNode } from "react";

import { Pic, Spec, Sq, klikbaar } from "./Delen";

/**
 * Gesprekken op desktop (gesprekken.png): links de lijst (340), in het midden
 * het gesprek, rechts wie het is en wat er gedeeld is (300). In elke
 * weergave hetzelfde; alleen het kader verschilt.
 *
 * Het gesprek zelf is in de app de bestaande draad (`ChatDetail`, ingebed);
 * de testpagina geeft vaste berichten (`Bubbel`, `GedeeldStuk`).
 */

export type GesprekRij = {
  id: string;
  naam: string;
  regel: string;
  tijd: string;
  nieuw: number;
  linc: { beeld?: string | null; kleur: string | null; initiaal: string };
  open: () => void;
};

type Linc = GesprekRij["linc"];

function Gezicht({ linc, b, h = b }: { linc: Linc; b: number; h?: number }) {
  if (linc.beeld) return <Pic stuk={{ beeld: linc.beeld }} b={b} h={h} />;
  return <Sq kleur={linc.kleur} initiaal={linc.initiaal} maat={b} />;
}

export function GesprekkenDesktop({
  rijen,
  gekozen,
  ongelezen,
  stand,
  draad,
  invoer,
  gedeeld,
  gedeeldAantal,
}: {
  rijen: GesprekRij[];
  gekozen: string | null;
  ongelezen: number;
  /** Een tekst in plaats van de lijst: laden, mislukt, nog niemand. */
  stand?: string | null;
  /** Het gesprek; zonder gekozen gesprek blijft het midden leeg. */
  draad: ReactNode;
  /** De invoer onder het gesprek, als de draad hem niet zelf heeft. */
  invoer?: ReactNode;
  /** Wat in dit gesprek gedeeld is (een raster); null laat het blok weg. */
  gedeeld?: ReactNode;
  /** Hoeveel er gedeeld is, rechts in de strook. */
  gedeeldAantal?: number;
}) {
  const g = rijen.find((r) => r.id === gekozen) ?? null;
  return (
    <div className="grid" style={{ gridTemplateColumns: "340px minmax(0,1fr) 300px" }} data-meet="gesprekken">
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        <div className="strip">
          <Spec
            rijen={[
              ["Gesprekken", rijen.length],
              ["Nieuw", `${ongelezen} ongelezen`],
            ]}
          />
        </div>
        <div className="scroll" style={{ display: "flex", flexDirection: "column", gap: 2, flex: "none", maxHeight: "100%" }}>
          {rijen.map((x) => (
            <a
              key={x.id}
              className="tile"
              aria-current={x.id === gekozen ? "true" : undefined}
              style={{ height: 80, flex: "none", flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "flex-start", padding: "0 16px" }}
              {...klikbaar(x.open)}
              data-meet="gesprek"
            >
              <Gezicht linc={x.linc} b={48} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                <span style={{ fontWeight: x.nieuw ? 600 : 500 }}>{x.naam}</span>
                <span style={{ fontSize: 13, color: "var(--two)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.regel}</span>
              </span>
              <span className="S dim" style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                {x.tijd}
                {x.nieuw ? (
                  <span style={{ minWidth: 18, height: 18, padding: "0 5px", background: "var(--k)", color: "var(--onk)", display: "flex", alignItems: "center", justifyContent: "center", letterSpacing: 0, fontWeight: 700 }}>
                    {x.nieuw}
                  </span>
                ) : null}
              </span>
            </a>
          ))}
        </div>
        {stand ? (
          <div className="S dim" style={{ background: "var(--g)", padding: "18px 16px", flex: "none" }}>
            {stand}
          </div>
        ) : null}
        <span style={{ flex: 1, background: "var(--g)" }} />
      </section>
      <section style={{ display: "flex", flexDirection: "column", background: "var(--g)", minWidth: 0, minHeight: 0 }}>
        {g ? (
          <>
            <div className="strip" style={{ justifyContent: "flex-start", borderBottom: "2px solid var(--seam)" }}>
              <Gezicht linc={g.linc} b={36} />
              <Spec
                rijen={[
                  ["Gesprek", g.naam],
                  ["Slot", "versleuteld"],
                ]}
              />
            </div>
            {draad}
            {invoer}
          </>
        ) : (
          <span className="S dim" style={{ margin: "auto" }}>
            Kies een gesprek
          </span>
        )}
      </section>
      <aside style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        {g ? (
          <div style={{ background: "var(--g)", padding: "24px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <Gezicht linc={g.linc} b={120} h={g.linc.beeld ? 150 : 120} />
            <span className="T" style={{ alignSelf: "flex-start", fontSize: 38, overflowWrap: "anywhere" }}>
              {g.naam}
            </span>
          </div>
        ) : null}
        {g && gedeeld !== null && gedeeld !== undefined ? (
          <>
            <div className="strip S" style={{ height: 40 }}>
              Gedeeld in dit gesprek
              {gedeeldAantal ? <span className="dim">{gedeeldAantal}</span> : null}
            </div>
            <div className="scroll" style={{ flex: "0 1 auto", minHeight: 0 }}>
              {gedeeld}
            </div>
          </>
        ) : null}
        <span style={{ flex: 1, background: "var(--g)" }} />
      </aside>
    </div>
  );
}

/** Een vast bericht (testpagina): de jouwe op inkt, die van de ander op een kaart. */
export function Bubbel({ tekst, mij }: { tekst: string; mij: boolean }) {
  return (
    <span
      style={{
        alignSelf: mij ? "flex-end" : "flex-start",
        maxWidth: 420,
        padding: "12px 14px",
        background: mij ? "var(--k)" : "var(--card)",
        color: mij ? "var(--onk)" : "var(--k)",
        lineHeight: 1.35,
      }}
    >
      {tekst}
    </span>
  );
}

/** Een gedeelde bijdrage in een gesprek. */
export function GedeeldStuk({ beeld, rijen, open }: { beeld: string | null; rijen: [string, string][]; open: () => void }) {
  return (
    <a style={{ alignSelf: "flex-start", width: 250, background: "var(--card)", padding: 12, display: "flex", gap: 12, alignItems: "flex-end" }} {...klikbaar(open)}>
      <Pic stuk={{ beeld }} b={90} h={114} />
      <Spec rijen={rijen} />
    </a>
  );
}

/** De berichten, met ruimte ertussen; onderaan het laatste. */
export function Berichten({ children }: { children: ReactNode }) {
  return (
    <div className="scroll" style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12, padding: 24 }}>
      {children}
    </div>
  );
}

/** Het invoerveld onder een vast gesprek. */
export function BerichtInvoer({ aan, waarde, tekst, stuur }: { aan: string; waarde: string; tekst: (v: string) => void; stuur: () => void }) {
  return (
    <form
      style={{ height: 72, flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "0 16px", background: "var(--card)" }}
      onSubmit={(e) => {
        e.preventDefault();
        stuur();
      }}
    >
      <input className="field" style={{ height: 48 }} aria-label="Schrijf een bericht" placeholder={`Schrijf een bericht aan ${aan}`} autoComplete="off" value={waarde} onChange={(e) => tekst(e.target.value)} />
      <button className="btn S" style={{ height: 48 }} type="submit">
        Stuur
      </button>
    </form>
  );
}

/** Een gedeeld stuk in de zijkolom: een vak van 200 hoog. */
export function GedeeldVak({ nr, soort, beeld, rijen, open }: { nr: string; soort: string; beeld: string | null; rijen: [string, string][]; open: () => void }) {
  return (
    <a className="tile" style={{ height: 200 }} {...klikbaar(open)}>
      <span className="S dim" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{nr}</span>
        <span>{soort}</span>
      </span>
      <span className="obj">
        <Pic stuk={{ beeld }} b={90} h={114} />
      </span>
      <Spec rijen={rijen} />
    </a>
  );
}
