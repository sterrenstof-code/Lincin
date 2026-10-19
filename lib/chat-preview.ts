import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";

import type { ChatWithMembers } from "@/lib/api/chats";
import { fetchLatestMessagesPerChat, type DecryptedMessage } from "@/lib/api/messages";

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

type ChatPreview = {
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

/** Bij uitloggen: de ontsleutelde regels horen niet op het toestel te blijven. */
export async function clearChatPreviews() {
  cache = {};
  for (const fn of listeners) fn({});
  await AsyncStorage.removeItem(KEY).catch(() => {});
}

/** Eén regel, ingekort tot wat er op een rij past. */
export function shortenForPreview(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  return oneLine.length > 120 ? `${oneLine.slice(0, 119)}…` : oneLine;
}

/** Zet één regel in `store`, tenzij wat er staat nieuwer is. Muteert `store`. */
function put(store: Store, chatId: string, preview: ChatPreview) {
  const existing = store[chatId];
  // Niet terugschrijven met iets ouders: de lijst en het gesprek schrijven
  // allebei, en ze komen niet altijd in volgorde binnen.
  if (existing && existing.at > preview.at) return false;
  store[chatId] = preview;
  return true;
}

function trim(store: Store) {
  const ids = Object.keys(store);
  if (ids.length > MAX) {
    const oldestFirst = ids.sort((a, b) => (store[a].at < store[b].at ? -1 : 1));
    for (const id of oldestFirst.slice(0, ids.length - MAX)) delete store[id];
  }
}

export async function rememberChatPreview(chatId: string, preview: ChatPreview) {
  await rememberChatPreviews([[chatId, preview]]);
}

/**
 * Meerdere regels tegelijk: één keer wegschrijven en één keer de lijst
 * laten hertekenen. Per regel apart betekende bij tien gesprekken tien
 * schrijfacties naar de opslag en tien keer de hele lijst opnieuw tekenen.
 */
export async function rememberChatPreviews(entries: readonly (readonly [string, ChatPreview])[]) {
  if (entries.length === 0) return;
  const store = { ...(await load()) };
  let changed = false;
  for (const [chatId, preview] of entries) changed = put(store, chatId, preview) || changed;
  if (!changed) return;
  trim(store);
  await persist(store);
}

/** De regel voor één bericht: de tekst, of een woord voor een bijlage. Null als er niets te tonen valt. */
export function previewLine(msg: DecryptedMessage): string | null {
  const text = msg.content?.text?.trim();
  if (text) return shortenForPreview(text);
  const album = msg.content?.album;
  if (album && album.length > 1) return `${album.length} foto's`;
  const place = msg.content?.place;
  if (place) return `📍 ${place.label || "Plek"}`;
  const attachment = msg.content?.attachment;
  if (!attachment) return null;
  return attachment.type === "video" ? "Clip" : attachment.type === "audio" ? "Spraakbericht" : "Foto";
}

function previewFor(msg: DecryptedMessage, chat: ChatWithMembers, myUserId: string): ChatPreview | null {
  const line = previewLine(msg);
  if (!line) return null;
  const fromMe = msg.sender_id === myUserId;
  const m = fromMe ? null : chat.members.find((x) => x.id === msg.sender_id);
  return { text: line, fromMe, sender: m ? m.display_name ?? m.username ?? null : null, at: msg.created_at };
}

/**
 * Per gesprek de `last_message_at` waarvoor we al keken. Een laatste
 * bericht dat niets oplevert (systeemmelding, niet te ontsleutelen) zou
 * anders bij elke render opnieuw opgehaald worden.
 */
const checked = new Map<string, string>();

/**
 * Bijwerken wat achterloopt.
 *
 * Alleen het gesprek zelf schreef de regel weg, dus de lijst toonde wat
 * je het laatst LAS en niet wat er het laatst GEZEGD werd. Loopt de regel
 * achter op `last_message_at` (die de server wél kent), dan halen we de
 * laatste berichten op en ontsleutelen ze hier — op het toestel, net als
 * het gesprek dat doet. Er gaat niets leesbaars naar de server.
 */
async function catchUp(chats: ChatWithMembers[], myUserId: string) {
  const store = await load();
  const stale: ChatWithMembers[] = [];
  for (const chat of chats) {
    const lastAt = chat.last_message_at;
    if (!lastAt || checked.get(chat.id) === lastAt) continue;
    const have = store[chat.id];
    if (have && Date.parse(have.at) >= Date.parse(lastAt)) continue;
    checked.set(chat.id, lastAt);
    stale.push(chat);
  }
  if (stale.length === 0) return;
  // Eén vraag voor alle gesprekken die achterlopen, in plaats van één per
  // gesprek na elkaar (0099). Daarna één keer wegschrijven.
  try {
    const byChat = await fetchLatestMessagesPerChat(
      stale.map((c) => c.id),
      myUserId,
      5
    );
    const entries: [string, ChatPreview][] = [];
    for (const chat of stale) {
      const msgs = byChat.get(chat.id) ?? [];
      // Nieuwste eerst zoeken naar iets dat een regel oplevert; een bericht
      // dat niet ontsleutelt (geen envelop voor mij) slaan we over. Levert
      // niets iets op, dan blijft de terugval: het aantal ongelezen.
      for (let i = msgs.length - 1; i >= 0; i--) {
        const pv = previewFor(msgs[i], chat, myUserId);
        if (pv) {
          entries.push([chat.id, pv]);
          break;
        }
      }
    }
    await rememberChatPreviews(entries);
  } catch {
    // Lukt het niet, dan blijft de oude regel staan; volgende keer opnieuw.
    for (const chat of stale) {
      if (checked.get(chat.id) === chat.last_message_at) checked.delete(chat.id);
    }
  }
}

/**
 * De onthouden regels. Geef de gesprekken mee en de regels die achterlopen
 * op het laatste bericht worden bijgewerkt.
 */
export function useChatPreviews(chats?: ChatWithMembers[], myUserId?: string): Store {
  const [store, setStore] = useState<Store>(cache ?? {});

  useEffect(() => {
    if (chats?.length && myUserId) void catchUp(chats, myUserId);
  }, [chats, myUserId]);

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
