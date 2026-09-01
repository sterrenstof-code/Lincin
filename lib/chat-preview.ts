import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

/**
 * De laatste regel van elk gesprek, zodat de chatlijst iets te zeggen heeft.
 *
 * ---------------------------------------------------------------
 * HET PROBLEEM
 * ---------------------------------------------------------------
 * Elke rij in de chatlijst droeg dezelfde ondertitel: "Direct • E2E", of
 * "Groep • 4 leden". Dat is een typeaanduiding, geen inhoud — twintig rijen
 * die alle twintig hetzelfde zeggen. En juist die regel is waarop je een
 * lijst afzoekt: je herkent een gesprek aan wat er als laatste in gezegd is,
 * niet aan het feit dat het versleuteld is (dat zijn ze allemaal).
 *
 * ---------------------------------------------------------------
 * WAAROM DIT LOKAAL STAAT EN NIET OP DE SERVER
 * ---------------------------------------------------------------
 * Dit is een end-to-end versleutelde app. De server ziet ciphertext en hoort
 * dat te blijven zien; een voorbeeldregel in de database zou betekenen dat
 * de laatste zin van élk gesprek in leesbare vorm op een server staat, en
 * dan is de versleuteling eromheen een gebaar.
 *
 * De client heeft de tekst wél — hij ontsleutelt hem om hem te tonen. Wat
 * hier gebeurt is dus niet "de zin ergens heen sturen" maar "de zin die dit
 * toestel al had onthouden". Hij verlaat het toestel niet.
 *
 * Praktisch gevolg, en het is dezelfde ruil als bij `lib/read-state.ts`: op
 * een tweede toestel is de lijst leeg tot je een gesprek opent. Daarom is de
 * terugval geen typeaanduiding maar het aantal ongelezen berichten — dat
 * weet de lijst wél zonder iets te ontsleutelen, en het is nog altijd meer
 * informatie dan "Direct • E2E".
 *
 * ---------------------------------------------------------------
 * WAT ER NIET IN GAAT
 * ---------------------------------------------------------------
 * Alleen tekst. Een foto of een clip levert een woord op ("Foto", "Clip") en
 * geen pad, geen URL en geen sleutel — er valt uit deze opslag dus niets
 * terug te halen wat je niet zelf al kon zien.
 */

const KEY = "lincin.chat-previews.v1";

/** Zoveel gesprekken onthouden we; de rest valt terug op het aantal. */
const MAX = 100;

export type ChatPreview = {
  /** Wat er staat. Al ingekort tot iets dat op één regel past. */
  text: string;
  /** Wie het zei — leeg als jij het was; de lijst zet er dan "Jij:" voor. */
  fromMe: boolean;
  /** Naam van de ander, alleen nodig in een groep. */
  sender?: string | null;
  at: string;
};

type Store = Record<string, ChatPreview>;

let cache: Store | null = null;
const listeners = new Set<(s: Store) => void>();

async function load(): Promise<Store> {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    // Kapotte opslag mag de chatlijst nooit tegenhouden.
    cache = {};
  }
  return cache;
}

async function persist(next: Store) {
  cache = next;
  for (const fn of listeners) fn(next);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Niet kunnen bewaren is geen fout die de gebruiker iets zegt: de
    // volgende keer staat er gewoon weer een aantal in plaats van een regel.
  }
}

/** Eén regel, ingekort tot wat er op een rij past. */
export function shortenForPreview(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? `${oneLine.slice(0, 119)}…` : oneLine;
}

export async function rememberChatPreview(chatId: string, preview: ChatPreview) {
  const store = { ...(await load()) };
  const existing = store[chatId];
  // Niet terugschrijven met iets ouders: de lijst en het gesprek schrijven
  // allebei, en ze komen niet altijd in volgorde binnen.
  if (existing && existing.at > preview.at) return;
  store[chatId] = preview;

  const ids = Object.keys(store);
  if (ids.length > MAX) {
    const oldestFirst = ids.sort((a, b) => (store[a].at < store[b].at ? -1 : 1));
    for (const id of oldestFirst.slice(0, ids.length - MAX)) delete store[id];
  }
  await persist(store);
}

/** Weghalen zodra een gesprek verdwijnt, zodat er geen wees achterblijft. */
export async function forgetChatPreview(chatId: string) {
  const store = { ...(await load()) };
  if (!(chatId in store)) return;
  delete store[chatId];
  await persist(store);
}

export function useChatPreviews(): Store {
  const [store, setStore] = useState<Store>(cache ?? {});

  useEffect(() => {
    let alive = true;
    void load().then((s) => {
      if (alive) setStore(s);
    });
    const fn = (s: Store) => setStore({ ...s });
    listeners.add(fn);
    return () => {
      alive = false;
      listeners.delete(fn);
    };
  }, []);

  return store;
}
