import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Gloedraster } from "./Gloedraster";
import { Kader, Meldingen } from "./Kader";
import { Lichtbak } from "./Lichtbak";
import { Spec, plaat } from "./Delen";
import { Wand } from "./Wand";
import { WeergaveKnop } from "./WeergaveKnop";
import { Wortel } from "./Wortel";
import type { DStuk, KaderNav, PaneelNav, Stand, Weergave } from "./typen";

/**
 * De feed van catalogus op desktop (briefing §2–§7), in elk van de vier
 * weergaven. Dit onderdeel houdt bij wat gekozen en open is, vangt de
 * toetsen, en legt het paneel over de pagina. De weergaven leveren alleen
 * hun opstelling; de weg van de foto naar het midden is voor alle vier
 * dezelfde (`useDoel` in naarMidden.ts).
 *
 * Openen (§4): de foto gaat naar links en groeit, de rest verbleekt, het
 * paneel komt in 0,42 s van rechts, over de volle hoogte. Sluiten: een klik
 * links van het paneel, Esc of het kruisje; het paneel schuift in 0,36 s weg.
 */

const WEG_MS = 380;

/**
 * ← → onder de open foto, links uitgelijnd met de foto. De foto beweegt na
 * openen of een stap nog ~0,7 s naar zijn plek; zolang volgt de rij hem
 * beeld voor beeld, daarna alleen nog bij een andere venstermaat.
 */
function FotoPijlen({ id, vorige, volgende }: { id: string; vorige: () => void; volgende: () => void }) {
  const [plek, setPlek] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    const meet = () => {
      const f = document.querySelector('[data-meet="stuk"][aria-current] [data-meet="foto"]');
      if (!f) return;
      const r = f.getBoundingClientRect();
      setPlek((o) => (o && Math.abs(o.x - r.left) < 0.5 && Math.abs(o.y - r.bottom) < 0.5 ? o : { x: r.left, y: r.bottom }));
    };
    const tot = performance.now() + 1000;
    const volg = () => {
      meet();
      if (performance.now() < tot) raf = requestAnimationFrame(volg);
    };
    volg();
    window.addEventListener("resize", meet);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", meet);
    };
  }, [id]);
  if (!plek) return null;
  return (
    <span className="fotopijlen" style={{ left: plek.x, top: plek.y + 14 }} data-meet="fotopijlen">
      <button className="ib" aria-label="Vorige bijdrage" onClick={vorige}>
        ←
      </button>
      <button className="ib" aria-label="Volgende bijdrage" onClick={volgende}>
        →
      </button>
    </span>
  );
}

function stil(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export type FeedDesktopProps = {
  stukken: DStuk[];
  weergave: Weergave;
  kiesWeergave: (w: Weergave) => void;
  stand: Stand;
  kiesStand: (s: Stand) => void;
  nav: KaderNav;
  /** De inhoud van het paneel voor het open stuk. */
  paneel: (stuk: DStuk, nav: PaneelNav) => ReactNode;
  leuk: (id: string) => void;
  bericht: (id: string) => void;
  /** Een tekst in plaats van de stukken: laden, mislukt, nog niets. */
  stand2?: string | null;
  startOpen?: string | null;
  /** Na het sluiten (`/post/[id]` gaat dan naar `/feed`). */
  naSluiten?: () => void;
  /** Naar de pagina van een bijdrage: een klik op de open foto of op de titel in het paneel. */
  naarPagina?: (id: string) => void;
};

export function FeedDesktop(props: FeedDesktopProps) {
  const { stukken, weergave, nav } = props;
  const [sel, setSel] = useState<string | null>(props.startOpen ?? null);
  const [open, setOpen] = useState<string | null>(props.startOpen ?? null);
  const [sluitend, setSluitend] = useState<string | null>(null);
  const [sessie, setSessie] = useState(0);
  const [zweef, setZweef] = useState<string | null>(null);
  const [fris, setFris] = useState(false);
  const [opFoto, setOpFoto] = useState(false);
  const schuif = useRef<((d: number) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const naSluiten = useRef(props.naSluiten);
  naSluiten.current = props.naSluiten;

  const gekozen = sel && stukken.some((s) => s.id === sel) ? sel : (stukken[0]?.id ?? null);
  const index = (id: string | null) => Math.max(0, stukken.findIndex((s) => s.id === id));

  const openStuk = useCallback(
    (id: string) => {
      const s = stukken.find((x) => x.id === id);
      if (s?.eigenPagina) {
        s.eigenPagina();
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      // De focus niet op het stuk laten: zijn ring tekent om de plek waar het
      // hing, niet om de foto die naar het midden gaat.
      const actief = document.activeElement as HTMLElement | null;
      if (actief?.closest?.('[data-meet="stuk"]')) actief.blur();
      setSluitend(null);
      if (!open) setSessie((n) => n + 1);
      setOpen(id);
      setSel(id);
      setFris(false);
    },
    [open, stukken],
  );

  const sluit = useCallback(() => {
    if (!open) return;
    setFris(false);
    setOpen(null);
    if (stil()) {
      setSluitend(null);
      naSluiten.current?.();
      return;
    }
    setSluitend(open);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setSluitend(null);
      naSluiten.current?.();
    }, WEG_MS);
  }, [open]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const stap = useCallback(
    (d: number) => {
      if (!stukken.length) return;
      const n = stukken[(index(open ?? gekozen) + d + stukken.length) % stukken.length].id;
      setSel(n);
      if (open) setOpen(n);
      else setFris(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stukken, open, gekozen],
  );

  const wand = weergave === "wand" || weergave === "blad";
  const openLink = open ? stukken.find((s) => s.id === open)?.link : undefined;

  /** Ligt dit punt op de foto van het open stuk? */
  const fotoOnder = (x: number, y: number) => {
    const f = document.querySelector('[data-meet="stuk"][aria-current] [data-meet="foto"]');
    if (!f) return false;
    const r = f.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  // De toetsen (briefing §7).
  useEffect(() => {
    const toets = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "Escape" && open) sluit();
      else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const d = e.key === "ArrowRight" ? 1 : -1;
        e.preventDefault();
        if (wand && !open) schuif.current?.(-d * 380);
        else stap(d);
      } else if (e.key === "Enter" && !open && gekozen && t?.tagName !== "BUTTON" && t?.getAttribute("role") !== "button") {
        openStuk(gekozen);
      }
    };
    window.addEventListener("keydown", toets);
    return () => window.removeEventListener("keydown", toets);
  }, [open, wand, gekozen, sluit, stap, openStuk]);

  const kies = (w: Weergave) => {
    if (timer.current) clearTimeout(timer.current);
    setOpen(null);
    setSluitend(null);
    props.kiesWeergave(w);
  };

  const knop = () => (
    <WeergaveKnop weergave={weergave} kies={kies} stand={props.stand} kiesStand={props.kiesStand} />
  );

  const paneelStuk = stukken.find((s) => s.id === (open ?? sluitend)) ?? null;
  const paneelNav: PaneelNav | null = paneelStuk
    ? {
        plaat: plaat(index(paneelStuk.id), stukken.length),
        sluit,
        pagina: props.naarPagina ? () => props.naarPagina!(paneelStuk.id) : undefined,
      }
    : null;

  const glow = weergave === "lichtbak" || weergave === "gloedraster";
  const veldId = weergave === "gloedraster" ? (open ?? zweef ?? gekozen) : (open ?? gekozen);
  const veld = glow ? (stukken.find((s) => s.id === veldId)?.veld ?? null) : undefined;

  let pagina: ReactNode;
  if (!stukken.length) {
    pagina = (
      <div style={{ flex: 1, background: glow ? "transparent" : "var(--g)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="S dim">{props.stand2 ?? "Nog geen bijdragen"}</span>
      </div>
    );
  } else if (wand) {
    pagina = <Wand stukken={stukken} weergave={weergave} open={open} terug={sluitend} kies={openStuk} leuk={props.leuk} schuifRef={schuif} />;
  } else if (weergave === "lichtbak") {
    pagina = (
      <Lichtbak
        stukken={stukken}
        sel={gekozen!}
        open={open}
        fris={fris}
        kies={(id) => {
          setSel(id);
          setFris(true);
        }}
        openStuk={openStuk}
        vorige={() => stap(-1)}
        volgende={() => stap(1)}
        leuk={props.leuk}
        bericht={props.bericht}
      />
    );
  } else {
    pagina = <Gloedraster stukken={stukken} open={open} kies={openStuk} zweef={(id) => !open && setZweef(id)} leuk={props.leuk} />;
  }


  return (
    <Wortel stand={props.stand} veld={veld}>
      <Kader weergave={weergave} actief="feed" nav={nav} knop={knop} helder={glow}>
        {weergave === "blad" ? (
          <div className="strip" data-meet="bladkop">
            <Spec
              rijen={[
                ["Editie", `${nav.editie} · ${nav.datum}`],
                ["Inhoud", nav.inhoud],
              ]}
            />
            <span style={{ flex: 1 }} />
            <Meldingen nav={nav} los />
          </div>
        ) : null}
        {pagina}
        {open ? (
          <button
            className={opFoto ? (openLink ? "scrim oplink" : "scrim opfoto") : "scrim"}
            aria-label="Sluit de bijdrage"
            // De laag ligt over alles links van het paneel. Op de open foto
            // gaat een klik naar de bijdrage; ernaast sluit hij.
            // Een link of een nummer gaat naar zijn adres.
            onMouseMove={(e) => setOpFoto((!!props.naarPagina || !!openLink) && fotoOnder(e.clientX, e.clientY))}
            onClick={(e) => {
              if (openLink && fotoOnder(e.clientX, e.clientY)) window.open(openLink, "_blank", "noopener,noreferrer");
              else if (props.naarPagina && fotoOnder(e.clientX, e.clientY)) props.naarPagina(open);
              else sluit();
            }}
            data-meet="scrim"
          />
        ) : null}
        {open && stukken.length > 1 ? <FotoPijlen id={open} vorige={() => stap(-1)} volgende={() => stap(1)} /> : null}
        {paneelStuk && paneelNav ? (
          <aside key={sessie} className={open ? "drawer" : "drawer weg"} aria-label="Gekozen bijdrage" data-meet="drawer">
            {props.paneel(paneelStuk, paneelNav)}
          </aside>
        ) : null}
      </Kader>
    </Wortel>
  );
}
