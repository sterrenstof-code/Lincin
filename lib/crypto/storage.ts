import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * Cross-platform secure-ish storage for cryptographic key material.
 *
 *  - iOS / Android: expo-secure-store (Keychain / Keystore backed).
 *  - Web:           IndexedDB via a tiny custom wrapper. NOTE: this is not
 *                   as strong as native Keychain — keys live in the browser
 *                   profile. For the MVP this is acceptable; we can later
 *                   wrap with a passphrase-derived key.
 */

const DB_NAME = "comm-app-secure";
const STORE = "kv";

/**
 * Op web mag de browser wat een site bewaart opruimen als het toestel vol
 * raakt (Chrome op Android doet dat echt). Dan is de sleutel weg en staat
 * er bij de volgende keer "Haal je sleutel naar dit toestel". Met `persist`
 * vragen we de browser dat niet te doen. Chrome beslist dat zelf, zonder
 * iets te vragen. Wist iemand zelf de sitegegevens, dan helpt dit niet.
 * We vragen het één keer per sessie, zodra er een sleutel gelezen of
 * geschreven wordt.
 */
let blijvendGevraagd = false;
function vraagBlijvend(): void {
  if (blijvendGevraagd || typeof navigator === "undefined" || !navigator.storage?.persist) return;
  blijvendGevraagd = true;
  navigator.storage
    .persisted()
    .then((al) => (al ? true : navigator.storage.persist()))
    .catch(() => {});
}

function openDB(): Promise<IDBDatabase> {
  vraagBlijvend();
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function webGet(key: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve((req.result as string) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function webSet(key: string, value: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function webDel(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === "web") return webGet(key);
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === "web") return webSet(key, value);
    return SecureStore.setItemAsync(key, value);
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === "web") return webDel(key);
    return SecureStore.deleteItemAsync(key);
  },
};
