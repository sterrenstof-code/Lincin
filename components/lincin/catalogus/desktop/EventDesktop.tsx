import type { ReactNode } from "react";

import { LegeVakken, Pic, Spec, Sq, klikbaar, useLegeVakken } from "./Delen";

/**
 * Een event op desktop. Niet apart ontworpen: de inhoud van de eventpagina van
 * catalogus (EventView) in de opbouw van Jij.
 *
 *   links (400)   de datum op een kaart, de titel, het kaartje, de
 *                 omschrijving, de gasten, Ik kom / Misschien, de handelingen
 *   rechts        de foto's en video's als vakken; een klik opent de lichtbak
 */

export type EventFoto = {
  id: string;
  beeld: string | null;
  video: boolean;
  /** Tekst of link zonder beeld. */
  tekst?: string;
  wie: string;
  tijd: string;
  open?: () => void;
  verwijder?: () => void;
};

export function EventDesktop({
  dag,
  maand,
  titel,
  regels,
  omschrijving,
  cover,
  gasten,
  gastenOpen,
  antwoord,
  kom,
  misschien,
  telling,
  voorbij,
  voegToe,
  voegToeTekst,
  voegToeUit,
  handelingen,
  fout,
  melding,
  fotos,
  leeg,
  lagen,
}: {
  dag: string;
  maand: string;
  titel: string;
  regels: [string, string][];
  omschrijving?: string | null;
  cover?: { beeld: string; open: () => void } | null;
  gasten: { naam: string; beeld?: string | null; kleur: string | null; initiaal: string }[];
  gastenOpen: () => void;
  antwoord: "yes" | "maybe" | null;
  kom: () => void;
  misschien: () => void;
  telling: string;
  voorbij: boolean;
  voegToe: () => void;
  voegToeTekst: string;
  voegToeUit?: boolean;
  handelingen: { label: string; doe: () => void }[];
  fout?: string | null;
  melding: string;
  fotos: EventFoto[];
  leeg?: { titel: string; tekst: string } | null;
  /** Bladen die erover schuiven (gasten, instellingen, toevoegen). */
  lagen?: ReactNode;
}) {
  const [raster, leeg2] = useLegeVakken(fotos.length);
  const keuze = (label: string, aan: boolean, doe: () => void) => (
    <button
      key={label}
      role="radio"
      aria-checked={aan}
      disabled={voorbij}
      className="S"
      onClick={doe}
      style={{ flex: 1, height: 44, opacity: voorbij ? 0.5 : 1, ...(aan ? { background: "var(--k)", color: "var(--onk)" } : { border: "1px solid var(--k)" }) }}
    >
      {label}
    </button>
  );
  return (
    <div className="grid" style={{ gridTemplateColumns: "400px minmax(0,1fr)" }} data-meet="eventpagina">
      <section className="scroll" style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        <div style={{ background: "var(--g)", padding: "24px 20px", display: "flex", flexDirection: "column", gap: 20, flex: "none" }}>
          {cover ? (
            <a {...klikbaar(cover.open)} aria-label="Bekijk de omslag" style={{ alignSelf: "stretch", cursor: "zoom-in" }}>
              <img src={cover.beeld} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", display: "block" }} />
            </a>
          ) : null}
          <span style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <span style={{ width: 96, height: 120, flex: "none", background: "var(--card)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span className="T" style={{ fontSize: 60, lineHeight: 0.8 }}>
                {dag}
              </span>
              <span className="S">{maand}</span>
            </span>
            <span className="T" style={{ fontSize: 38, overflowWrap: "break-word", minWidth: 0 }}>
              {titel}
            </span>
          </span>
          <Spec rijen={regels} />
          {omschrijving ? <span style={{ fontSize: 15, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "break-word" }}>{omschrijving}</span> : null}
        </div>
        <a className="tile" style={{ flex: "none", flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, minHeight: 64 }} {...klikbaar(gastenOpen)} data-meet="gasten">
          <span style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            {gasten.slice(0, 12).map((g, i) =>
              g.beeld ? <Pic key={i} stuk={{ beeld: g.beeld }} b={28} h={28} /> : <Sq key={i} kleur={g.kleur} initiaal={g.initiaal} maat={28} />,
            )}
          </span>
          <span className="S dim" style={{ flex: "none" }}>
            {telling} →
          </span>
        </a>
        <div style={{ background: "var(--g)", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, flex: "none" }}>
          <span role="radiogroup" aria-label="Kom je?" style={{ display: "flex", gap: 6 }}>
            {keuze("Ik kom", antwoord === "yes", kom)}
            {keuze("Misschien", antwoord === "maybe", misschien)}
          </span>
          <button className="btn S" style={{ justifyContent: "center", opacity: voegToeUit ? 0.4 : 1 }} disabled={voegToeUit} onClick={voegToe}>
            {voegToeTekst}
          </button>
          {handelingen.map((h) => (
            <button key={h.label} className="btn S ghost" style={{ justifyContent: "center" }} onClick={h.doe}>
              {h.label}
            </button>
          ))}
          {fout ? (
            <span className="S" style={{ color: "var(--gevaar)" }}>
              {fout}
            </span>
          ) : null}
          <span className="S dim" style={{ lineHeight: 1.6 }}>
            {melding}
          </span>
        </div>
        <span style={{ flex: 1, minHeight: 2, background: "var(--g)" }} />
      </section>
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0, minWidth: 0 }}>
        <div className="strip">
          <Spec rijen={[["Bijdragen", fotos.length]]} />
        </div>
        {leeg || !fotos.length ? (
          <div style={{ flex: 1, background: "var(--g)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 40, textAlign: "center" }}>
            <span className="T" style={{ fontSize: 36 }}>
              {leeg?.titel ?? "Nog niets toegevoegd"}
            </span>
            {leeg ? <span style={{ maxWidth: 420, lineHeight: 1.5, color: "var(--two)" }}>{leeg.tekst}</span> : null}
          </div>
        ) : (
          <div className="scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            <div ref={raster} className="grid" style={{ flex: "none", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gridAutoRows: 280 }}>
              {fotos.map((f) => (
                <span key={f.id} className="tile" style={{ position: "relative", cursor: f.open ? "zoom-in" : "default" }} {...(f.open ? klikbaar(f.open) : {})} data-meet="eventfoto">
                  <span className="S dim" style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>{f.video ? "video" : f.beeld ? "foto" : "tekst"}</span>
                    <span>{f.tijd}</span>
                  </span>
                  <span className="obj">
                    {f.beeld && !f.video ? (
                      <Pic stuk={{ beeld: f.beeld }} b={150} h={180} />
                    ) : f.video && f.beeld ? (
                      <video src={f.beeld} muted playsInline preload="metadata" style={{ width: 150, height: 180, objectFit: "cover", background: "var(--ph)" }} />
                    ) : (
                      <span style={{ width: 150, height: 180, background: "var(--card)", padding: 10, fontSize: 13, overflow: "hidden" }}>{f.tekst}</span>
                    )}
                  </span>
                  <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <Spec rijen={[["Wie", f.wie]]} />
                    {f.verwijder ? (
                      <button
                        className="S link"
                        onClick={(e) => {
                          e.stopPropagation();
                          f.verwijder!();
                        }}
                      >
                        Verwijder
                      </button>
                    ) : null}
                  </span>
                </span>
              ))}
              <LegeVakken n={leeg2} />
            </div>
            <span style={{ flex: 1, minHeight: 0, background: "var(--g)" }} />
          </div>
        )}
      </section>
      {lagen}
    </div>
  );
}
