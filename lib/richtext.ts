/**
 * Opmaak in een vondst.
 *
 * ---------------------------------------------------------------
 * WAAROM MARKDOWN EN GEEN EDITOR
 * ---------------------------------------------------------------
 * Een fragment is een stuk tekst dat iemand overtikt of plakt uit een boek
 * of een artikel. Dat vraagt om alinea's, een woord met nadruk, en soms
 * een citaat binnen het citaat. Het vraagt níet om lettertypes, kleuren of
 * uitlijning — die horen bij het ontwerp van de app, niet bij de schrijver.
 *
 * Daarom geen editor die HTML uitspuwt maar markdown-in-platte-tekst:
 *
 *   - `body_text` blijft één tekstkolom, geen migratie nodig
 *   - alles wat er al in staat blijft geldig; zonder sterretjes is het
 *     gewoon een alinea, precies zoals het nu getoond wordt
 *   - wat je plakt uit een andere app blijft leesbaar, ook als de
 *     markering niet meekomt
 *   - de opmaak kan nooit botsen met het typografisch stelsel, want dit
 *     bestand levert alleen *structuur* — `RichText` bepaalt hoe het oogt
 *
 * Ondersteund, bewust weinig:
 *
 *     **vet**        *cursief*        > citaat
 *     - opsomming    1. genummerd     ---  (scheidingslijn)
 *
 * Onderstrepen bestaat niet: dat is een overblijfsel van de typemachine en
 * botst met de haarlijnen in het ontwerp. Kopjes bestaan evenmin — een
 * fragment ís al een blok binnen een pagina die zijn eigen koppen heeft.
 */


const QUOTE_RE = /^\s*>\s?/;
const LIST_RE = /^\s*[-•]\s+/;
/** `1. ` en `1) ` allebei — mensen typen ze door elkaar. */
const ORDERED_RE = /^\s*\d+[.)]\s+/;

// ===============================================================
// Wat de opmaakbalk doet
// ===============================================================

export type Selection = { start: number; end: number };
export type EditResult = { text: string; selection: Selection };

/**
 * Zet er sterretjes omheen, of haal ze juist weg.
 *
 * Drie gevallen, en het derde is het gevoelige: staat de markering net
 * búiten wat je selecteerde (je koos het woord, niet de sterretjes), dan
 * hoort een tweede tik hem weg te halen in plaats van er nóg een paar
 * omheen te zetten. Zonder dat stapelen ze op tot `****woord****`.
 */
export function applyInlineMarker(
  text: string,
  selection: Selection,
  marker: "**" | "*"
): EditResult {
  const { start, end } = normalise(selection, text);
  const selected = text.slice(start, end);
  const len = marker.length;

  // Leeg: zet het paar neer en ga ertussen staan.
  if (start === end) {
    return {
      text: text.slice(0, start) + marker + marker + text.slice(start),
      selection: { start: start + len, end: start + len },
    };
  }

  // De markering zit ín de selectie.
  if (
    selected.length > len * 2 &&
    selected.startsWith(marker) &&
    selected.endsWith(marker)
  ) {
    const inner = selected.slice(len, -len);
    return {
      text: text.slice(0, start) + inner + text.slice(end),
      selection: { start, end: start + inner.length },
    };
  }

  // De markering zit er net buiten.
  if (text.slice(start - len, start) === marker && text.slice(end, end + len) === marker) {
    return {
      text: text.slice(0, start - len) + selected + text.slice(end + len),
      selection: { start: start - len, end: end - len },
    };
  }

  return {
    text: text.slice(0, start) + marker + selected + marker + text.slice(end),
    selection: { start: start + len, end: end + len },
  };
}

/**
 * Een teken vooraan elke geraakte regel — of weg, als ze het al hebben.
 *
 * Werkt op hele regels, ook als je maar één woord selecteerde: een citaat
 * dat halverwege een regel begint bestaat niet.
 */
export function applyLinePrefix(
  text: string,
  selection: Selection,
  prefix: "> " | "- " | "1. "
): EditResult {
  const { start, end } = normalise(selection, text);
  const from = text.lastIndexOf("\n", start - 1) + 1;
  const toIndex = text.indexOf("\n", end);
  const to = toIndex === -1 ? text.length : toIndex;

  const lines = text.slice(from, to).split("\n");
  const re =
    prefix === "> " ? QUOTE_RE : prefix === "- " ? LIST_RE : ORDERED_RE;
  const allMarked = lines.every((line) => line.trim() === "" || re.test(line));

  // Een genummerde lijst hoort door te tellen. Zonder dit staat er
  // "1." boven "1." boven "1." — de markering klopt, het lijstje niet.
  let n = 0;
  const next = lines
    .map((line) => {
      if (line.trim() === "") return line;
      if (allMarked) return line.replace(re, "");
      // Wisselen van soort: eerst de andere markering eraf, anders krijg
      // je "1. - iets".
      const bare = line.replace(QUOTE_RE, "").replace(LIST_RE, "").replace(ORDERED_RE, "");
      if (prefix === "1. ") {
        n += 1;
        return `${n}. ${bare}`;
      }
      return prefix + bare;
    })
    .join("\n");

  const result = text.slice(0, from) + next + text.slice(to);
  return { text: result, selection: { start: from, end: from + next.length } };
}

/** Een scheidingslijn op een eigen regel, met lucht erboven en eronder. */
export function insertRule(text: string, selection: Selection): EditResult {
  const { start, end } = normalise(selection, text);
  const before = text.slice(0, start).replace(/\n*$/, "");
  const after = text.slice(end).replace(/^\n*/, "");
  const middle = `${before ? "\n\n" : ""}---\n\n`;
  const result = before + middle + after;
  const caret = before.length + middle.length;
  return { text: result, selection: { start: caret, end: caret } };
}

/** Houdt een selectie binnen de tekst en op volgorde. */
function normalise(selection: Selection, text: string): Selection {
  const a = clamp(selection?.start ?? 0, text.length);
  const b = clamp(selection?.end ?? a, text.length);
  return { start: Math.min(a, b), end: Math.max(a, b) };
}

function clamp(n: number, max: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}
