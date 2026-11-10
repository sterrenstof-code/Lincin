import type { ReactNode } from "react";

/** De vier weergaven van de feed (briefing §2). `wand` is de standaard. */
export type Weergave = "wand" | "blad" | "lichtbak" | "gloedraster";
export const WEERGAVEN: Weergave[] = ["wand", "blad", "lichtbak", "gloedraster"];

export type Stand = "licht" | "donker";

export type Tab = "feed" | "chats" | "events" | "you";

/** Eén stuk van de editie, zoals de weergaven het tonen. */
export type DStuk = {
  id: string;
  /** "01" */
  nr: string;
  titel: string;
  wie: string;
  /** "foto", "tekst", … */
  soort: string;
  datum: string;
  /** De foto; zonder foto tekent `voorwerp` het stuk. */
  beeld: string | null;
  /** Het kleurveld: een verkleinde, vervaagde versie van de foto (briefing §6). */
  veld: string | null;
  /** Het eigen formaat op de wand; het raster neemt de helft. */
  b: number;
  h: number;
  /** Een stuk zonder foto: het voorwerp van mobiel, op zijn eigen maat. */
  voorwerp?: { node: ReactNode; b: number; h: number };
  hartjes: number;
  vindIkLeuk: boolean;
  reacties: number;
  /** Een stuk met een eigen pagina (een poll) opent die in plaats van het paneel. */
  eigenPagina?: () => void;
};

/** De kop van elke pagina: tabbladen, meldingen, nieuw, en de editie. */
export type KaderNav = {
  editie: string;
  datum: string;
  /** Aantal bijdragen, voor de kop van het blad. */
  inhoud: string;
  ongelezen: boolean;
  nieuweMeldingen: boolean;
  tab: (t: Tab) => void;
  meldingen: () => void;
  nieuw: () => void;
};

/** Een reactie in het paneel. */
export type PaneelReactie = {
  id: string;
  naam: string;
  tekst: string;
  linc: { beeld?: string | null; kleur: string | null; initiaal: string };
  antwoord: boolean;
};

/** Wat het paneel van een bijdrage toont (briefing §4, punt 4). */
export type PaneelInhoud = {
  wie: string;
  soort: string;
  titel: string;
  datum: string;
  aantalReacties: number;
  hartjes: number;
  vindIkLeuk: boolean;
  /** "Bericht aan …"; leeg bij je eigen bijdrage. */
  berichtAan: string | null;
  reacties: PaneelReactie[];
  /** Een regel onder de reacties (meer laden, laden, mislukt). */
  meer?: ReactNode;
  invoer: string;
  antwoordAan: string | null;
  /** Je eigen bijdrage: bewerken en verwijderen (⋯ in de kop van het paneel). */
  eigen?: {
    bewerk: () => void;
    verwijder: () => void;
    /** Het formulier zolang je bewerkt; anders null. */
    bewerken: ReactNode | null;
  };
  doe: {
    leuk: () => void;
    bericht: () => void;
    tekst: (v: string) => void;
    stuur: () => void;
    antwoord: (id: string) => void;
    stopAntwoord: () => void;
  };
};

/** Sluiten en bladeren in het paneel: van de feed, niet van de bijdrage. */
export type PaneelNav = {
  /** "02 van 08" */
  plaat: string;
  sluit: () => void;
  vorige: () => void;
  volgende: () => void;
  /** Naar de pagina van de bijdrage (de titel). */
  pagina?: () => void;
};
