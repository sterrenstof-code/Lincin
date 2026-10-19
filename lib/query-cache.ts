import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { defaultShouldDehydrateQuery, QueryClient, type Query } from "@tanstack/react-query";
import { removeOldestQuery, type PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import Constants from "expo-constants";

/**
 * De querycache, en wat ervan een herstart overleeft.
 *
 * Zonder dit begon elke start met lege lijsten en een draaiend wieltje:
 * React Query hield alles alleen in het geheugen. Nu staat het laatst
 * geziene overzicht meteen op het scherm en haalt de app op de achtergrond
 * het verse op (een herstelde query telt als verouderd en wordt opnieuw
 * gevraagd zodra een scherm hem gebruikt).
 *
 * Op het toestel én op web via AsyncStorage — op web is dat localStorage,
 * dezelfde opslag waar de sessie van Supabase al staat.
 */

const DAY = 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Bewaren gebeurt alleen voor queries die nog niet opgeruimd zijn;
      // met de standaard van vijf minuten was er na een nacht niets meer.
      gcTime: DAY,
      // Refetch op window-focus is uit-by-default omdat het op native
      // overkill is, maar we zetten het AAN voor de chats-query specifiek
      // via useQuery-options. Hier blijft de default uit zodat andere
      // queries (posts, events) niet onnodig refetchen.
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Alleen de overzichten achter de tabbladen en je eigen profiel. Bewust
 * NIET `messages`: dat is ontsleutelde chatinhoud, en die hoort nooit
 * leesbaar op schijf (app/chat/[id].tsx houdt hem alleen in het geheugen).
 * Ook geen detailpagina's: die zijn er bij het openen snel genoeg, en elke
 * extra sleutel maakt het bestand groter dat bij elke start gelezen wordt.
 */
const PERSISTED = new Set([
  "chats",
  "unified-feed",
  "notifications",
  "notifications-unread",
  "friendships",
  "events",
  "profile",
  "posts-by-user",
]);

/**
 * Van wie de cache op schijf is. Alleen queries van déze gebruiker
 * (`[naam, userId, …]`) gaan naar schijf; is er niemand ingelogd, dan gaat
 * er niets heen. Zo kan een tweede account op hetzelfde toestel nooit iets
 * van het eerste te zien krijgen — ook niet als het wissen bij uitloggen
 * mislukte, of een schrijfbeurt van vlak daarvoor nog onderweg was.
 */
let owner: string | null = null;

export function setCacheOwner(userId: string | null) {
  owner = userId;
}

function shouldPersist(query: Query): boolean {
  if (!owner || !defaultShouldDehydrateQuery(query)) return false;
  const [name, userId] = query.queryKey;
  return typeof name === "string" && PERSISTED.has(name) && userId === owner;
}

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "lincin-query-cache",
  // Vol (localStorage heeft op web een paar MB): de oudste query eruit en
  // opnieuw proberen, in plaats van helemaal niets te bewaren.
  retry: removeOldestQuery,
});

export const persistOptions: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister,
  maxAge: DAY,
  // Verandert de vorm van wat een query teruggeeft, verhoog dan het getal
  // achter de versie: een oude cache met een andere vorm laat een scherm
  // anders omvallen vóór de verse er is.
  buster: `${Constants.expoConfig?.version ?? "0"}:1`,
  dehydrateOptions: {
    shouldDehydrateQuery: shouldPersist,
    // Openstaande wijzigingen (een bericht dat nog verstuurd wordt) niet:
    // die horen bij deze sessie en kunnen ontsleutelde tekst dragen.
    shouldDehydrateMutation: () => false,
  },
};

/**
 * Niemand ingelogd: de cache op schijf weg, en er komt niets meer bij.
 * Wat er nog in het geheugen staat draagt de id van het vorige account in
 * zijn sleutel en wordt door niemand anders gelezen.
 */
export function dropPersistedCache() {
  setCacheOwner(null);
  void Promise.resolve(persister.removeClient()).catch(() => {});
}

/** Uitgelogd: niets van dit account meer in het geheugen of op schijf. */
export function forgetQueryCache() {
  dropPersistedCache();
  queryClient.clear();
}
