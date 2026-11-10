import { useEffect, useRef, useState } from "react";

import { Acties, Spec, Sq, TekstMetNamen, klikbaar } from "./Delen";
import type { PaneelInhoud, PaneelNav } from "./typen";

/**
 * Het paneel van een geopend stuk (briefing §4), in alle vier de weergaven
 * hetzelfde. Van boven naar beneden: het kaartje (plaat, wie, soort) met
 * sluiten en ← →, de titel met datum en aantal reacties, hartje en reacties
 * met "Bericht aan …", de draad, het invoerveld. Het beeld staat er niet in:
 * dat ligt groot links.
 *
 * De inhoud komt van de bijdragepagina (`useBijdrage`); `nav` is van de feed.
 * Het paneel beweegt als één vlak (`.drawer` in FeedDesktop): de blokken
 * hierin hebben geen eigen overgang.
 *
 * Een klik op een reactie maakt er een antwoord van; dan staat boven het
 * invoerveld "Antwoord aan …" met een kruisje.
 */
/**
 * ⋯ bij je eigen bijdrage: bewerken en verwijderen. Esc en een klik buiten
 * het menu sluiten het menu, niet het paneel.
 */
function EigenMenu({ eigen }: { eigen: NonNullable<PaneelInhoud["eigen"]> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const toets = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      setOpen(false);
    };
    const klik = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("keydown", toets, true);
    document.addEventListener("mousedown", klik, true);
    return () => {
      window.removeEventListener("keydown", toets, true);
      document.removeEventListener("mousedown", klik, true);
    };
  }, [open]);
  return (
    <span ref={ref} style={{ display: "flex" }}>
      <button className="ib" aria-label="Meer: bewerken of verwijderen" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-meet="eigenknop">
        ⋯
      </button>
      {open ? (
        <span className="eigenmenu" role="menu" aria-label="Je bijdrage" data-meet="eigenmenu">
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              eigen.bewerk();
            }}
          >
            Bewerk deze bijdrage
          </button>
          <button
            role="menuitem"
            style={{ color: "var(--gevaar)" }}
            onClick={() => {
              setOpen(false);
              eigen.verwijder();
            }}
          >
            Verwijder deze bijdrage
          </button>
        </span>
      ) : null}
    </span>
  );
}

export function Paneel({ inhoud: p, nav }: { inhoud: PaneelInhoud; nav: PaneelNav }) {
  const veld = useRef<HTMLInputElement>(null);
  const bewerken = p.eigen?.bewerken ?? null;
  useEffect(() => {
    if (p.antwoordAan) veld.current?.focus();
  }, [p.antwoordAan]);

  return (
    <div className="panel" data-meet="paneel">
      <div className="strip" style={{ background: "var(--card)", padding: "0 6px 0 20px", position: "relative" }} data-meet="paneel-kop">
        <Spec
          rijen={[
            ["Plaat", nav.plaat],
            ["Wie", p.wie],
            ["Soort", p.soort],
          ]}
        />
        <span style={{ display: "flex" }}>
          {p.eigen ? <EigenMenu eigen={p.eigen} /> : null}
          <button className="ib" aria-label="Sluit" onClick={nav.sluit}>
            ✕
          </button>
          <button className="ib" aria-label="Vorige bijdrage" onClick={nav.vorige}>
            ←
          </button>
          <button className="ib" aria-label="Volgende bijdrage" onClick={nav.volgende}>
            →
          </button>
        </span>
      </div>
      <div style={{ flex: "none", padding: "18px 20px 8px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }} data-meet="paneel-titel">
        {nav.pagina ? (
          <a className="T naarpagina" style={{ fontSize: 46, minWidth: 0, overflowWrap: "anywhere" }} href="#" {...klikbaar(nav.pagina)} role="link" aria-label={`${p.titel}: open de bijdrage`} data-meet="naarpagina">
            {p.titel}
          </a>
        ) : (
          <span className="T" style={{ fontSize: 46, minWidth: 0, overflowWrap: "anywhere" }}>
            {p.titel}
          </span>
        )}
        <span style={{ width: 150, flex: "none" }}>
          <Spec
            rijen={[
              ["Datum", p.datum],
              ["Reacties", p.aantalReacties],
            ]}
          />
        </span>
      </div>
      <div style={{ height: 48, flex: "none", display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderBottom: "2px solid var(--g)" }} data-meet="paneel-acties">
        <Acties hartjes={p.hartjes} vindIkLeuk={p.vindIkLeuk} reacties={p.aantalReacties} leuk={p.doe.leuk} reageer={() => veld.current?.focus()} />
        <span style={{ flex: 1 }} />
        {p.berichtAan ? (
          <a className="S link" style={{ padding: "0 8px" }} role="button" tabIndex={0} onClick={p.doe.bericht} onKeyDown={(e) => e.key === "Enter" && p.doe.bericht()}>
            Bericht aan {p.berichtAan}
          </a>
        ) : null}
      </div>
      <div className="scroll" style={{ flex: 1 }} data-meet="paneel-draad">
        {bewerken ? (
          <div className="bewerk" data-meet="bewerk">
            <div className="S dim" style={{ marginBottom: 14 }}>
              Bewerk deze bijdrage
            </div>
            {bewerken}
          </div>
        ) : p.reacties.length ? (
          p.reacties.map((c) => (
            <div
              key={c.id}
              className="cm"
              style={{ paddingLeft: 20 + (c.antwoord ? 38 : 0) }}
              role="button"
              tabIndex={0}
              aria-label={`Antwoord aan ${c.naam}`}
              onClick={() => p.doe.antwoord(c.id)}
              onKeyDown={(e) => e.key === "Enter" && p.doe.antwoord(c.id)}
            >
              <Sq kleur={c.linc.kleur} initiaal={c.linc.initiaal} beeld={c.linc.beeld} maat={28} />
              <span style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 2, paddingBottom: 10 }}>
                <span className="S">{c.naam}</span>
                <span style={{ lineHeight: 1.35, overflowWrap: "anywhere" }}>
                  <TekstMetNamen tekst={c.tekst} profiel={p.doe.profiel} />
                </span>
              </span>
            </div>
          ))
        ) : (
          <div className="S dim" style={{ padding: "18px 20px" }}>
            Nog geen reacties
          </div>
        )}
        {p.meer}
      </div>
      {p.antwoordAan && !bewerken ? (
        <div className="S" style={{ height: 36, flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px 0 20px", borderTop: "2px solid var(--g)" }}>
          <span>
            <span className="dim">Antwoord aan </span>
            {p.antwoordAan}
          </span>
          <button className="ib" style={{ width: 36, height: 36, fontSize: 14 }} aria-label="Geen antwoord" onClick={p.doe.stopAntwoord}>
            ✕
          </button>
        </div>
      ) : null}
      <form
        style={{ height: 64, flex: "none", display: bewerken ? "none" : "flex", alignItems: "center", gap: 8, padding: "0 20px", borderTop: "2px solid var(--g)" }}
        onSubmit={(e) => {
          e.preventDefault();
          p.doe.stuur();
        }}
        data-meet="paneel-invoer"
      >
        <input
          ref={veld}
          className="field"
          aria-label="Schrijf een reactie"
          placeholder={p.antwoordAan ? `Antwoord aan ${p.antwoordAan}` : "Schrijf een reactie"}
          autoComplete="off"
          value={p.invoer}
          onChange={(e) => p.doe.tekst(e.target.value)}
        />
        <button className="btn S" type="submit">
          Stuur
        </button>
      </form>
    </div>
  );
}
