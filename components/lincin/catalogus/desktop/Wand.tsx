import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";

import { ONTWERP_HOOGTE, Pic, Spec, klikbaar, useVenster } from "./Delen";
import { useDoel } from "./naarMidden";
import type { DStuk, Weergave } from "./typen";

/**
 * Wand (briefing §2, §6): alle stukken naast elkaar op één lange wand, elk
 * op eigen formaat, onderaan uitgelijnd in een zone van 58 % van de hoogte,
 * met het nummer erboven, de vloerlijn en het bijschrift eronder. Het wiel
 * en ← → schuiven de wand; hij stopt aan beide einden.
 *
 * Open: de wand schuift tot het stuk midden in de vrije ruimte hangt, en de
 * foto schuift verticaal naar het midden en groeit (`useDoel`). Bij sluiten
 * schuift de wand terug naar waar hij stond.
 *
 * Dezelfde wand staat op het blad (`blad`); alleen het kader verschilt.
 */

/** Waar de wand stond, ook als het scherm opnieuw begint (`/post/[id]` → `/feed`). */
let bewaard = 0;

export function Wand({
  stukken,
  weergave,
  open,
  terug,
  kies,
  schuifRef,
}: {
  stukken: DStuk[];
  weergave: Weergave;
  open: string | null;
  /** Het stuk dat net dichtging en terugkrimpt. */
  terug: string | null;
  kies: (id: string) => void;
  /** ← → als er niets open is. */
  schuifRef: MutableRefObject<((d: number) => void) | null>;
}) {
  const wall = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const fotos = useRef(new Map<string, HTMLSpanElement>());
  const [wx, setWx] = useState(bewaard);
  const [live, setLive] = useState(false);
  const liveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Meeschalen (responsive). De zone is 58 % van de vensterhoogte (ontwerp),
  // maar laat altijd ruimte voor de bovenmarge (6 %), de vloerlijn en het
  // bijschrift (samen ~150, een titel van twee regels) binnen de wand; op het blad is die lager. De
  // stukken groeien en krimpen met de hoogte en passen altijd in de zone,
  // onder hun nummer (17 + 10).
  const v = useVenster();
  const [wandH, setWandH] = useState(0);
  useEffect(() => {
    const w = wall.current;
    if (!w) return;
    const ro = new ResizeObserver(() => setWandH(w.clientHeight));
    ro.observe(w);
    return () => ro.disconnect();
  }, []);
  const zone = Math.min(v.h * 0.58, wandH ? wandH - v.h * 0.06 - 150 : Infinity);
  const hoogste = Math.max(1, ...stukken.map((s) => s.h));
  const f = Math.min(v.h / ONTWERP_HOOGTE, (zone - 27) / hoogste);

  const doel = useDoel(open, weergave, () => ({ foto: (open && fotos.current.get(open)) || null, vlak: wall.current }), `${stukken.length} ${f} ${zone}`);

  const grens = useCallback((x: number) => {
    const w = wall.current;
    const t = track.current;
    if (!w || !t) return x;
    const min = Math.min(0, w.clientWidth - t.offsetWidth);
    return Math.max(min, Math.min(0, x));
  }, []);

  useEffect(() => {
    bewaard = wx;
  }, [wx]);

  useEffect(() => {
    schuifRef.current = (d) => setWx((x) => grens(x + d));
    return () => {
      schuifRef.current = null;
    };
  }, [schuifRef, grens]);

  // Het wiel schuift zijwaarts, zonder overgang; stil als er iets open is.
  useEffect(() => {
    const w = wall.current;
    if (!w) return;
    const wiel = (e: WheelEvent) => {
      if (open) return;
      const d = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      setLive(true);
      setWx((x) => grens(x - d));
      if (liveTimer.current) clearTimeout(liveTimer.current);
      liveTimer.current = setTimeout(() => setLive(false), 120);
    };
    w.addEventListener("wheel", wiel, { passive: true });
    return () => w.removeEventListener("wheel", wiel);
  }, [open, grens]);

  const toon = open && doel ? doel.dx : wx;


  return (
    <div className={open ? "wall has-open" : "wall"} ref={wall} data-meet="vlak">
      <div className={live ? "track live" : "track"} ref={track} style={{ transform: `translateX(${toon}px)` }} data-meet="track">
        {stukken.map((s) => {
          const isOpen = open === s.id;
          return (
            <a
              key={s.id}
              className={terug === s.id ? "hang terug" : "hang"}
              aria-current={isOpen ? "true" : undefined}
              aria-label={`${s.titel}, ${s.wie}`}
              style={{ width: s.b * f }}
              {...klikbaar(() => kies(s.id))}
              data-meet="stuk"
              data-id={s.id}
            >
              <span className="up" style={{ height: zone }}>
                <span className="S" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="dim nr">{s.nr}</span>
                </span>
                <Pic
                  stuk={s}
                  b={s.b * f}
                  h={s.h * f}
                  meet="foto"
                  picRef={(el) => {
                    if (el) fotos.current.set(s.id, el);
                    else fotos.current.delete(s.id);
                  }}
                  style={isOpen && doel ? { transform: `translateY(${doel.dy}px) scale(${doel.s})` } : undefined}
                />
              </span>
              <span className="floor" />
              <span className="cap" style={{ paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="T titel2" lang="nl" style={{ fontSize: 30 }} title={s.titel}>
                  {s.titel}
                </span>
                <Spec
                  rijen={[
                    ["Wie", s.wie],
                    ["Soort", s.soort],
                  ]}
                />
              </span>
            </a>
          );
        })}
      </div>
    </div>
  );
}
