import { useLocalSearchParams } from "expo-router";
import { useState } from "react";

import { EventsDesktop } from "../EventsDesktop";
import { FeedDesktop } from "../FeedDesktop";
import { Berichten, BerichtInvoer, Bubbel, GedeeldStuk, GedeeldVak, GesprekkenDesktop } from "../GesprekkenDesktop";
import { DesktopPagina } from "../Pagina";
import { Paneel } from "../Paneel";
import { kiesWeergave, useWeergave } from "../weergave";
import type { DStuk, KaderNav, PaneelInhoud, PaneelNav, PaneelReactie, Stand, Tab, Weergave } from "../typen";
import { EVENTS, GESPREKKEN, NAV_TEKST, REACTIES, beeld, kleurVan, stukken as voorbeeldStukken } from "./voorbeelden";

/**
 * Eén desktoptestpagina: `/dev/catalogus-desktop/wand-open-donker`.
 *
 * De staat (desktop/staten.json) zegt de weergave, of er een stuk open is en
 * welk, of het menu open is, en de stand. Dezelfde onderdelen als het echte
 * scherm, met de vaste gegevens van het prototype.
 *
 * `?bewaar=1`: de weergave komt uit de bewaarde keuze (gebruiker "dev") en
 * een keuze in het menu wordt bewaard, voor het gedragsscript.
 */

const STATEN: Record<string, { w: Weergave; open?: string; stand?: Stand; menu?: boolean; pagina?: "gesprekken" | "events" }> = {
  "wand-dicht": { w: "wand" },
  "wand-open": { w: "wand", open: "2" },
  "wand-dicht-donker": { w: "wand", stand: "donker" },
  "wand-open-donker": { w: "wand", open: "2", stand: "donker" },
  "blad-dicht": { w: "blad" },
  "blad-open": { w: "blad", open: "2" },
  "blad-dicht-donker": { w: "blad", stand: "donker" },
  "lichtbak-dicht": { w: "lichtbak" },
  "lichtbak-open": { w: "lichtbak", open: "1" },
  "lichtbak-dicht-donker": { w: "lichtbak", stand: "donker" },
  "gloedraster-dicht": { w: "gloedraster" },
  "gloedraster-open": { w: "gloedraster", open: "3" },
  "gloedraster-dicht-donker": { w: "gloedraster", stand: "donker" },
  "weergaveknop-menu": { w: "wand", menu: true },
  "weergaveknop-menu-blad": { w: "blad", menu: true },
  gesprekken: { w: "wand", pagina: "gesprekken" },
  events: { w: "wand", pagina: "events" },
};

export const DEV_STATEN = Object.keys(STATEN);

function VastPaneel({
  stuk,
  nav,
  leuk,
  aan,
  eigen,
}: {
  stuk: DStuk;
  nav: PaneelNav;
  leuk: () => void;
  aan: boolean;
  /** `?eigen=1`: dit stuk is van jou; verwijderen haalt het weg. */
  eigen?: { verwijder: () => void; hernoem: (t: string) => void };
}) {
  const [invoer, setInvoer] = useState("");
  const [bewerk, setBewerk] = useState(false);
  const [titel, setTitel] = useState(stuk.titel);
  const [extra, setExtra] = useState<PaneelReactie[]>([]);
  const [antwoord, setAntwoord] = useState<PaneelReactie | null>(null);
  const reacties = [...(REACTIES[stuk.id] ?? []), ...extra];
  const p: PaneelInhoud = {
    wie: stuk.wie,
    soort: stuk.soort,
    titel: stuk.titel,
    datum: stuk.datum,
    aantalReacties: reacties.length,
    hartjes: stuk.hartjes + (aan ? 1 : 0),
    vindIkLeuk: aan,
    berichtAan: eigen ? null : stuk.wie,
    reacties,
    invoer,
    eigen: eigen
      ? {
          bewerk: () => setBewerk(true),
          verwijder: () => {
            nav.sluit();
            eigen.verwijder();
          },
          bewerken: bewerk ? (
            <form
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
              onSubmit={(e) => {
                e.preventDefault();
                eigen.hernoem(titel);
                setBewerk(false);
              }}
              data-meet="bewerkformulier"
            >
              <input className="field" aria-label="Titel" value={titel} onChange={(e) => setTitel(e.target.value)} />
              <span style={{ display: "flex", gap: 8 }}>
                <button className="btn S" type="submit">
                  Bewaar
                </button>
                <button className="btn S ghost" type="button" onClick={() => setBewerk(false)}>
                  Annuleer
                </button>
              </span>
            </form>
          ) : null,
        }
      : undefined,
    antwoordAan: antwoord?.naam ?? null,
    doe: {
      leuk,
      bericht: () => {},
      tekst: setInvoer,
      stuur: () => {
        const t = invoer.trim();
        if (!t) return;
        setExtra((x) => [...x, { id: `j${x.length}`, naam: "jij", tekst: t, linc: { kleur: "#D9D7D1", initiaal: "jij" }, antwoord: !!antwoord }]);
        setInvoer("");
        setAntwoord(null);
      },
      antwoord: (id) => setAntwoord(reacties.find((r) => r.id === id) ?? null),
      stopAntwoord: () => setAntwoord(null),
    },
  };
  return <Paneel inhoud={p} nav={nav} />;
}

export function DevDesktop() {
  const { staat, bewaar, eigen: vanMij } = useLocalSearchParams<{ staat: string; bewaar?: string; eigen?: string }>();
  const [weg, setWeg] = useState<string[]>([]);
  const [titels, setTitels] = useState<Record<string, string>>({});
  const s = STATEN[staat ?? ""] ?? STATEN["wand-dicht"];
  const bewaard = useWeergave("dev");
  const [eigen, setEigen] = useState<Weergave>(s.w);
  const weergave = bewaar ? bewaard : eigen;
  const kies = (w: Weergave) => {
    if (bewaar) kiesWeergave("dev", w);
    else setEigen(w);
    setPagina("feed");
  };
  const [stand, setStand] = useState<Stand>(s.stand ?? "licht");
  const [pagina, setPagina] = useState<"feed" | "gesprekken" | "events" | "jij">(s.pagina ?? "feed");
  const [leuk, setLeuk] = useState<Record<string, boolean>>({});
  const [gesprek, setGesprek] = useState(0);
  const [bericht, setBericht] = useState("");
  const [mijn, setMijn] = useState<string[]>([]);
  const [komt, setKomt] = useState(EVENTS.map((e) => e.go));

  const basis = voorbeeldStukken();
  const stukken = basis
    .filter((x) => !weg.includes(x.id))
    .map((x) => ({ ...x, titel: titels[x.id] ?? x.titel, hartjes: x.hartjes + (leuk[x.id] ? 1 : 0), vindIkLeuk: !!leuk[x.id] }));
  const tikLeuk = (id: string) => setLeuk((l) => ({ ...l, [id]: !l[id] }));

  const nav: KaderNav = {
    ...NAV_TEKST,
    ongelezen: true,
    nieuweMeldingen: true,
    tab: (t: Tab) => setPagina(t === "chats" ? "gesprekken" : t === "events" ? "events" : t === "you" ? "jij" : "feed"),
    meldingen: () => {},
    nieuw: () => {},
  };

  if (pagina === "feed") {
    return (
      <FeedDesktop
        key={weergave}
        stukken={stukken}
        weergave={weergave}
        kiesWeergave={kies}
        stand={stand}
        kiesStand={setStand}
        nav={nav}
        paneel={(stuk, pn) => (
          <VastPaneel
            key={stuk.id}
            stuk={{ ...basis.find((b) => b.id === stuk.id)!, titel: stuk.titel }}
            nav={pn}
            aan={!!leuk[stuk.id]}
            leuk={() => tikLeuk(stuk.id)}
            eigen={
              vanMij
                ? {
                    verwijder: () => setWeg((w) => [...w, stuk.id]),
                    hernoem: (t) => setTitels((x) => ({ ...x, [stuk.id]: t })),
                  }
                : undefined
            }
          />
        )}
        leuk={tikLeuk}
        bericht={() => setPagina("gesprekken")}
        startOpen={s.open ?? null}
        startMenu={s.menu}
      />
    );
  }

  const paginaProps = { weergave, kiesWeergave: kies, stand, kiesStand: setStand, nav };

  if (pagina === "gesprekken") {
    const c = GESPREKKEN[gesprek];
    const linc = (x: (typeof GESPREKKEN)[number]) => ({ beeld: "img" in x && x.img ? beeld(x.img) : null, kleur: x.c, initiaal: x.n[0] });
    const ongelezen = GESPREKKEN.filter((x, i) => x.u && i !== gesprek).length + (c.u && gesprek !== 0 ? 1 : 0);
    return (
      <DesktopPagina {...paginaProps} actief="chats">
        <GesprekkenDesktop
          rijen={GESPREKKEN.map((x, i) => ({
            id: String(i),
            naam: x.n,
            regel: (x.m[x.m.length - 1]?.[0] ?? "Nog geen berichten").replace("@post", "Bijdrage: 18 okt"),
            tijd: x.t,
            nieuw: i === gesprek && i !== 0 ? 0 : x.u,
            linc: linc(x),
            open: () => setGesprek(i),
          }))}
          gekozen={String(gesprek)}
          ongelezen={gesprek === 0 ? GESPREKKEN.filter((x) => x.u).length : ongelezen}
          draad={
            <Berichten>
              {c.m.length || mijn.length ? (
                <>
                  {c.m.map(([t, me], i) =>
                    t === "@post" ? (
                      <GedeeldStuk
                        key={i}
                        beeld={beeld("post-drank.jpg")}
                        rijen={[
                          ["Bijdrage", "18 okt"],
                          ["Wie", "Mie"],
                        ]}
                        open={() => setPagina("feed")}
                      />
                    ) : (
                      <Bubbel key={i} tekst={t} mij={!!me} />
                    ),
                  )}
                  {mijn.map((t, i) => (
                    <Bubbel key={`m${i}`} tekst={t} mij />
                  ))}
                </>
              ) : (
                <span className="S dim" style={{ margin: "auto" }}>
                  Nog geen berichten
                </span>
              )}
            </Berichten>
          }
          invoer={
            <BerichtInvoer
              aan={c.n}
              waarde={bericht}
              tekst={setBericht}
              stuur={() => {
                if (!bericht.trim()) return;
                setMijn((m) => [...m, bericht.trim()]);
                setBericht("");
              }}
            />
          }
          gedeeld={
            gesprek === 0 ? (
              <GedeeldVak
                nr="01"
                soort="foto"
                beeld={beeld("post-drank.jpg")}
                rijen={[
                  ["Wie", "Mie"],
                  ["Titel", "18 okt"],
                ]}
                open={() => setPagina("feed")}
              />
            ) : (
              <></>
            )
          }
        />
      </DesktopPagina>
    );
  }

  if (pagina === "events") {
    const punten: Record<number, string> = { 15: "#C1724E", 28: "#8A9273", 29: "#8A9273", 30: "#8A9273" };
    return (
      <DesktopPagina {...paginaProps} actief="events">
        <EventsDesktop
          kop={[
            ["Gepland", `${EVENTS.length} events`],
            ["Eerstvolgende", "zo 15 nov"],
            ["Jij komt", `${komt.filter(Boolean).length} van ${EVENTS.length}`],
          ]}
          maand={{ naam: "november 2026", begin: 6, dagen: 30, vandaag: 9, punten }}
          rijen={EVENTS.map((e, i) => ({
            id: String(i),
            dag: e.d,
            maand: e.m,
            titel: e.t,
            regels: [
              { label: "Wanneer", waarde: e.w },
              { label: "Waar", waarde: e.pl },
              { label: "Van", waarde: e.host },
            ],
            komen: [...e.who, ...(komt[i] ? ["jij"] : [])].map((w) => ({ kleur: kleurVan(w), initiaal: w[0].toUpperCase() })),
            jijKomt: komt[i],
            voorbij: false,
            open: () => {},
            kom: () => setKomt((k) => k.map((v, j) => (j === i ? true : v))),
            komNiet: () => setKomt((k) => k.map((v, j) => (j === i ? false : v))),
          }))}
        />
      </DesktopPagina>
    );
  }

  return (
    <DesktopPagina {...paginaProps} actief="you">
      <div style={{ flex: 1, background: "var(--g)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="S dim">Jij · niet ontworpen op desktop</span>
      </div>
    </DesktopPagina>
  );
}
