import { useRef } from "react";

import { Acties, Pic, Spec, klikbaar, plaat, useVenster } from "./Delen";
import { useDoel } from "./naarMidden";
import type { DStuk } from "./typen";

/**
 * Lichtbak (briefing §2, §6): één stuk tegelijk, groot in het midden (54 %
 * van de vensterhoogte, 7 : 9), op een veld in de kleuren van dat stuk.
 * Links de titel met het kaartje, rechts hartje, reacties, "Bericht aan …"
 * en ← →. Onderaan de strook met alle stukken als vakjes van 104 × 124.
 *
 * Een nieuw stuk verschijnt in 0,35 s, 12 px omhoog en invagend. Open: de
 * kolommen links en rechts verdwijnen, de strook verbleekt, de foto gaat naar
 * het midden van de vrije ruimte (`useDoel`).
 */

export function Lichtbak({
  stukken,
  sel,
  open,
  fris,
  kies,
  openStuk,
  vorige,
  volgende,
  leuk,
  bericht,
}: {
  stukken: DStuk[];
  sel: string;
  open: string | null;
  /** Het stuk is net gekozen: het verschijnt. */
  fris: boolean;
  kies: (id: string) => void;
  openStuk: (id: string) => void;
  vorige: () => void;
  volgende: () => void;
  leuk: (id: string) => void;
  bericht: (id: string) => void;
}) {
  const v = useVenster();
  // De foto: 54 % van de hoogte in 7 : 9 (ontwerp), maar nooit breder dan 30 %
  // van het venster en nooit hoger dan het vlak boven de strook toelaat.
  const fotoB = Math.min(v.h * 0.42, v.b * 0.3, ((v.h - 56 - 2 - 152 - 40) * 7) / 9);
  const fotoH = (fotoB * 9) / 7;
  const foto = useRef<HTMLSpanElement | null>(null);
  // Het vlak van de weergave: de pagina onder de bovenbalk, met de strook.
  const vlak = useRef<HTMLDivElement>(null);
  const i = Math.max(0, stukken.findIndex((s) => s.id === sel));
  const p = stukken[i];
  const doel = useDoel(open, "lichtbak", () => ({ foto: foto.current, vlak: vlak.current }));
  if (!p) return null;
  const rise = fris && !open ? "rise" : "";
  const isOpen = open === p.id;

  return (
    <div ref={vlak} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 2, position: "relative" }} data-meet="vlak">
      <div className={open ? "light has-open" : "light"}>
        <div key={`l${p.id}`} className={rise} style={{ display: "flex", flexDirection: "column", gap: 22, paddingRight: 40 }} data-meet="lichtbak-titel">
          <span className="S">Plaat {plaat(i, stukken.length)}</span>
          <span
            className="T"
            lang="nl"
            style={{
              fontSize: "clamp(48px,min(8vw,12.8vh),120px)",
              lineHeight: 0.82,
              overflowWrap: "anywhere",
              hyphens: "auto",
              display: "-webkit-box",
              WebkitLineClamp: 4,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {p.titel}
          </span>
          <span style={{ width: 220 }}>
            <Spec
              wit
              rijen={[
                ["Wie", p.wie],
                ["Soort", p.soort],
                ["Datum", p.datum],
                ["Reacties", p.reacties],
              ]}
            />
          </span>
        </div>
        <a key={`m${p.id}`} className={rise ? "mid rise" : "mid"} aria-current={isOpen ? "true" : undefined} aria-label="Open reacties" style={{ display: "block" }} {...klikbaar(() => openStuk(p.id))} data-meet="stuk" data-id={p.id}>
          <Pic
            stuk={p}
            b={fotoB}
            h={fotoH}
            meet="foto"
            picRef={(el) => {
              foto.current = el;
            }}
            style={{ boxShadow: "0 30px 80px rgba(20,18,16,.4)", ...(isOpen && doel ? { transform: `translate(${doel.dx}px,${doel.dy}px) scale(${doel.s})` } : null) }}
          />
        </a>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10, paddingLeft: 40 }} data-meet="lichtbak-knoppen">
          <span style={{ display: "flex", gap: 6 }}>
            <Acties hartjes={p.hartjes} vindIkLeuk={p.vindIkLeuk} reacties={p.reacties} leuk={() => leuk(p.id)} reageer={() => openStuk(p.id)} />
          </span>
          <a className="S link" style={{ height: 44, display: "flex", alignItems: "center" }} {...klikbaar(() => bericht(p.id))}>
            Bericht aan {p.wie}
          </a>
          <span style={{ height: 30 }} />
          <span style={{ display: "flex", gap: 6 }}>
            <button className="ib" aria-label="Vorige" style={{ width: 52, height: 52, border: "1px solid #fff" }} onClick={vorige}>
              ←
            </button>
            <button className="ib" aria-label="Volgende" style={{ width: 52, height: 52, background: "#fff", color: "#141210" }} onClick={volgende}>
              →
            </button>
          </span>
        </div>
      </div>
      <div className={open ? "film has-open" : "film"} data-meet="strook">
        {stukken.map((x) => (
          <a key={x.id} aria-current={x.id === p.id ? "true" : undefined} aria-label={x.titel} {...klikbaar(() => kies(x.id))} data-meet="vakje">
            <span className="S dim" style={{ alignSelf: "flex-start", fontSize: 9 }}>
              {x.nr}
            </span>
            <Pic stuk={x} b={66} h={84} />
          </a>
        ))}
      </div>
    </div>
  );
}
