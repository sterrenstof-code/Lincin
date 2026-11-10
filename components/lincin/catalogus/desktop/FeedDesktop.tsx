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
  startMenu?: boolean;
  /** Na het sluiten (`/post/[id]` gaat dan naar `/feed`). */
  naSluiten?: () => void;
};

export function FeedDesktop(props: FeedDesktopProps) {
  const { stukken, weergave, nav } = props;
  const [sel, setSel] = useState<string | null>(props.startOpen ?? null);
  const [open, setOpen] = useState<string | null>(props.startOpen ?? null);
  const [sluitend, setSluitend] = useState<string | null>(null);
  const [sessie, setSessie] = useState(0);
  const [menu, setMenu] = useState(!!props.startMenu);
  const [zweef, setZweef] = useState<string | null>(null);
  const [fris, setFris] = useState(false);
  const schuif = useRef<((d: number) => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const naSluiten = useRef(props.naSluiten);
  naSluiten.current = props.naSluiten;

  const gekozen = sel && stukken.some((s) => s.id === sel) ? sel : (stukken[0]?.id ?? null);
  const index = (id: string | null) => Math.max(0, stukken.findIndex((s) => s.id === id));

  const openStuk = useCallback(
    (id: string) => {
      if (timer.current) clearTimeout(timer.current);
      setSluitend(null);
      if (!open) setSessie((n) => n + 1);
      setOpen(id);
      setSel(id);
      setFris(false);
    },
    [open],
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

  // De toetsen (briefing §7). Het menu vangt Esc zelf, eerder (WeergaveKnop).
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

  const knop = (links: boolean) => (
    <WeergaveKnop weergave={weergave} open={menu} zetOpen={setMenu} kies={kies} stand={props.stand} kiesStand={props.kiesStand} links={links} />
  );

  const paneelStuk = stukken.find((s) => s.id === (open ?? sluitend)) ?? null;
  const paneelNav: PaneelNav | null = paneelStuk
    ? { plaat: plaat(index(paneelStuk.id), stukken.length), sluit, vorige: () => stap(-1), volgende: () => stap(1) }
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
    pagina = <Wand stukken={stukken} weergave={weergave} open={open} terug={sluitend} kies={openStuk} schuifRef={schuif} />;
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
    pagina = <Gloedraster stukken={stukken} open={open} kies={openStuk} zweef={(id) => !open && setZweef(id)} />;
  }

  const hint = open ? "← → naar het vorige of volgende stuk · Esc sluit" : "scroll of ← → om langs de wand te lopen · klik op een stuk";

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
            <span className="S dim" style={{ flex: 1, textAlign: "right" }}>
              {open ? "← → vorige of volgende · Esc sluit" : "scroll of ← → langs de wand · klik op een stuk"}
            </span>
            <Meldingen nav={nav} los />
          </div>
        ) : null}
        {pagina}
        {weergave === "wand" && stukken.length ? (
          <div className="S dim hint" data-meet="hint">
            {hint}
          </div>
        ) : null}
        {open ? <button className="scrim" aria-label="Sluit de bijdrage" onClick={sluit} /> : null}
        {paneelStuk && paneelNav ? (
          <aside key={sessie} className={open ? "drawer" : "drawer weg"} aria-label="Gekozen bijdrage" data-meet="drawer">
            {props.paneel(paneelStuk, paneelNav)}
          </aside>
        ) : null}
      </Kader>
    </Wortel>
  );
}
