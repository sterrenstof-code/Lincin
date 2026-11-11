import type { ReactNode } from "react";

import { Spec, klikbaar } from "./Delen";
import type { KaderNav, Tab, Weergave } from "./typen";

/**
 * Het kader om elke desktoppagina van catalogus (briefing §2, §6):
 *
 *   wand, lichtbak, gloedraster   de bovenbalk van 56 en daaronder de pagina
 *   blad                          de tafel, links de tabbladen, rechts het blad
 *
 * Gesprekken en Events zien er in elke weergave hetzelfde uit; alleen dit
 * kader verschilt.
 */

const TABS: [Tab, string][] = [
  ["feed", "Feed"],
  ["chats", "Gesprekken"],
  ["events", "Events"],
  ["you", "Jij"],
];

/** ✳ zonder emoji-vorm. */
export const STER = "✳︎";

/**
 * De meldingen. Zonder iets nieuws de ster; met iets nieuws een blok in de
 * accentkleur met het aantal, dat bij elk nieuw aantal even oplicht. Een punt
 * van 7 bij de ster zag je te makkelijk over het hoofd.
 */
export function Meldingen({ nav, los = false }: { nav: KaderNav; los?: boolean }) {
  const n = nav.nieuweMeldingen;
  return (
    <a
      // Een nieuw aantal tekent het blok opnieuw, en dan licht het weer op.
      key={n}
      className={n ? "ib ster nieuw" : "ib ster"}
      aria-label={n ? `Meldingen, ${n} nieuw` : "Meldingen"}
      style={{ marginLeft: los ? 0 : 8 }}
      {...klikbaar(nav.meldingen)}
      data-meet="ster"
    >
      {STER}
      {n ? (
        <span className="aantal">
          {n > 99 ? "99+" : n}
        </span>
      ) : null}
    </a>
  );
}

export function Kop({ actief, nav, knop, helder }: { actief: Tab | null; nav: KaderNav; knop: ReactNode; helder: boolean }) {
  return (
    <header className={helder ? "top helder" : "top"} data-meet="kop">
      <a className="T" style={{ fontSize: 28 }} {...klikbaar(() => nav.tab("feed"))}>
        Lincin
      </a>
      <Spec
        rijen={[
          ["Editie", nav.editie],
          ["Datum", nav.datum],
        ]}
      />
      <nav aria-label="Hoofdnavigatie">
        {TABS.map(([k, n]) => (
          <a key={k} aria-current={actief === k ? "page" : undefined} {...klikbaar(() => nav.tab(k))}>
            {n}
            {k === "chats" && nav.ongelezen ? <span className="dot" /> : null}
          </a>
        ))}
      </nav>
      <span style={{ flex: 1 }} />
      {knop}
      <Meldingen nav={nav} />
      <a className="ib" aria-label="Nieuwe bijdrage" style={{ fontSize: 28, fontWeight: 200 }} {...klikbaar(nav.nieuw)}>
        +
      </a>
    </header>
  );
}

function Tabbladen({ actief, nav, knop }: { actief: Tab | null; nav: KaderNav; knop: ReactNode }) {
  return (
    <nav className="tabs" aria-label="Hoofdnavigatie" data-meet="tabs">
      <a
        className="T"
        style={{ height: 56, marginBottom: 8, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: "0 14px", color: "#fff", fontSize: 30, flex: "none" }}
        {...klikbaar(() => nav.tab("feed"))}
      >
        Lincin
      </a>
      {TABS.map(([k, n]) => {
        const punt = k === "chats" && nav.ongelezen;
        return (
          <a key={k} className="tab" aria-current={actief === k ? "page" : undefined} {...klikbaar(() => nav.tab(k))} data-meet="tab">
            <span style={{ width: 8, height: 8, ...(punt ? { background: "var(--acc)" } : { border: "1.5px solid var(--k)" }) }} />
            <span>{n}</span>
          </a>
        );
      })}
      <a
        aria-label="Nieuwe bijdrage"
        style={{ height: 64, flex: "none", margin: "12px 0 0 14px", background: "var(--acc)", color: "#141210", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 200 }}
        {...klikbaar(nav.nieuw)}
      >
        +
      </a>
      <span style={{ flex: 1 }} />
      <span style={{ margin: "0 0 40px 14px", color: "#fff" }}>{knop}</span>
    </nav>
  );
}

export function Kader({
  weergave,
  actief,
  nav,
  knop,
  helder = false,
  children,
}: {
  weergave: Weergave;
  actief: Tab | null;
  nav: KaderNav;
  /** De knoppen voor de weergave (WeergaveKnop). */
  knop: (links: boolean) => ReactNode;
  /** De bovenbalk zonder vlak, op het kleurveld. */
  helder?: boolean;
  children: ReactNode;
}) {
  if (weergave === "blad") {
    return (
      <div className="table">
        <Tabbladen actief={actief} nav={nav} knop={knop(true)} />
        <div className="sheet" data-meet="blad">
          <div className="main">{children}</div>
        </div>
      </div>
    );
  }
  return (
    <>
      <Kop actief={actief} nav={nav} knop={knop(false)} helder={helder} />
      <div className="main">{children}</div>
    </>
  );
}
