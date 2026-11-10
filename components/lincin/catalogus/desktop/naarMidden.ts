import { useEffect, useLayoutEffect, useState } from "react";

import { PANEEL } from "./stijl";
import type { Weergave } from "./typen";

/**
 * Het gekozen stuk naar het midden (briefing §4), voor alle vier de weergaven.
 *
 * `vrij` is de breedte links van het paneel binnen het vlak van de weergave,
 * `hoogte` de hoogte van dat vlak. De foto komt met zijn midden op het
 * midden van dat stuk vlak, horizontaal en verticaal, en groeit tot de
 * kleinste van de drie grenzen uit de tabel.
 *
 * Gemeten zonder transformaties: de plek van de foto in de opmaak (offsets),
 * niet wat er op dat moment te zien is. Zo maakt het niet uit of de wand nog
 * schuift of een vorig stuk nog terugkrimpt.
 */

const SCHAAL: Record<Weergave, { max: number; hoogte: number }> = {
  wand: { max: 1.7, hoogte: 0.74 },
  blad: { max: 1.7, hoogte: 0.74 },
  gloedraster: { max: 3.2, hoogte: 0.74 },
  lichtbak: { max: 1.5, hoogte: 0.82 },
};

/** De plek van `el` in het venster zoals de opmaak hem legt, zonder transformaties. */
function opmaakPlek(el: HTMLElement, vlak: HTMLElement): { x: number; y: number } {
  let x = 0;
  let y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== vlak) {
    x += n.offsetLeft;
    y += n.offsetTop;
    const p = n.offsetParent as HTMLElement | null;
    for (let s: HTMLElement | null = n.parentElement; s && s !== p; s = s.parentElement) {
      x -= s.scrollLeft;
      y -= s.scrollTop;
    }
    if (!p) break;
    x += p.clientLeft - p.scrollLeft;
    y += p.clientTop - p.scrollTop;
    n = p;
  }
  const r = vlak.getBoundingClientRect();
  return { x: r.left + x, y: r.top + y };
}

export type Doel = {
  /** Verschuiving van het midden van de foto, in px. */
  dx: number;
  dy: number;
  /** De schaal. */
  s: number;
};

export function meetDoel(foto: HTMLElement, vlak: HTMLElement, weergave: Weergave): Doel {
  const { x, y } = opmaakPlek(foto, vlak);
  const b = foto.offsetWidth;
  const h = foto.offsetHeight;
  const v = vlak.getBoundingClientRect();
  const links = v.left;
  const rechts = Math.min(v.right, window.innerWidth - PANEEL);
  const vrij = rechts - links;
  const g = SCHAAL[weergave];
  const s = Math.min(g.max, (v.height * g.hoogte) / h, (vrij * 0.8) / b);
  return {
    dx: (links + rechts) / 2 - (x + b / 2),
    dy: v.top + v.height / 2 - (y + h / 2),
    s,
  };
}

/**
 * Het doel van het open stuk, opnieuw gemeten bij een ander stuk en bij een
 * ander venster. `vind` geeft de foto en het vlak; null als er niets open is.
 */
export function useDoel(
  open: string | null,
  weergave: Weergave,
  vind: () => { foto: HTMLElement | null; vlak: HTMLElement | null },
  extra: unknown = null,
): (Doel & { id: string }) | null {
  const [doel, setDoel] = useState<(Doel & { id: string }) | null>(null);
  const [venster, setVenster] = useState(0);
  useEffect(() => {
    const f = () => setVenster((n) => n + 1);
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  useLayoutEffect(() => {
    if (!open) {
      setDoel(null);
      return;
    }
    const { foto, vlak } = vind();
    if (!foto || !vlak) return;
    setDoel({ id: open, ...meetDoel(foto, vlak, weergave) });
    // `vind` leest alleen refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, weergave, venster, extra]);
  return doel && doel.id === open ? doel : null;
}
