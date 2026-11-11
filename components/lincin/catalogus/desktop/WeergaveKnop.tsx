import type { Stand, Weergave } from "./typen";

/**
 * De weergave in de bovenbalk: twee knoppen met elk hun schema, Wand en
 * Gloedraster, en daarnaast licht of donker. Eén klik wisselt meteen.
 *
 * Sinds nov 2026 alleen nog deze twee; Wand op blad en Lichtbak bestaan nog
 * als testpagina's (dev), maar je kiest ze niet meer.
 */

export const KEUZES: [Weergave, string][] = [
  ["wand", "Wand"],
  ["gloedraster", "Gloedraster"],
];

/** Het kleine schema van elke weergave. */
function Schema({ w }: { w: Weergave }) {
  return (
    <svg aria-hidden="true" width={26} height={16} viewBox="0 0 34 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
      {w === "wand" ? (
        <>
          <rect x="1" y="3" width="9" height="13" />
          <rect x="13" y="7" width="8" height="9" />
          <rect x="24" y="5" width="9" height="11" />
          <path d="M0 19h34" />
        </>
      ) : (
        <path d="M1 1h32v18H1zM1 10h32M9 1v18M17 1v18M25 1v18" />
      )}
    </svg>
  );
}

function StandTeken({ donker }: { donker: boolean }) {
  return (
    <svg aria-hidden="true" width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}>
      {donker ? (
        <path d="M13.5 9.6A5.8 5.8 0 0 1 6.4 2.5a5.8 5.8 0 1 0 7.1 7.1z" />
      ) : (
        <>
          <circle cx="8" cy="8" r="3" />
          <path d="M8 .8v2M8 13.2v2M.8 8h2M13.2 8h2M2.9 2.9l1.4 1.4M11.7 11.7l1.4 1.4M2.9 13.1l1.4-1.4M11.7 4.3l1.4-1.4" />
        </>
      )}
    </svg>
  );
}

export function WeergaveKnop({
  weergave,
  kies,
  stand,
  kiesStand,
}: {
  weergave: Weergave;
  kies: (w: Weergave) => void;
  stand: Stand;
  kiesStand: (s: Stand) => void;
}) {
  const donker = stand === "donker";
  return (
    <span className="wk" data-meet="wk">
      <span className="wkgroep" role="radiogroup" aria-label="Weergave">
        {KEUZES.map(([k, naam]) => (
          <button
            key={k}
            className="wkbtn"
            role="radio"
            aria-checked={weergave === k}
            aria-label={naam}
            title={naam}
            onClick={() => weergave !== k && kies(k)}
            data-meet="wkkeuze"
            data-w={k}
          >
            <Schema w={k} />
          </button>
        ))}
      </span>
      <button
        className="wkbtn wkstand"
        aria-label={donker ? "Licht" : "Donker"}
        title={donker ? "Licht" : "Donker"}
        onClick={() => kiesStand(donker ? "licht" : "donker")}
        data-meet="wkstand"
      >
        <StandTeken donker={!donker} />
      </button>
    </span>
  );
}
