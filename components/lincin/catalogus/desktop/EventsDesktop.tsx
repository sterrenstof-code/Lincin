import { Spec, Sq, klikbaar } from "./Delen";

/**
 * Events op desktop (events.png): links de events als rijen met de datum
 * op een kaart, rechts de maand. In elke weergave hetzelfde; alleen het kader
 * verschilt. De rijen zijn die van de mobiele events (app/(app)/events.tsx).
 */

export type EventRij = {
  id: string;
  dag: string;
  maand: string;
  titel: string;
  regels: { label: string; waarde: string }[];
  komen: { kleur: string | null; initiaal: string }[];
  jijKomt: boolean;
  voorbij: boolean;
  open: () => void;
  kom: () => void;
  komNiet: () => void;
};

export type Maand = {
  /** "november 2026" */
  naam: string;
  /** Hoeveel lege vakken vóór de eerste (maandag = 0). */
  begin: number;
  dagen: number;
  vandaag: number | null;
  /** Dagen met een event, en de kleur van hun punt. */
  punten: Record<number, string>;
};

const DAGEN = ["ma", "di", "wo", "do", "vr", "za", "zo"];

export function EventsDesktop({ rijen, kop, maand, stand }: { rijen: EventRij[]; kop: [string, string][]; maand: Maand; stand?: string | null }) {
  const vakken: (number | null)[] = [...Array(maand.begin).fill(null), ...Array.from({ length: maand.dagen }, (_, i) => i + 1)];
  while (vakken.length % 7) vakken.push(null);
  const veel = rijen.length > 3;
  return (
    <div className="grid" style={{ gridTemplateColumns: "minmax(0,1fr) 400px" }} data-meet="events">
      <section style={{ display: "flex", flexDirection: "column", gap: 2, minHeight: 0 }}>
        <div className="strip">
          <Spec rijen={kop} />
        </div>
        {stand ? (
          <div style={{ flex: 1, background: "var(--g)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="S dim">{stand}</span>
          </div>
        ) : (
          <div
            className={veel ? "grid scroll" : "grid"}
            style={veel ? { gridAutoRows: "calc((100vh - 116px) / 3)" } : { gridTemplateRows: `repeat(${Math.max(1, rijen.length)},minmax(0,1fr))` }}
          >
            {rijen.map((e) => (
              <div key={e.id} style={{ background: "var(--g)", display: "grid", gridTemplateColumns: "200px minmax(0,1fr)", minHeight: 0, opacity: e.voorbij ? 0.55 : 1 }} data-meet="event">
                <a style={{ display: "flex", alignItems: "center", justifyContent: "center" }} {...klikbaar(e.open)} aria-label={e.titel}>
                  <span style={{ width: 120, height: 150, background: "var(--card)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6 }}>
                    <span className="T" style={{ fontSize: 80, lineHeight: 0.8 }}>
                      {e.dag}
                    </span>
                    <span className="S">{e.maand}</span>
                  </span>
                </a>
                <div style={{ padding: 18, display: "flex", flexDirection: "column", justifyContent: "space-between", borderLeft: "2px solid var(--seam)", minHeight: 0, minWidth: 0 }}>
                  <a className="T" style={{ fontSize: 36 }} {...klikbaar(e.open)}>
                    {e.titel}
                  </a>
                  <Spec rijen={e.regels.map((r) => [r.label, r.waarde])} />
                  <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ display: "flex", gap: 3 }}>
                      {e.komen.map((k, i) => (
                        <Sq key={i} kleur={k.kleur} initiaal={k.initiaal} maat={26} />
                      ))}
                    </span>
                    {e.voorbij ? (
                      <span className="S dim">Voorbij</span>
                    ) : (
                      <button className={e.jijKomt ? "btn S ghost" : "btn S"} aria-pressed={e.jijKomt} onClick={e.jijKomt ? e.komNiet : e.kom}>
                        {e.jijKomt ? "Je komt ✓" : "Ik kom"}
                      </button>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <aside style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <div className="strip">
          <Spec rijen={[["Maand", maand.naam]]} />
        </div>
        <div className="grid" style={{ flex: "none", gridTemplateColumns: "repeat(7,minmax(0,1fr))" }}>
          {DAGEN.map((d) => (
            <span key={d} className="S dim" style={{ height: 32, background: "var(--g)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {d}
            </span>
          ))}
          {vakken.map((d, i) => {
            const punt = d ? maand.punten[d] : undefined;
            const nu = d !== null && d === maand.vandaag;
            return (
              <span
                key={i}
                style={{
                  height: 52,
                  background: nu ? "var(--k)" : punt ? "var(--card)" : "var(--g)",
                  color: nu ? "var(--onk)" : "inherit",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  fontWeight: punt || nu ? 600 : 400,
                }}
              >
                {d ?? ""}
                {punt ? <span style={{ width: 6, height: 6, background: punt }} /> : null}
              </span>
            );
          })}
        </div>
        <span style={{ flex: 1, background: "var(--g)" }} />
      </aside>
    </div>
  );
}
