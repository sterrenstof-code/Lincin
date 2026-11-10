import { Pic, Spec, Sq, klikbaar } from "./Delen";

/**
 * Meldingen op desktop. Niet apart ontworpen: de opbouw van Gesprekken
 * (stroken van 56, rijen als vakken, naden van 2) en de inhoud van Meldingen
 * op de telefoon (ontwerp 08).
 *
 *   links    de meldingen, nieuwste eerst; een nieuwe met een punt in de
 *            accentkleur, een linc-verzoek met Accepteer en Negeer in de rij
 *   rechts   (340) de tellers en "Alles gelezen"
 */

export type MeldingDesktop = {
  id: string;
  linc: { beeld?: string | null; kleur: string | null; initiaal: string };
  naam: string;
  rest: string;
  tijd: string;
  nieuw: boolean;
  open: () => void;
  keuze?: { ja: string; nee: string; doeJa: () => void; doeNee: () => void };
};

export function MeldingenDesktop({
  rijen,
  nieuw,
  verzoeken,
  allesGelezen,
  stand,
}: {
  rijen: MeldingDesktop[];
  nieuw: number;
  verzoeken: number;
  allesGelezen: () => void;
  /** Een tekst in plaats van de lijst: laden, mislukt, nog niets. */
  stand?: string | null;
}) {
  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }} data-meet="meldingen">
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0, minWidth: 0 }}>
        <div className="strip">
          <Spec
            rijen={[
              ["Meldingen", rijen.length],
              ["Nieuw", nieuw],
            ]}
          />
        </div>
        {stand || !rijen.length ? (
          <div style={{ flex: 1, background: "var(--g)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="S dim">{stand ?? "Nog geen meldingen"}</span>
          </div>
        ) : (
          <div className="scroll" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 2 }}>
            {rijen.map((m) => (
              <a
                key={m.id}
                className="tile"
                style={{ minHeight: 76, flex: "none", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: 14, padding: "12px 16px", ...(m.nieuw ? { background: "var(--card)" } : null) }}
                {...klikbaar(m.open)}
                data-meet="melding"
              >
                {m.linc.beeld ? <Pic stuk={{ beeld: m.linc.beeld }} b={44} h={44} /> : <Sq kleur={m.linc.kleur} initiaal={m.linc.initiaal} maat={44} />}
                <span style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                  {m.naam ? <span style={{ fontWeight: 600 }}>{m.naam}</span> : null}
                  {m.rest}
                </span>
                {m.keuze ? (
                  <span style={{ display: "flex", gap: 6, flex: "none" }}>
                    <button
                      className="btn S"
                      onClick={(e) => {
                        e.stopPropagation();
                        m.keuze!.doeJa();
                      }}
                    >
                      {m.keuze.ja}
                    </button>
                    <button
                      className="btn S ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        m.keuze!.doeNee();
                      }}
                    >
                      {m.keuze.nee}
                    </button>
                  </span>
                ) : null}
                <span className="S dim" style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, minWidth: 64, justifyContent: "flex-end" }}>
                  {m.nieuw ? <span className="dot" aria-label="nieuw" /> : null}
                  {m.tijd}
                </span>
              </a>
            ))}
            <span style={{ flex: 1, background: "var(--g)", minHeight: 0 }} />
          </div>
        )}
      </section>
      <aside style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        <div style={{ background: "var(--g)", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 20 }}>
          <span className="T" style={{ fontSize: 38 }}>
            Meldingen
          </span>
          <Spec
            rijen={[
              ["Nieuw", nieuw],
              ["Linc-verzoeken", verzoeken],
              ["Totaal", rijen.length],
            ]}
          />
          <button className="btn S ghost" style={{ alignSelf: "flex-start" }} onClick={allesGelezen} disabled={!nieuw}>
            Alles gelezen
          </button>
        </div>
        <span style={{ flex: 1, background: "var(--g)" }} />
      </aside>
    </div>
  );
}
