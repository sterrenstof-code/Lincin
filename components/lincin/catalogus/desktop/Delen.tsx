import { useEffect, useState, type CSSProperties, type ReactNode } from "react";

import type { DStuk } from "./typen";

/**
 * De kleinste onderdelen van catalogus op desktop: het kaartje, het beeld,
 * het vierkant van een linc en de pictogrammen. Webonderdelen (zie stijl.ts).
 */

/** Het kaartje: label links, waarde rechts. `wit`: de labels in de tekstkleur. */
export function Spec({ rijen, wit, style, meet }: { rijen: [string, ReactNode][]; wit?: boolean; style?: CSSProperties; meet?: string }) {
  return (
    <span className={wit ? "spec wit" : "spec"} style={style} data-meet={meet}>
      {rijen.map(([k, v], i) => [<span key={`k${i}`}>{k}</span>, <span key={`v${i}`}>{v}</span>])}
    </span>
  );
}

/** Een beeld op een vaste maat, bijgesneden; of het voorwerp van een stuk zonder foto. */
export function Pic({
  stuk,
  b,
  h,
  style,
  meet,
  picRef,
}: {
  stuk: Pick<DStuk, "beeld" | "voorwerp">;
  b: number;
  h: number;
  style?: CSSProperties;
  meet?: string;
  picRef?: (el: HTMLSpanElement | null) => void;
}) {
  const v = stuk.voorwerp;
  return (
    <span ref={picRef} className="pic" data-meet={meet} style={{ width: b, height: h, ...style }}>
      {stuk.beeld ? <img src={stuk.beeld} alt="" draggable={false} /> : null}
      {!stuk.beeld && v ? (
        <span className="ding" style={{ width: v.b, height: v.h, transform: `scale(${Math.min(b / v.b, h / v.h)})` }}>
          {v.node}
        </span>
      ) : null}
    </span>
  );
}

/** Een linc: zijn foto, of een vierkant in zijn kleur met zijn initiaal. */
export function Sq({ kleur, initiaal, beeld, maat }: { kleur: string | null; initiaal: string; beeld?: string | null; maat: number }) {
  return (
    <span className="sq" aria-hidden="true" style={{ width: maat, height: maat, background: kleur ?? "#D9D7D1", fontSize: Math.max(10, maat / 3) }}>
      {beeld ? <img src={beeld} alt="" /> : initiaal}
    </span>
  );
}

export function Hart({ aan, maat = 22 }: { aan: boolean; maat?: number }) {
  return (
    <svg aria-hidden="true" width={maat} height={maat} viewBox="0 0 24 24" fill={aan ? "var(--acc)" : "none"} stroke={aan ? "var(--acc)" : "currentColor"} strokeWidth={1.8} strokeLinejoin="round">
      <path d="M12 20.5s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10Z" />
    </svg>
  );
}

export function Ballon({ maat = 22 }: { maat?: number }) {
  return (
    <svg aria-hidden="true" width={maat} height={maat} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
      <path d="M4 5.5h16v11H9.5L5.5 20v-3.5H4z" />
    </svg>
  );
}

/** Hartje en reacties, zoals onder een stuk. */
export function Acties({ hartjes, vindIkLeuk, reacties, leuk, reageer }: { hartjes: number; vindIkLeuk: boolean; reacties: number; leuk: () => void; reageer: () => void }) {
  return (
    <>
      <button className="act" aria-pressed={vindIkLeuk} aria-label="Vind ik leuk" onClick={leuk}>
        <Hart aan={vindIkLeuk} maat={24} />
        {hartjes}
      </button>
      <button className="act" aria-label="Reacties" onClick={reageer}>
        <Ballon maat={24} />
        {reacties}
      </button>
    </>
  );
}

/** Een klik op een element dat geen knop is, ook met Enter of spatie. */
export function klikbaar(doe: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: (e: { preventDefault: () => void }) => {
      e.preventDefault();
      doe();
    },
    onKeyDown: (e: { key: string; preventDefault: () => void; stopPropagation: () => void }) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        e.stopPropagation();
        doe();
      }
    },
  };
}

/** "02 van 08" */
export function plaat(i: number, n: number): string {
  const p = (x: number) => String(x).padStart(2, "0");
  return `${p(i + 1)} van ${p(n)}`;
}

/** De maat van het venster, opnieuw bij elke wijziging. */
export function useVenster(): { b: number; h: number } {
  const lees = () => (typeof window === "undefined" ? { b: 1440, h: 900 } : { b: window.innerWidth, h: window.innerHeight });
  const [v, setV] = useState(lees);
  useEffect(() => {
    const f = () => setV(lees());
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return v;
}

/**
 * De maten van het ontwerp gelden bij een venster van 900 hoog. Hoger of lager
 * schaalt een voorwerp mee, zodat de verhoudingen blijven.
 */
export const ONTWERP_HOOGTE = 900;
