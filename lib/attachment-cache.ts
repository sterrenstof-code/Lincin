import { useEffect, useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import { downloadEncryptedAttachment, type AttachmentInfo } from "@/lib/api/messages";
import { base64ToBytes } from "@/lib/crypto/base64";
import { bytesToDisplayUri, decryptFileBytes } from "@/lib/crypto/file";

/**
 * Ontsleutelde chatbijlagen, één keer per sessie in plaats van per mount.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT BESTAAT
 * ---------------------------------------------------------------
 * Elke bubbel met een foto (`AttachmentView` in app/chat/[id].tsx) en elke
 * miniatuur in de zijkolom (`ChatMediaThumb`) haalde bij het mounten het
 * versleutelde bestand op, ontsleutelde het en maakte er een nieuwe
 * weergave-URI van. Een FlatList mount en unmount rijen terwijl je scrolt,
 * dus dezelfde foto werd keer op keer gedownload en ontsleuteld — en op web
 * kwam er elke keer een `blob:`-URL bij die nooit werd vrijgegeven, zodat
 * het geheugen bleef groeien zolang het tabblad openstond. Dezelfde foto in
 * de bubbel én in de zijkolom was ook gewoon twee keer het werk.
 *
 * ---------------------------------------------------------------
 * WAT HIJ DOET
 * ---------------------------------------------------------------
 *   - Eén weergave-URI per opslagpad, in het geheugen. Het pad is uniek per
 *     upload, dus de sleutel en nonce die erbij horen veranderen nooit.
 *   - Twee vragers naar hetzelfde pad tegelijk delen één belofte: één
 *     download, één ontsleuteling.
 *   - LRU, begrensd op `MAX_ENTRIES` stuks en `MAX_BYTES` aan ontsleutelde
 *     bytes. Wie het langst niet gevraagd is, gaat eerst.
 *   - Een URI die nog op het scherm staat (`retain`, via de haak) wordt
 *     nooit weggegooid: een vrijgegeven `blob:`-URL onder een spelende
 *     video of een open lichtbak is een kapot beeld. De grens mag daardoor
 *     even overschreden worden; zodra het scherm hem loslaat, ruimt de
 *     volgende ronde op.
 *   - Weggooien geeft de URI echt vrij: `URL.revokeObjectURL` op web, en op
 *     native het tijdelijke bestand dat `bytesToDisplayUri` schreef.
 *   - Uitloggen leegt alles (`clearAttachmentCache`, vanuit app/_layout.tsx).
 *
 * Er komt hier niets bij op schijf of in AsyncStorage. Native schreef al
 * een tijdelijk bestand in de cachemap — video, spraak en "openen in" hebben
 * een bestand nodig, een data-URI speelt daar niet af — en dat blijft zo;
 * nieuw is dat het bestand ook weer verdwijnt.
 */

const MAX_ENTRIES = 50;
const MAX_BYTES = 50 * 1024 * 1024;

type Entry = { uri: string; bytes: number; refs: number };

/** Map onthoudt de volgorde van invoegen: de eerste is de oudste. */
const entries = new Map<string, Entry>();
const inflight = new Map<string, Promise<string>>();
/** Wie al vasthoudt voordat de URI er is; telt mee zodra hij binnenkomt. */
const pendingRefs = new Map<string, number>();
let totalBytes = 0;
/**
 * Ophogen bij uitloggen: een ontsleuteling die dan nog onderweg is, hoort
 * bij het vorige account en mag niet alsnog in de cache belanden.
 */
let generation = 0;

function release(uri: string) {
  if (Platform.OS === "web") {
    try {
      URL.revokeObjectURL(uri);
    } catch {
      // Al vrijgegeven; niets te doen.
    }
    return;
  }
  if (uri.startsWith("file:")) {
    FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}

function evict() {
  if (entries.size <= MAX_ENTRIES && totalBytes <= MAX_BYTES) return;
  for (const [path, entry] of entries) {
    if (entries.size <= MAX_ENTRIES && totalBytes <= MAX_BYTES) break;
    if (entry.refs > 0) continue;
    entries.delete(path);
    totalBytes -= entry.bytes;
    release(entry.uri);
  }
}

/** Achteraan zetten = als laatste gebruikt. */
function touch(path: string, entry: Entry) {
  entries.delete(path);
  entries.set(path, entry);
}

/** De weergave-URI van een bijlage: uit het geheugen, of één keer opgehaald en ontsleuteld. */
export function loadAttachmentUri(attachment: AttachmentInfo): Promise<string> {
  const { path } = attachment;
  const hit = entries.get(path);
  if (hit) {
    touch(path, hit);
    return Promise.resolve(hit.uri);
  }
  const running = inflight.get(path);
  if (running) return running;

  const gen = generation;
  const task = (async () => {
    const cipher = await downloadEncryptedAttachment(path);
    const plain = decryptFileBytes(
      cipher,
      base64ToBytes(attachment.key_b64),
      base64ToBytes(attachment.nonce_b64)
    );
    if (!plain) throw new Error("Decryptie faalde");
    const uri = await bytesToDisplayUri(plain, attachment.mime_type, `att-${path.split("/").pop()}`);
    if (gen !== generation) {
      // Uitgelogd terwijl dit liep: niet bewaren, en meteen vrijgeven.
      release(uri);
      throw new Error("Afgemeld");
    }
    const entry: Entry = { uri, bytes: plain.byteLength, refs: pendingRefs.get(path) ?? 0 };
    pendingRefs.delete(path);
    entries.set(path, entry);
    totalBytes += entry.bytes;
    evict();
    return uri;
  })().finally(() => {
    if (inflight.get(path) === task) inflight.delete(path);
  });
  inflight.set(path, task);
  return task;
}

/** Dit pad staat op het scherm: niet weggooien tot `releaseAttachment`. */
function retainAttachment(path: string) {
  const entry = entries.get(path);
  if (entry) entry.refs++;
  else pendingRefs.set(path, (pendingRefs.get(path) ?? 0) + 1);
}

function releaseAttachment(path: string) {
  const entry = entries.get(path);
  if (entry) {
    entry.refs = Math.max(0, entry.refs - 1);
    if (entry.refs === 0) evict();
    return;
  }
  const n = (pendingRefs.get(path) ?? 0) - 1;
  if (n > 0) pendingRefs.set(path, n);
  else pendingRefs.delete(path);
}

/** Uitgelogd: alle ontsleutelde bijlagen weg, ook die nog op het scherm staan. */
export function clearAttachmentCache() {
  generation++;
  for (const entry of entries.values()) release(entry.uri);
  entries.clear();
  inflight.clear();
  pendingRefs.clear();
  totalBytes = 0;
}

/**
 * De bijlage voor een onderdeel: `uri` zodra hij er is, anders `error`.
 *
 * Houdt het pad vast zolang het onderdeel gemount is (zie `retain` boven),
 * en zet bij een cache-hit de URI al in de eerste render, zodat een rij
 * die terugscrolt niet eerst een plaatshouder laat flitsen.
 */
export function useAttachmentUri(attachment: AttachmentInfo): { uri: string | null; error: string | null } {
  const { path } = attachment;
  const [state, setState] = useState<{ path: string; uri: string | null; error: string | null }>(() => ({
    path,
    uri: entries.get(path)?.uri ?? null,
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;
    retainAttachment(path);
    loadAttachmentUri(attachment).then(
      (uri) => {
        if (!cancelled) setState({ path, uri, error: null });
      },
      (e: any) => {
        if (!cancelled) setState({ path, uri: null, error: e?.message ?? "Kon bijlage niet laden" });
      }
    );
    return () => {
      cancelled = true;
      releaseAttachment(path);
    };
    // Het pad is de identiteit: sleutel, nonce en type horen er vast bij.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  // Een ander pad in hetzelfde onderdeel: niet de URI van het vorige tonen.
  if (state.path !== path) return { uri: entries.get(path)?.uri ?? null, error: null };
  return { uri: state.uri, error: state.error };
}

/**
 * Hetzelfde voor een album: één URI per foto, `null` tot hij er is (of als
 * hij niet laadt — één foto die faalt houdt de rest niet tegen).
 */
export function useAttachmentUris(album: AttachmentInfo[]): (string | null)[] {
  const paths = album.map((a) => a.path).join("\n");
  const [uris, setUris] = useState<(string | null)[]>(() => album.map((a) => entries.get(a.path)?.uri ?? null));

  useEffect(() => {
    let cancelled = false;
    setUris(album.map((a) => entries.get(a.path)?.uri ?? null));
    album.forEach((a, i) => {
      retainAttachment(a.path);
      loadAttachmentUri(a).then(
        (uri) => {
          if (!cancelled) setUris((prev) => prev.map((u, k) => (k === i ? uri : u)));
        },
        () => {}
      );
    });
    return () => {
      cancelled = true;
      album.forEach((a) => releaseAttachment(a.path));
    };
    // De paden zijn de identiteit; een nieuwe array met dezelfde paden is hetzelfde album.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paths]);

  return uris;
}
