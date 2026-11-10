import { useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { EditPost } from "@/components/lincin/EditPost";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { useFeed } from "@/components/lincin/feed/useFeed";
import { useAuth } from "@/lib/auth/provider";
import { setPreference, useScheme } from "@/lib/design/theme";
import { LIKE } from "@/lib/lincin/likes";
import { usePrefs } from "@/lib/lincin/prefs";
import type { CardPost } from "@/lib/lincin/model";

import { CardVoorwerp, datumVan, soortVan, titelVan } from "../kaart";
import { useCatNav } from "../nav";
import { vandaag } from "../schermen/FeedCatalogus";
import { useBijdrage } from "../schermen/useBijdrage";
import { BijdragePagina, type BijdrageStuk } from "./BijdragePagina";
import { EventsDesktop, type EventRij, type Maand } from "./EventsDesktop";
import { FeedDesktop } from "./FeedDesktop";
import { GedeeldeBeelden } from "./GedeeldeBeelden";
import { GesprekkenDesktop, type GesprekRij } from "./GesprekkenDesktop";
import type { AttachmentInfo } from "@/lib/api/messages";
import { JijDesktop, type JijIngang, type JijStuk } from "./JijDesktop";
import { MeldingenDesktop, type MeldingDesktop } from "./MeldingenDesktop";
import { NieuwDesktop } from "./NieuwDesktop";
import type { Compose } from "@/app/post-compose";
import { DesktopPagina } from "./Pagina";
import { Kop } from "./Kader";
import { WeergaveKnop } from "./WeergaveKnop";
import { CSS } from "./stijl";
import { Paneel } from "./Paneel";
import { kiesWeergave, useWeergave } from "./weergave";
import type { DStuk, KaderNav, PaneelInhoud, PaneelNav, Stand, Tab } from "./typen";

/**
 * Catalogus op desktop op echte gegevens: de feed (`useFeed`), het paneel
 * (`useBijdrage`), Gesprekken en Events (de rijen van app/(app)/chats.tsx en
 * events.tsx). De weergaven zelf kennen geen gegevens; dit legt de brug.
 */

const TAB_HREF: Record<Tab, string> = { feed: "/feed", chats: "/chats", events: "/events", you: "/profile" };

/** De kop: tabbladen, meldingen, nieuw, de editie en de datum. */
function useNav(inhoud = ""): KaderNav {
  const nav = useCatNav();
  const { session } = useAuth();
  const prefs = usePrefs(session?.user.id ?? "");
  return {
    editie: prefs.edition ? `№ ${prefs.edition.n}` : "№ —",
    datum: vandaag(),
    inhoud,
    ongelezen: nav.ongelezen,
    nieuweMeldingen: nav.nieuweMeldingen > 0,
    tab: (t) => nav.router.push(TAB_HREF[t] as never),
    meldingen: nav.meldingen,
    nieuw: nav.nieuw,
  };
}

/** Licht of donker: de stand van de app; het menu zet hem. */
function useStand(): [Stand, (s: Stand) => void] {
  const scheme = useScheme();
  return [scheme === "dark" ? "donker" : "licht", (s) => setPreference(s === "donker" ? "dark" : "light")];
}

/** De weergave van wie er is ingelogd. */
function useMijnWeergave() {
  const { session } = useAuth();
  const id = session?.user.id ?? "anoniem";
  return [useWeergave(id), (w: Parameters<typeof kiesWeergave>[1]) => kiesWeergave(id, w)] as const;
}

// ---------------------------------------------------------------
// Beelden: de verhouding voor de wand, en het kleurveld
// ---------------------------------------------------------------

const verhouding = new Map<string, number>();
const velden = new Map<string, string>();

/** Leest de verhouding (b / h) van elk beeld één keer; tot dan 4 : 5. */
function useVerhoudingen(uris: string[]): Map<string, number> {
  const [, setTik] = useState(0);
  useEffect(() => {
    let levend = true;
    for (const u of uris) {
      if (verhouding.has(u)) continue;
      const img = new window.Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) verhouding.set(u, img.naturalWidth / img.naturalHeight);
        if (levend) setTik((n) => n + 1);
      };
      img.src = u;
    }
    return () => {
      levend = false;
    };
  }, [uris]);
  return verhouding;
}

/**
 * Het kleurveld van een foto: verkleind tot 96 breed en licht vervaagd,
 * zoals het prototype (briefing §6). Lukt dat niet (een beeld zonder CORS),
 * dan de foto zelf; de vervaging van het veld doet de rest.
 */
function useVelden(uris: string[]): Map<string, string> {
  const [, setTik] = useState(0);
  useEffect(() => {
    let levend = true;
    for (const u of uris) {
      if (velden.has(u)) continue;
      velden.set(u, u);
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const b = 96;
          const h = Math.max(1, Math.round((b * img.naturalHeight) / Math.max(1, img.naturalWidth)));
          const c = document.createElement("canvas");
          c.width = b;
          c.height = h;
          const ctx = c.getContext("2d");
          if (!ctx) return;
          ctx.filter = "blur(2px)";
          ctx.drawImage(img, 0, 0, b, h);
          velden.set(u, c.toDataURL("image/jpeg", 0.8));
          if (levend) setTik((n) => n + 1);
        } catch {
          // een beeld van een andere bron zonder CORS: de foto zelf
        }
      };
      img.src = u;
    }
    return () => {
      levend = false;
    };
  }, [uris]);
  return velden;
}

/** De hoogtes op de wand, zoals de afwisseling in het prototype. */
const HOOGTES = [440, 320, 340, 280, 360, 300, 300, 330];

/** De foto van een stuk; de andere soorten tekenen hun voorwerp. */
function beeldVan(c: CardPost): string | null {
  return c.media.kind === "foto" ? c.media.uri : null;
}

// ---------------------------------------------------------------
// De feed
// ---------------------------------------------------------------

/**
 * De feed van catalogus op desktop. `startOpen`: een bijdrage die meteen
 * open staat (`/post/[id]`); `naSluiten` gaat dan naar `/feed`.
 */
export function FeedDesktopEcht({ startOpen = null, naSluiten }: { startOpen?: string | null; naSluiten?: () => void }) {
  const f = useFeed();
  const router = useRouter();
  const [weergave, kies] = useMijnWeergave();
  const [stand, kiesStand] = useStand();

  const volgorde = useMemo(() => {
    const hero = f.heroPost;
    const rest = f.cards.filter((c) => c.id !== hero?.id);
    return hero ? [hero, ...rest] : rest;
  }, [f.cards, f.heroPost]);
  const perId = useMemo(() => new Map(volgorde.map((c) => [c.id, c])), [volgorde]);

  const uris = useMemo(() => volgorde.map(beeldVan).filter((u): u is string => !!u), [volgorde]);
  const verh = useVerhoudingen(uris);
  const veld = useVelden(uris);

  const nav = useNav(`${volgorde.length} ${volgorde.length === 1 ? "bijdrage" : "bijdragen"}`);

  const stukken: DStuk[] = volgorde.map((c, i) => {
    const beeld = beeldVan(c);
    const h = HOOGTES[i % HOOGTES.length];
    const r = beeld ? (verh.get(beeld) ?? 0.8) : 0;
    const hart = f.reactions.grouped(c.id).find((g) => g.emoji === LIKE);
    const kleur = c.media.kind === "kleur";
    const ding = beeld ? undefined : { node: <CardVoorwerp card={c} plek="bijdrage" />, b: kleur ? 290 : 260, h: kleur ? 370 : 312 };
    return {
      id: c.id,
      nr: String(i + 1).padStart(2, "0"),
      titel: titelVan(c),
      wie: c.authorName,
      soort: soortVan(c),
      datum: datumVan(c),
      beeld,
      veld: beeld ? (veld.get(beeld) ?? beeld) : null,
      b: beeld ? Math.round(Math.max(180, Math.min(460, h * r))) : ding!.b,
      h: beeld ? h : ding!.h,
      voorwerp: ding,
      hartjes: hart?.count ?? 0,
      vindIkLeuk: !!hart?.mine,
      reacties: c.commentCount,
      eigenPagina: c.kind === "poll" ? () => f.openPost(c) : undefined,
    };
  });

  const fout = f.feed.isError && !f.cards.length;

  // Een gedeelde link naar een bijdrage die niet (meer) in de feed staat: de
  // bijdragepagina zelf, in de kolom van de telefoon.
  if (startOpen && !f.feed.isLoading && !perId.has(startOpen)) return <BijdragePaginaEcht id={startOpen} />;

  return (
    <>
      <FeedDesktop
        stukken={stukken}
        weergave={weergave}
        kiesWeergave={kies}
        stand={stand}
        kiesStand={kiesStand}
        nav={nav}
        paneel={(s, pn) => <PaneelEcht key={s.id} stuk={s} nav={pn} />}
        leuk={(id) => {
          const c = perId.get(id);
          if (c?.reactable) f.reactions.toggle(c.id, LIKE);
        }}
        bericht={(id) => {
          const c = perId.get(id);
          if (c) f.privateAbout({ authorId: c.authorId, name: c.authorName }, c);
        }}
        stand2={f.feed.isLoading ? f.t.loading : fout ? "De bijdragen laadden niet." : null}
        startOpen={startOpen}
        naSluiten={naSluiten}
        naarPagina={(id) => router.push(`/post/${id}?pagina=1` as never)}
      />
      <PrivateSheet target={f.sheet} onClose={() => f.setSheet(null)} />
    </>
  );
}

type Bijdrage = ReturnType<typeof useBijdrage>;

/**
 * De inhoud van het paneel uit `useBijdrage`: dezelfde voor het paneel in de
 * feed en de kolom van de bijdragepagina. `stuk` vult in zolang de bijdrage
 * laadt (in de feed is die al bekend).
 */
function paneelInhoud(b: Bijdrage, router: ReturnType<typeof useRouter>, stuk?: DStuk): PaneelInhoud {
  const { p, card, t } = b;
  const meer: ReactNode = !p ? (
    <div className="S dim" style={{ padding: "18px 20px" }}>
      {b.post.isError ? t.failed : t.loading}
    </div>
  ) : b.comments.hasMore ? (
    <button className="S link" style={{ padding: "12px 20px" }} onClick={b.comments.loadMore}>
      Meer reacties · {b.comments.moreCount}
    </button>
  ) : null;
  return {
    wie: p ? b.naam : (stuk?.wie ?? ""),
    soort: card ? soortVan(card) : (stuk?.soort ?? ""),
    titel: card ? titelVan(card) : (stuk?.titel ?? ""),
    datum: card ? datumVan(card) : (stuk?.datum ?? ""),
    aantalReacties: p ? b.comments.total : (stuk?.reacties ?? 0),
    hartjes: p ? b.likes.count : (stuk?.hartjes ?? 0),
    vindIkLeuk: p ? b.likes.liked : !!stuk?.vindIkLeuk,
    berichtAan: p && !b.own ? b.naam : null,
    reacties: p
      ? b.reacties(true).map((r) => ({
          id: r.id,
          naam: r.naam,
          tekst: r.tekst,
          linc: { beeld: typeof r.linc.beeld === "string" ? r.linc.beeld : null, kleur: r.linc.kleur ?? null, initiaal: r.linc.initiaal },
          antwoord: r.antwoord,
          gebruiker: r.gebruiker,
        }))
      : [],
    meer,
    invoer: b.draft,
    antwoordAan: b.antwoordNaam,
    // Je eigen bijdrage: bewerken in het paneel, verwijderen na bevestiging (useBijdrage).
    eigen:
      p && b.own
        ? {
            bewerk: () => b.setBewerk(true),
            verwijder: b.verwijder,
            bewerken: b.bewerk ? <EditPost post={p} onDone={() => b.setBewerk(false)} /> : null,
          }
        : undefined,
    doe: {
      leuk: () => b.likes.toggle(LIKE),
      bericht: b.praatOver,
      tekst: b.setDraft,
      stuur: b.stuur,
      antwoord: b.antwoord,
      stopAntwoord: b.stopAntwoord,
      profiel: (gebruiker) => router.push(`/user/${gebruiker}` as never),
    },
  };
}

/** Het paneel op echte gegevens: de inhoud van de bijdragepagina, zonder het beeld. */
function PaneelEcht({ stuk, nav }: { stuk: DStuk; nav: PaneelNav }) {
  const router = useRouter();
  const b = useBijdrage(stuk.id, { naVerwijderen: nav.sluit });
  return (
    <>
      <Paneel nav={nav} inhoud={paneelInhoud(b, router, stuk)} />
      <PrivateSheet target={b.sheet} onClose={() => b.setSheet(null)} />
    </>
  );
}

/**
 * De pagina van een bijdrage op desktop (`/post/[id]?pagina=1`): het stuk
 * groot, en rechts de kolom van het paneel. In het kader van de gekozen
 * weergave. Terug gaat naar waar je vandaan kwam (anders de feed).
 */
export function BijdragePaginaEcht({ id }: { id: string }) {
  const router = useRouter();
  const k = useKader();
  const nav = useNav();
  const terug = () => (router.canGoBack() ? router.back() : router.replace("/feed" as never));
  const b = useBijdrage(id, { naVerwijderen: terug });
  const { card } = b;
  const profiel = (gebruiker: string) => router.push(`/user/${gebruiker}` as never);
  let stuk: BijdrageStuk = { soort: "tekst", tekst: "", titel: "", regel: "" };
  if (card) {
    const m = card.media;
    if (m.kind === "foto") stuk = { soort: "foto", fotos: m.uris.filter((u): u is string => !!u) };
    else if (m.kind === "tekst")
      stuk = { soort: "tekst", tekst: m.text || card.body || card.title, titel: card.title, regel: `${soortVan(card)} · ${b.naam} · ${datumVan(card)}` };
    else {
      const kleur = m.kind === "kleur";
      stuk = { soort: "voorwerp", node: <CardVoorwerp card={card} plek="bijdrage" />, b: kleur ? 290 : 260, h: kleur ? 370 : 312 };
    }
  }
  // Bij een tekst staat de tekst al links; anders bijschrift en tekst onder het stuk.
  const onder = card && card.media.kind !== "tekst" ? b.onder : card ? card.caption : "";
  return (
    <DesktopPagina {...k} nav={nav} actief="feed">
      <BijdragePagina
        stuk={stuk}
        onder={onder || undefined}
        terug={terug}
        kop={card ? [["Bijdrage", datumVan(card)], ["Wie", b.naam], ["Soort", soortVan(card)]] : [["Bijdrage", b.post.isError ? b.t.failed : b.t.loading]]}
        inhoud={b.p ? paneelInhoud(b, router) : null}
        profiel={profiel}
      />
      <PrivateSheet target={b.sheet} onClose={() => b.setSheet(null)} />
    </DesktopPagina>
  );
}

// ---------------------------------------------------------------
// Gesprekken en Events
// ---------------------------------------------------------------

function useKader() {
  const router = useRouter();
  const [weergave, kies] = useMijnWeergave();
  const [stand, kiesStand] = useStand();
  return {
    weergave,
    // Een andere weergave kiezen gaat naar de feed in die weergave (prototype).
    kiesWeergave: (w: Parameters<typeof kies>[0]) => {
      kies(w);
      router.push("/feed" as never);
    },
    stand,
    kiesStand,
  };
}

/** Gesprekken op desktop: de rijen van chats.tsx, en het gesprek zelf in het midden. */
export function GesprekkenDesktopEcht({
  rijen,
  gekozen,
  ongelezen,
  stand,
  draad,
  gedeeld,
}: {
  rijen: GesprekRij[];
  gekozen: string | null;
  ongelezen: number;
  stand?: string | null;
  draad: ReactNode;
  /** Het gedeelde beeld van het open gesprek (uit `ChatDetail`, `onMedia`). */
  gedeeld?: AttachmentInfo[];
}) {
  const k = useKader();
  const nav = useNav();
  return (
    <DesktopPagina {...k} nav={nav} actief="chats">
      <GesprekkenDesktop
        rijen={rijen}
        gekozen={gekozen}
        ongelezen={ongelezen}
        stand={stand}
        draad={<div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{draad}</div>}
        gedeeld={gedeeld?.length ? <GedeeldeBeelden media={gedeeld} naam={rijen.find((r) => r.id === gekozen)?.naam ?? ""} /> : null}
        gedeeldAantal={gedeeld?.length}
      />
    </DesktopPagina>
  );
}

/** Events op desktop: de rijen van events.tsx, en de maand van vandaag. */
export function EventsDesktopEcht({
  rijen,
  kop,
  dagen,
  stand,
}: {
  rijen: EventRij[];
  kop: [string, string][];
  /** Elk event: van wanneer tot wanneer, en de kleur van zijn punt. */
  dagen: { van: string; tot: string; kleur: string }[];
  stand?: string | null;
}) {
  const k = useKader();
  const nav = useNav();
  const maand = useMemo<Maand>(() => {
    const nu = new Date();
    const j = nu.getFullYear();
    const m = nu.getMonth();
    const eerste = new Date(j, m, 1);
    const aantal = new Date(j, m + 1, 0).getDate();
    const punten: Record<number, string> = {};
    for (const d of dagen) {
      const van = new Date(d.van);
      const tot = new Date(d.tot);
      for (let x = new Date(van.getFullYear(), van.getMonth(), van.getDate()); x <= tot; x.setDate(x.getDate() + 1)) {
        if (x.getFullYear() === j && x.getMonth() === m && !punten[x.getDate()]) punten[x.getDate()] = d.kleur;
      }
    }
    return {
      naam: eerste.toLocaleDateString("nl-NL", { month: "long", year: "numeric" }),
      begin: (eerste.getDay() + 6) % 7,
      dagen: aantal,
      vandaag: nu.getDate(),
      punten,
    };
  }, [dagen]);
  return (
    <DesktopPagina {...k} nav={nav} actief="events">
      <EventsDesktop rijen={rijen} kop={kop} maand={maand} stand={stand} />
    </DesktopPagina>
  );
}

/** Bijdragen als vakken voor Jij en een profiel; een klik opent de bijdragepagina (een poll zijn eigen pagina). */
function useMijnStukken(kaarten: CardPost[]): JijStuk[] {
  const router = useRouter();
  const uris = useMemo(() => kaarten.map(beeldVan).filter((u): u is string => !!u), [kaarten]);
  const verh = useVerhoudingen(uris);
  return kaarten.map((c, i) => {
    const beeld = beeldVan(c);
    const kleur = c.media.kind === "kleur";
    const ding = beeld ? undefined : { node: <CardVoorwerp card={c} plek="bijdrage" />, b: kleur ? 290 : 260, h: kleur ? 370 : 312 };
    const r = beeld ? (verh.get(beeld) ?? 0.8) : 0;
    return {
      id: c.id,
      nr: String(i + 1).padStart(2, "0"),
      titel: titelVan(c),
      soort: soortVan(c),
      datum: datumVan(c),
      beeld,
      voorwerp: ding,
      b: beeld ? 400 * r : ding!.b,
      h: beeld ? 400 : ding!.h,
      open: () => router.push((c.kind === "poll" ? c.href : `/post/${c.id}?pagina=1`) as never),
    };
  });
}

/** Jij op desktop: je profiel, de ingangen van Jij, en al je bijdragen. */
export function JijDesktopEcht({
  naam,
  linc,
  regels,
  ingangen,
  kaarten,
  stand,
}: {
  naam: string;
  linc: { beeld?: string | null; kleur: string | null; initiaal: string };
  regels: [string, string][];
  ingangen: JijIngang[];
  kaarten: CardPost[];
  stand?: string | null;
}) {
  const k = useKader();
  const nav = useNav();
  const bijdragen = useMijnStukken(kaarten);
  return (
    <DesktopPagina {...k} nav={nav} actief="you">
      <JijDesktop naam={naam} linc={linc} regels={regels} ingangen={ingangen} bijdragen={bijdragen} stand={stand} />
    </DesktopPagina>
  );
}

/**
 * Het profiel van een ander op desktop (`/user/<naam>`): de opbouw van Jij,
 * met de bio en de knoppen (Gesprek, Samen plannen, Linc toevoegen…) in
 * plaats van de ingangen. Zonder profiel (laden, niet gevonden, mislukt)
 * zegt de pagina dat, in hetzelfde kader.
 */
export function ProfielDesktopEcht({
  naam,
  linc,
  regels,
  bio,
  knoppen,
  kaarten,
  stand,
  melding,
}: {
  naam: string;
  linc: { beeld?: string | null; kleur: string | null; initiaal: string };
  regels: [string, string][];
  bio?: string;
  knoppen: { tekst: string; doe: () => void }[];
  kaarten: CardPost[];
  stand?: string | null;
  /** Geen profiel: wat er aan de hand is. */
  melding?: string | null;
}) {
  const k = useKader();
  const nav = useNav();
  const bijdragen = useMijnStukken(kaarten);
  return (
    <DesktopPagina {...k} nav={nav} actief={null}>
      {melding ? (
        <div style={{ flex: 1, background: "var(--g)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20 }} data-meet="profiel-melding">
          <span className="T" style={{ fontSize: 44 }}>
            {naam}
          </span>
          <span className="S dim">{melding}</span>
          {knoppen.length ? (
            <button className="btn S" onClick={knoppen[0].doe}>
              {knoppen[0].tekst}
            </button>
          ) : null}
        </div>
      ) : (
        <JijDesktop naam={naam} linc={linc} regels={regels} ingangen={[]} bijdragen={bijdragen} stand={stand} bio={bio} knoppen={knoppen} bijdragenLabel="Bijdragen" />
      )}
    </DesktopPagina>
  );
}

/** Meldingen op desktop: de rijen van notifications.tsx, met de tellers ernaast. */
export function MeldingenDesktopEcht(props: { rijen: MeldingDesktop[]; nieuw: number; verzoeken: number; allesGelezen: () => void; stand?: string | null }) {
  const k = useKader();
  const nav = useNav();
  return (
    <DesktopPagina {...k} nav={nav} actief={null}>
      <MeldingenDesktop {...props} />
    </DesktopPagina>
  );
}

/** Nieuwe bijdrage op desktop: één scherm in plaats van twee stappen. Sluiten gaat terug. */
export function NieuwDesktopEcht({ c }: { c: Compose }) {
  const router = useRouter();
  const k = useKader();
  const nav = useNav();
  const sluit = () => (router.canGoBack() ? router.back() : router.replace("/feed" as never));
  return (
    <DesktopPagina {...k} nav={nav} actief={null}>
      <NieuwDesktop c={c} sluit={sluit} />
    </DesktopPagina>
  );
}

/** Welke tab bij een pagina zonder desktopvorm hoort. */
function tabVan(pad: string): Tab | null {
  if (/^\/(friends|settings|lists?|qr-code|profile-edit|device-|recovery)/.test(pad)) return "you";
  if (/^\/(event|event-)/.test(pad)) return "events";
  if (/^\/(group|group-|chat)/.test(pad)) return "chats";
  return null;
}

/** Openbaar of nog niet binnen: daar geen kader. */
const ZONDER_KADER = /^\/($|welcome|login|signup|set-password|onboarding|auth-callback|e\/|c\/|add\/|dev\/catalogus\/)/;

/**
 * De bovenbalk van catalogus op desktop boven een pagina die (nog) geen eigen
 * desktopvorm heeft: instellingen, het profiel van een ander, een event, een
 * groep, lijsten, de QR-code. De pagina zelf staat eronder in de kolom van de
 * telefoon (app/_layout.tsx). Zo is elke pagina deel van dezelfde app, met
 * dezelfde tabbladen, Weergave, meldingen en +.
 */
export function KolomKop({ pad, voorbeeld = false }: { pad: string; /** Testpagina: ook zonder sessie. */ voorbeeld?: boolean }) {
  const { session } = useAuth();
  const k = useKader();
  const nav = useNav();
  const [menu, setMenu] = useState(false);
  if ((!session && !voorbeeld) || ZONDER_KADER.test(pad)) return null;
  return (
    <div className="cd kolomkop" data-stand={k.stand} data-meet="kolomkop">
      <style>{CSS}</style>
      <Kop
        actief={tabVan(pad)}
        nav={nav}
        helder={false}
        knop={<WeergaveKnop weergave={k.weergave} open={menu} zetOpen={setMenu} kies={k.kiesWeergave} stand={k.stand} kiesStand={k.kiesStand} />}
      />
    </div>
  );
}
