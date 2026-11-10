import { useRef } from "react";

import { ONTWERP_HOOGTE, Pic, Spec, klikbaar, useVenster } from "./Delen";
import { useDoel } from "./naarMidden";
import type { DStuk } from "./typen";

/**
 * Gloedraster (briefing §2, §6): alle stukken in een raster van vier
 * kolommen, twee rijen zichtbaar, op het kleurveld, met lijnen van 1 px wit op
 * 28 % in plaats van naden. Per vak het nummer en de soort, het voorwerp op de
 * helft van zijn eigen maat, de titel en wie. Het veld kleurt mee met het vak
 * onder de muis (`zweef`). Meer dan acht stukken: het raster schuift omlaag.
 */
export function Gloedraster({
  stukken,
  open,
  kies,
  zweef,
}: {
  stukken: DStuk[];
  open: string | null;
  kies: (id: string) => void;
  zweef: (id: string) => void;
}) {
  const vlak = useRef<HTMLDivElement>(null);
  const fotos = useRef(new Map<string, HTMLSpanElement>());
  // Het voorwerp op de helft van zijn maat (ontwerp), meeschalend met de
  // hoogte, en altijd binnen zijn vak: de tekst boven en onder neemt ~100.
  const v = useVenster();
  const vakH = (v.h - 57) / 2 - 100;
  const vakB = v.b / 4 - 32;
  const maat = (p: DStuk) => {
    const f = Math.min(v.h / ONTWERP_HOOGTE, vakH / (p.h * 0.5), vakB / (p.b * 0.5));
    return { b: Math.round(p.b * 0.5 * f), h: Math.round(p.h * 0.5 * f) };
  };
  const doel = useDoel(open, "gloedraster", () => ({ foto: (open && fotos.current.get(open)) || null, vlak: vlak.current }), `${stukken.length} ${v.b} ${v.h}`);
  const cls = ["gg", open ? "has-open" : "", stukken.length > 8 ? "lang" : ""].filter(Boolean).join(" ");
  return (
    <div className={cls} ref={vlak} data-meet="vlak">
      {stukken.map((p) => {
        const isOpen = open === p.id;
        return (
          <a
            key={p.id}
            aria-current={isOpen ? "true" : undefined}
            aria-label={`${p.titel}, ${p.wie}`}
            onMouseEnter={() => zweef(p.id)}
            {...klikbaar(() => kies(p.id))}
            data-meet="stuk"
            data-id={p.id}
          >
            <span className="S dim" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{p.nr}</span>
              <span>{p.soort}</span>
            </span>
            <span className="obj">
              <Pic
                stuk={p}
                b={maat(p).b}
                h={maat(p).h}
                meet="foto"
                picRef={(el) => {
                  if (el) fotos.current.set(p.id, el);
                  else fotos.current.delete(p.id);
                }}
                style={isOpen && doel ? { transform: `translate(${doel.dx}px,${doel.dy}px) scale(${doel.s})` } : undefined}
              />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span className="T" style={{ fontSize: 26 }}>
                {p.titel}
              </span>
              <Spec rijen={[["Wie", p.wie]]} />
            </span>
          </a>
        );
      })}
    </div>
  );
}
