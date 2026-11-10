import { useRouter } from "expo-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";

import { EditPost } from "@/components/lincin/EditPost";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { useFeed } from "@/components/lincin/feed/useFeed";
import { useAuth } from "@/lib/auth/provider";
import { CATALOGUS, setPreference, useScheme } from "@/lib/design/theme";
import { LIKE } from "@/lib/lincin/likes";
import { usePrefs } from "@/lib/lincin/prefs";
import type { CardPost } from "@/lib/lincin/model";

import { CardVoorwerp, datumVan, soortVan, titelVan } from "../kaart";
import { useCatNav } from "../nav";
import { BijdrageCatalogus } from "../schermen/BijdrageCatalogus";
import { vandaag } from "../schermen/FeedCatalogus";
import { KOLOM } from "../stijl";
import { useBijdrage } from "../schermen/useBijdrage";
import { EventsDesktop, type EventRij, type Maand } from "./EventsDesktop";
import { FeedDesktop } from "./FeedDesktop";
import { GesprekkenDesktop, type GesprekRij } from "./GesprekkenDesktop";
import { JijDesktop, type JijIngang, type JijStuk } from "./JijDesktop";
import { DesktopPagina } from "./Pagina";
import { Paneel } from "./Paneel";
import { kiesWeergave, useWeergave } from "./weergave";
import type { DStuk, KaderNav, PaneelNav, Stand, Tab } from "./typen";

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
  if (startOpen && !f.feed.isLoading && !perId.has(startOpen)) return <KolomBijdrage id={startOpen} />;

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

/**
 * De pagina van een bijdrage op desktop: de bijdragepagina van catalogus
 * (volledige tekst, alle foto's, de hele draad) in de kolom van de telefoon.
 * Terug gaat naar waar je vandaan kwam.
 */
export function KolomBijdrage({ id }: { id: string }) {
  const scheme = useScheme();
  return (
    <View style={{ flex: 1, backgroundColor: CATALOGUS[scheme === "dark" ? "dark" : "light"].naad }}>
      <View style={{ flex: 1, width: KOLOM, alignSelf: "center", overflow: "hidden" }}>
        <BijdrageCatalogus id={id} />
      </View>
    </View>
  );
}

/** Het paneel op echte gegevens: de inhoud van de bijdragepagina, zonder het beeld. */
function PaneelEcht({ stuk, nav }: { stuk: DStuk; nav: PaneelNav }) {
  const router = useRouter();
  const b = useBijdrage(stuk.id, { naVerwijderen: nav.sluit });
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
  return (
    <>
      <Paneel
        nav={nav}
        inhoud={{
          wie: p ? b.naam : stuk.wie,
          soort: card ? soortVan(card) : stuk.soort,
          titel: card ? titelVan(card) : stuk.titel,
          datum: card ? datumVan(card) : stuk.datum,
          aantalReacties: p ? b.comments.total : stuk.reacties,
          hartjes: p ? b.likes.count : stuk.hartjes,
          vindIkLeuk: p ? b.likes.liked : stuk.vindIkLeuk,
          berichtAan: p && !b.own ? b.naam : null,
          reacties: p
            ? b.reacties(true).map((r) => ({
                id: r.id,
                naam: r.naam,
                tekst: r.tekst,
                linc: { beeld: typeof r.linc.beeld === "string" ? r.linc.beeld : null, kleur: r.linc.kleur ?? null, initiaal: r.linc.initiaal },
                antwoord: r.antwoord,
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
        }}
      />
      <PrivateSheet target={b.sheet} onClose={() => b.setSheet(null)} />
    </>
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
}: {
  rijen: GesprekRij[];
  gekozen: string | null;
  ongelezen: number;
  stand?: string | null;
  draad: ReactNode;
}) {
  const k = useKader();
  const nav = useNav();
  return (
    <DesktopPagina {...k} nav={nav} actief="chats">
      <GesprekkenDesktop rijen={rijen} gekozen={gekozen} ongelezen={ongelezen} stand={stand} draad={<div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>{draad}</div>} />
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
  const router = useRouter();
  const uris = useMemo(() => kaarten.map(beeldVan).filter((u): u is string => !!u), [kaarten]);
  const verh = useVerhoudingen(uris);
  const bijdragen: JijStuk[] = kaarten.map((c, i) => {
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
      // Een poll heeft zijn eigen pagina; de rest de bijdragepagina.
      open: () => router.push((c.kind === "poll" ? c.href : `/post/${c.id}?pagina=1`) as never),
    };
  });
  return (
    <DesktopPagina {...k} nav={nav} actief="you">
      <JijDesktop naam={naam} linc={linc} regels={regels} ingangen={ingangen} bijdragen={bijdragen} stand={stand} />
    </DesktopPagina>
  );
}
