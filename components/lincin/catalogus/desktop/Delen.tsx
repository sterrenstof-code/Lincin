import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { tokenize } from "@/components/MentionsText";
import { openExternal } from "@/lib/safe-url";

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
  stuk: Pick<DStuk, "beeld" | "voorwerp"> & { fotos?: number };
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
      {stuk.fotos && stuk.fotos > 1 ? <AlbumTeken n={stuk.fotos} /> : null}
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

/**
 * Tekst met klikbare @namen (naar het profiel) en links, zoals `MentionsText`
 * in de andere thema's: een naam is vet, een link onderstreept. Een klik erop
 * gaat niet ook nog naar wat eromheen ligt (een reactie wordt dan geen antwoord).
 */
export function TekstMetNamen({ tekst, profiel }: { tekst: string; profiel?: (gebruiker: string) => void }) {
  return (
    <>
      {tokenize(tekst).map((d, i) =>
        d.type === "mention" && profiel ? (
          <a
            key={i}
            className="naam"
            href={`/user/${d.value}`}
            data-gebruiker={d.value}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              profiel(d.value);
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            @{d.value}
          </a>
        ) : d.type === "url" ? (
          <a
            key={i}
            className="link"
            href={/^https?:\/\//i.test(d.value) ? d.value : `https://${d.value}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openExternal(/^https?:\/\//i.test(d.value) ? d.value : `https://${d.value}`);
            }}
          >
            {d.value}
          </a>
        ) : (
          <span key={i}>{d.type === "mention" ? `@${d.value}` : d.value}</span>
        ),
      )}
    </>
  );
}

/** Een album: twee gestapelde vlakken en het aantal foto's, rechtsboven op de foto. */
export function AlbumTeken({ n }: { n: number }) {
  return (
    <span className="album" aria-label={`${n} foto's`} data-meet="album">
      <svg aria-hidden="true" width={9} height={9} viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth={1.3}>
        <rect x="0.7" y="3.7" width="8.6" height="8.6" />
        <path d="M3.7 3.7V.7h8.6v8.6H9.3" />
      </svg>
      {n}
    </span>
  );
}

/**
 * Hartje en reacties onder een stuk, klein. Het hartje werkt meteen; de ballon
 * opent het stuk. Een klik erop gaat niet ook naar het stuk eromheen.
 */
export function KleineActies({ hartjes, vindIkLeuk, reacties, leuk, reageer }: { hartjes: number; vindIkLeuk: boolean; reacties: number; leuk?: () => void; reageer?: () => void }) {
  const stop = (doe?: () => void) => ({
    onClick: (e: { preventDefault: () => void; stopPropagation: () => void }) => {
      e.preventDefault();
      e.stopPropagation();
      doe?.();
    },
    onKeyDown: (e: { stopPropagation: () => void }) => e.stopPropagation(),
  });
  return (
    <span className="kleine-acties" data-meet="acties">
      <button aria-pressed={vindIkLeuk} aria-label="Vind ik leuk" {...stop(leuk)}>
        <Hart aan={vindIkLeuk} maat={16} />
        {hartjes}
      </button>
      <button aria-label="Reacties" {...stop(reageer)}>
        <Ballon maat={16} />
        {reacties}
      </button>
    </span>
  );
}

/**
 * Een raster van vakken van minstens 220 breed: hoeveel lege vakken de laatste
 * rij nodig heeft, zodat daar het vlak staat en geen gat in de naad.
 */
export function useLegeVakken(aantal: number): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [kolommen, setKolommen] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setKolommen(Math.max(1, Math.floor((el.clientWidth + 2) / 222))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [aantal]);
  return [ref, (kolommen - (aantal % kolommen)) % kolommen];
}

export function LegeVakken({ n }: { n: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <span key={`leeg${i}`} style={{ background: "var(--g)" }} aria-hidden="true" />
      ))}
    </>
  );
}
