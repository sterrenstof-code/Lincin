/**
 * Een gekozen foto klaarmaken voor de upload: niet groter dan nodig.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT BESTAAT
 * ---------------------------------------------------------------
 * Een moderne telefoon levert foto's van 4000 à 8000 pixels breed, 5 tot
 * 15 MB. Die gingen ongewijzigd de bucket in: traag op 4G, duur in
 * opslag, en de server moest elke keer opnieuw dat hele bestand lezen om
 * er een tegel van 900 van te maken (`lib/media.ts`). Geen scherm in de
 * app toont een foto groter dan 2048 aan zijn langste kant — de detailplaat
 * vraagt 1600 — dus alles daarboven is gewicht zonder winst.
 *
 * ---------------------------------------------------------------
 * WAT HIJ DOET, EN WAT NIET
 * ---------------------------------------------------------------
 *   - Alleen verkleinen als de langste kant boven `maxDim` ligt. Een foto
 *     die al klein genoeg is, blijft byte voor byte wat hij was: opnieuw
 *     coderen kost kwaliteit en levert dan niets op.
 *   - De verhouding blijft: we zetten alleen de langste kant vast.
 *   - JPEG eruit, behalve voor een PNG: die kan transparant zijn (een
 *     schermafbeelding, een logo), en JPEG maakt van doorzichtig zwart.
 *     We kijken naar mime en extensie, niet naar de pixels — een PNG
 *     blijft dus altijd een PNG.
 *   - Een GIF (animatie) en video gaan er onaangeroerd door; de omzetter
 *     zou van een GIF één stilstaand beeld maken.
 *   - Lukt het niet (een formaat dat de browser niet kan lezen, zoals HEIC
 *     op web), dan komt het origineel terug. Een grote upload is beter dan
 *     geen upload.
 *
 * Op web werkt `ImageManipulator` via een canvas. De beeldkiezer geeft daar
 * een `blob:`-URL (zie `expo-image-picker` → `readFile`), en een `<img>`
 * laadt die gewoon; het resultaat is weer een `blob:`-URL, die
 * `uriToBytes` met `fetch` leest. Een `data:`-URI werkt op dezelfde
 * manier.
 *
 * De module wordt pas bij de eerste foto geladen, en een fout daarbij is
 * geen fout: `expo-image-manipulator` is een native module, en de
 * runtimeVersion volgt de appversie (app.config.ts). Een OTA-update met
 * deze code op een binary van vóór de module zou bij een import bovenaan
 * het bestand al crashen zodra het scherm laadt; zo uploadt hij gewoon
 * het origineel, zoals voorheen.
 */

export type PreparedImage = {
  uri: string;
  /** Het type van wat er nú achter `uri` zit — kan van HEIC/PNG naar JPEG gaan. */
  mimeType: string | undefined;
  width?: number;
  height?: number;
};

export async function prepareImageForUpload(
  uri: string,
  {
    maxDim = 2048,
    quality = 0.85,
    mimeType,
    width,
    height,
  }: {
    maxDim?: number;
    quality?: number;
    /** Wat de kiezer meldde (`asset.mimeType`); anders raden we op de extensie. */
    mimeType?: string | null;
    /** De maten van de kiezer, als die er zijn: dan hoeft een kleine foto niet eerst gedecodeerd te worden. */
    width?: number | null;
    height?: number | null;
  } = {},
): Promise<PreparedImage> {
  const kind = kindOf(uri, mimeType);
  const original: PreparedImage = { uri, mimeType: mimeType ?? undefined, width: width ?? undefined, height: height ?? undefined };
  if (kind === "passthrough") return original;
  // De kiezer kende de maat al en die is klein genoeg: niets te doen.
  if (width && height && Math.max(width, height) <= maxDim) return original;

  let mod: typeof import("expo-image-manipulator");
  try {
    mod = await import("expo-image-manipulator");
  } catch {
    return original;
  }
  const { ImageManipulator, SaveFormat } = mod;
  let ctx: ReturnType<typeof ImageManipulator.manipulate>;
  try {
    ctx = ImageManipulator.manipulate(uri);
  } catch {
    return original;
  }
  try {
    const loaded = await ctx.renderAsync();
    const w = loaded.width;
    const h = loaded.height;
    if (!w || !h || Math.max(w, h) <= maxDim) return { ...original, width: w || original.width, height: h || original.height };
    // Alleen de langste kant vast; de andere rekent de omzetter mee.
    ctx.resize(w >= h ? { width: maxDim } : { height: maxDim });
    const resized = await ctx.renderAsync();
    const png = kind === "png";
    const saved = await resized.saveAsync({ compress: quality, format: png ? SaveFormat.PNG : SaveFormat.JPEG });
    return { uri: saved.uri, mimeType: png ? "image/png" : "image/jpeg", width: saved.width, height: saved.height };
  } catch {
    return original;
  } finally {
    try {
      ctx.release();
    } catch {
      // Al vrijgegeven, of het platform kent geen release: niets aan te doen.
    }
  }
}

/**
 * Wat voor beeld het is, op mime of anders op de extensie (of het type in
 * een `data:`-URI). Onbekend telt als foto: dat is wat een camera levert.
 */
function kindOf(uri: string, mimeType?: string | null): "png" | "photo" | "passthrough" {
  const fromData = uri.startsWith("data:") ? uri.slice(5, uri.indexOf(";")) : "";
  const mime = (mimeType || fromData || "").toLowerCase();
  const ext = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/)?.[1]?.toLowerCase() ?? "";
  if (mime.startsWith("video/") || ["mp4", "mov", "m4v", "webm"].includes(ext)) return "passthrough";
  if (mime === "image/gif" || ext === "gif") return "passthrough";
  if (mime === "image/svg+xml" || ext === "svg") return "passthrough";
  if (mime === "image/png" || ext === "png") return "png";
  return "photo";
}
