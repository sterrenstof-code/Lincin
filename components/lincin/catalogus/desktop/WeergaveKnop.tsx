import { useEffect, useRef } from "react";

import type { Stand, Weergave } from "./typen";

/**
 * De knop Weergave (briefing §3): rechts in de bovenbalk, of bij `blad`
 * onderaan de tabbladen. Open: gevuld met inkt, en het menu van 340 breed
 * met de vier weergaven en daaronder de stand.
 *
 * Kiezen sluit het menu en wisselt meteen. Esc en een klik buiten het menu
 * sluiten het; Esc gaat dan niet ook nog naar het paneel.
 */

const RIJEN: [Weergave, string, string][] = [
  ["wand", "Wand", "Alle stukken naast elkaar op één wand"],
  ["blad", "Wand op blad", "De wand op een blad met tabbladen"],
  ["lichtbak", "Lichtbak", "Eén stuk tegelijk op zijn eigen kleuren"],
  ["gloedraster", "Gloedraster", "Alle stukken in een raster op een kleurveld"],
];

/** Het kleine schema van elke weergave, 34 × 20 op 40 × 24. */
function Schema({ w }: { w: Weergave }) {
  return (
    <svg aria-hidden="true" width={40} height={24} viewBox="0 0 34 20" fill="none" stroke="currentColor" strokeWidth={1.4}>
      {w === "wand" ? (
        <>
          <rect x="1" y="3" width="9" height="13" />
          <rect x="13" y="7" width="8" height="9" />
          <rect x="24" y="5" width="9" height="11" />
          <path d="M0 19h34" />
        </>
      ) : w === "blad" ? (
        <>
          <rect x="8" y="1" width="25" height="18" />
          <path d="M8 5H2v4h6M8 11H3v4h5" />
          <rect x="12" y="6" width="6" height="8" />
          <rect x="21" y="8" width="7" height="6" />
        </>
      ) : w === "lichtbak" ? (
        <>
          <rect x="11" y="1" width="12" height="13" />
          <path d="M3 18h5M10 18h5M17 18h5M24 18h5" />
        </>
      ) : (
        <path d="M1 1h32v18H1zM1 10h32M9 1v18M17 1v18M25 1v18" />
      )}
    </svg>
  );
}

export function WeergaveKnop({
  weergave,
  open,
  zetOpen,
  kies,
  stand,
  kiesStand,
  links = false,
}: {
  weergave: Weergave;
  open: boolean;
  zetOpen: (open: boolean) => void;
  kies: (w: Weergave) => void;
  stand: Stand;
  kiesStand: (s: Stand) => void;
  /** Bij `blad`: het menu opent naar rechts boven, vanaf de onderkant van de knop. */
  links?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const naam = RIJEN.find((r) => r[0] === weergave)?.[1] ?? "";

  useEffect(() => {
    if (!open) return;
    const toets = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      zetOpen(false);
    };
    const klik = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) zetOpen(false);
    };
    // Vangen vóór de toetsen van de feed, zodat Esc alleen het menu sluit.
    window.addEventListener("keydown", toets, true);
    document.addEventListener("mousedown", klik, true);
    return () => {
      window.removeEventListener("keydown", toets, true);
      document.removeEventListener("mousedown", klik, true);
    };
  }, [open, zetOpen]);

  const donker = stand === "donker";
  const standKnop = (s: Stand, label: string) => {
    const aan = stand === s;
    return (
      <button
        className="S"
        aria-pressed={aan}
        onClick={() => kiesStand(s)}
        style={{ height: 36, padding: "0 14px", ...(aan ? { background: "var(--k)", color: "var(--onk)" } : { border: "1px solid var(--k)" }) }}
      >
        {label}
      </button>
    );
  };

  return (
    <span className="wk" ref={ref} data-meet="wk">
      <button
        className="wkbtn S"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`Weergave: ${naam}. Verander de weergave`}
        onClick={() => zetOpen(!open)}
        data-meet="wkbtn"
      >
        Weergave<span aria-hidden="true">{open ? "×" : "▾"}</span>
      </button>
      {open ? (
        <div className={links ? "menu links" : "menu"} role="menu" aria-label="Weergave" data-meet="menu">
          <div className="S dim" style={{ height: 40, display: "flex", alignItems: "center", padding: "0 16px" }}>
            Weergave van de editie
          </div>
          {RIJEN.map(([k, n, d]) => (
            <button
              key={k}
              className="rij"
              role="menuitemradio"
              aria-checked={weergave === k}
              data-meet="menurij"
              onClick={() => {
                zetOpen(false);
                kies(k);
              }}
            >
              <Schema w={k} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontWeight: 600 }}>{n}</span>
                <span style={{ fontSize: 12, color: "var(--two)" }}>{d}</span>
              </span>
              <span aria-hidden="true">{weergave === k ? "✓" : ""}</span>
            </button>
          ))}
          <div style={{ height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", borderTop: "2px solid var(--g)" }}>
            <span className="S dim">Stand</span>
            <span role="group" aria-label="Stand" style={{ display: "flex" }} data-donker={donker}>
              {standKnop("licht", "Licht")}
              {standKnop("donker", "Donker")}
            </span>
          </div>
        </div>
      ) : null}
    </span>
  );
}
