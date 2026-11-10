import { Asset } from "expo-asset";

import type { DStuk, PaneelReactie } from "../typen";

/**
 * De voorbeeldgegevens van de desktoptestpagina's: letterlijk de inhoud van
 * design_handoff_lincin_3e/desktop/prototype (acht stukken, dezelfde namen,
 * titels, maten en beelden; waarden tussen haken zijn plaatshouders).
 * Alleen in ontwikkeling (app/dev/catalogus-desktop).
 */

const url = (m: number) => Asset.fromModule(m).uri;

const BEELD = {
  "post-drank.jpg": require("@/assets/catalogus-voorbeeld/post-drank.jpg"),
  "post-kamer.jpg": require("@/assets/catalogus-voorbeeld/post-kamer.jpg"),
  "post-tafel.jpg": require("@/assets/catalogus-voorbeeld/post-tafel.jpg"),
  "prop-sterren.jpg": require("@/assets/catalogus-voorbeeld/prop-sterren.jpg"),
  "prop-koffie.jpg": require("@/assets/catalogus-voorbeeld/prop-koffie.jpg"),
  "prop-raket.jpg": require("@/assets/catalogus-desktop-voorbeeld/prop-raket.jpg"),
  "prop-kat.jpg": require("@/assets/catalogus-voorbeeld/prop-kat.jpg"),
  "prop-kat-hero.jpg": require("@/assets/catalogus-voorbeeld/prop-kat-hero.jpg"),
} as const;

const VELD: Record<keyof typeof BEELD, number> = {
  "post-drank.jpg": require("@/assets/catalogus-desktop-voorbeeld/blur-post-drank.jpg"),
  "post-kamer.jpg": require("@/assets/catalogus-desktop-voorbeeld/blur-post-kamer.jpg"),
  "post-tafel.jpg": require("@/assets/catalogus-desktop-voorbeeld/blur-post-tafel.jpg"),
  "prop-sterren.jpg": require("@/assets/catalogus-desktop-voorbeeld/blur-prop-sterren.jpg"),
  "prop-koffie.jpg": require("@/assets/catalogus-desktop-voorbeeld/blur-prop-koffie.jpg"),
  "prop-raket.jpg": require("@/assets/catalogus-desktop-voorbeeld/blur-prop-raket.jpg"),
  "prop-kat.jpg": require("@/assets/catalogus-desktop-voorbeeld/blur-prop-kat.jpg"),
  "prop-kat-hero.jpg": require("@/assets/catalogus-desktop-voorbeeld/blur-prop-kat-hero.jpg"),
};

export const beeld = (k: keyof typeof BEELD) => url(BEELD[k]);

type Voorbeeld = { id: number; img: keyof typeof BEELD; who: string; title: string; date: string; likes: number; w: number; h: number; cm: PaneelReactie[] };

const P: Voorbeeld[] = [
  {
    id: 1,
    img: "post-drank.jpg",
    who: "Mie",
    title: "18 okt",
    date: "18 okt",
    likes: 2,
    w: 340,
    h: 440,
    cm: [
      { id: "c1", naam: "[naam]", tekst: "Sante he vanuit Spanje!", linc: { kleur: "#D9D7D1", initiaal: "?" }, antwoord: false },
      { id: "c2", naam: "Toysman de creator", tekst: "Sante!", linc: { kleur: "#6E8A97", initiaal: "T" }, antwoord: true },
    ],
  },
  { id: 2, img: "post-kamer.jpg", who: "johanna.coysman", title: "Herfst :)", date: "[datum]", likes: 0, w: 250, h: 320, cm: [] },
  { id: 3, img: "post-tafel.jpg", who: "johanna.coysman", title: "Vuu…", date: "[datum]", likes: 1, w: 300, h: 340, cm: [] },
  { id: 4, img: "prop-sterren.jpg", who: "Noor", title: "[voorbeeld 04]", date: "[datum]", likes: 0, w: 220, h: 280, cm: [] },
  { id: 5, img: "prop-koffie.jpg", who: "Lotte", title: "[voorbeeld 05]", date: "[datum]", likes: 3, w: 280, h: 360, cm: [] },
  { id: 6, img: "prop-raket.jpg", who: "Noor", title: "[voorbeeld 06]", date: "[datum]", likes: 0, w: 230, h: 300, cm: [] },
  { id: 7, img: "prop-kat.jpg", who: "Sem", title: "[voorbeeld 07]", date: "[datum]", likes: 4, w: 260, h: 300, cm: [] },
  { id: 8, img: "prop-kat-hero.jpg", who: "Mie", title: "[voorbeeld 08]", date: "[datum]", likes: 1, w: 240, h: 330, cm: [] },
];

export const REACTIES: Record<string, PaneelReactie[]> = Object.fromEntries(P.map((p) => [String(p.id), p.cm]));

export function stukken(): DStuk[] {
  return P.map((p) => ({
    id: String(p.id),
    nr: String(p.id).padStart(2, "0"),
    titel: p.title,
    wie: p.who,
    soort: "foto",
    datum: p.date,
    beeld: url(BEELD[p.img]),
    veld: url(VELD[p.img]),
    b: p.w,
    h: p.h,
    hartjes: p.likes,
    vindIkLeuk: false,
    reacties: p.cm.length,
  }));
}

export const NAV_TEKST = { editie: "№ 34", datum: "ma 9 nov 2026", inhoud: "8 bijdragen" };

/** Gesprekken (prototype `CH`). */
export const GESPREKKEN = [
  { n: "Noor", c: "#C1724E", img: "prop-kat.jpg" as const, t: "2 m", u: 2, m: [["Heb je die van Mie gezien?", 0], ["@post", 0], ["Ja! Zin in.", 1], ["zondag 10:00 bij de pont?", 0]] as [string, number][] },
  { n: "Kamp '26", c: "#8A9273", t: "38 m", u: 1, m: [["Wie neemt de tent?", 0]] as [string, number][] },
  { n: "Sem", c: "#6E8A97", t: "3 u", u: 0, m: [["Dat was toch vorig jaar ook zo", 0], ["haha ja precies", 1]] as [string, number][] },
  { n: "Lotte", c: "#C9B77F", img: "prop-koffie.jpg" as const, t: "1 d", u: 0, m: [["[spraakbericht 0:41]", 0]] as [string, number][] },
  { n: "Yusuf", c: "#A9503F", t: "4 d", u: 0, m: [] as [string, number][] },
];

const COL: Record<string, string> = { Noor: "#C1724E", Sem: "#6E8A97", Daan: "#8A9273", Lotte: "#C9B77F", Yusuf: "#A9503F", jij: "#D9D7D1" };
export const kleurVan = (w: string) => COL[w] ?? "#D9D7D1";

/** Events (prototype `EV`). */
export const EVENTS = [
  { d: "15", m: "nov", w: "zo · 14:00", t: "Naar de dijk bij Marken", pl: "Marken", host: "Noor", who: ["Noor", "Sem"], go: true },
  { d: "28", m: "nov", w: "vr tot zo", t: "Kamp '26, de generale", pl: "Twiske", host: "Daan", who: ["Daan", "Sem", "Noor", "Lotte"], go: true },
  { d: "12", m: "dec", w: "do · 20:30", t: "Beach House, Paradiso", pl: "Amsterdam", host: "Yusuf", who: ["Yusuf"], go: false },
];
