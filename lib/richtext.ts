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

export type InlineSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type RichBlock =
  | { kind: "paragraph"; spans: InlineSpan[] }
  | { kind: "quote"; spans: InlineSpan[] }
  | { kind: "list"; ordered: boolean; items: InlineSpan[][] }
  | { kind: "rule" };

const RULE_RE = /^\s*-{3,}\s*$/;
const QUOTE_RE = /^\s*>\s?/;
const LIST_RE = /^\s*[-•]\s+/;
/** `1. ` en `1) ` allebei — mensen typen ze door elkaar. */
const ORDERED_RE = /^\s*\d+[.)]\s+/;

// ===============================================================
// Inline: vet en cursief
// ===============================================================

/**
 * De sterretjes eruit, de nadruk erin.
 *
 * Roept zichzelf aan op wat er tussen de sterretjes stond, zodat
 * `**vet met *cursief* erin**` klopt. Dat kan niet oneindig doorgaan: de
 * binnenste aanroep vindt geen markering meer en stopt.
 *
 * Een los sterretje blijft gewoon staan. Wie `3 * 4` schrijft heeft geen
 * opmaak bedoeld, en een parser die dat opeet is erger dan een parser die
 * één teken laat staan.
 */
export function parseInline(text: string, inherited: Omit<InlineSpan, "text"> = {}): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const re = /\*\*([\s\S]+?)\*\*|\*([^*\n][\s\S]*?)\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      spans.push({ ...inherited, text: text.slice(last, match.index) });
    }
    if (match[1] !== undefined) {
      spans.push(...parseInline(match[1], { ...inherited, bold: true }));
    } else {
      spans.push(...parseInline(match[2], { ...inherited, italic: true }));
    }
    last = re.lastIndex;
  }

  if (last < text.length) {
    spans.push({ ...inherited, text: text.slice(last) });
  }
  return spans.filter((s) => s.text.length > 0);
}

// ===============================================================
// Blokken: alinea's, citaten, opsommingen, lijnen
// ===============================================================

/**
 * Regel voor regel, want een citaat of een opsomming loopt over meerdere
 * regels door en hoort dan één blok te zijn. Splitsen op lege regels alleen
 * zou `> een\n> twee` als twee losse citaten zien.
 */
export function parseRich(input: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  const lines = (input ?? "").replace(/\r\n?/g, "\n").split("\n");

  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: string[] = [];
  let listOrdered = false;

  function flush() {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", spans: parseInline(paragraph.join("\n")) });
      paragraph = [];
    }
    if (quote.length) {
      blocks.push({ kind: "quote", spans: parseInline(quote.join("\n")) });
      quote = [];
    }
    if (list.length) {
      blocks.push({
        kind: "list",
        ordered: listOrdered,
        items: list.map((item) => parseInline(item)),
      });
      list = [];
    }
  }

  for (const line of lines) {
    if (RULE_RE.test(line)) {
      flush();
      blocks.push({ kind: "rule" });
      continue;
    }
    if (line.trim() === "") {
      flush();
      continue;
    }
    if (QUOTE_RE.test(line)) {
      if (paragraph.length || list.length) flush();
      quote.push(line.replace(QUOTE_RE, ""));
      continue;
    }
    // Wisselen van soort begint een nieuwe lijst — een genummerde en een
    // ongenummerde reeks door elkaar is twee lijsten, geen één.
    if (ORDERED_RE.test(line)) {
      if (paragraph.length || quote.length || (list.length && !listOrdered)) flush();
      listOrdered = true;
      list.push(line.replace(ORDERED_RE, ""));
      continue;
    }
    if (LIST_RE.test(line)) {
      if (paragraph.length || quote.length || (list.length && listOrdered)) flush();
      listOrdered = false;
      list.push(line.replace(LIST_RE, ""));
      continue;
    }
    if (quote.length || list.length) flush();
    paragraph.push(line);
  }
  flush();

  return blocks;
}

/** Staat er eigenlijk iets in, of alleen markering? */
export function hasRichContent(input: string | null | undefined): boolean {
  return stripMarkdown(input ?? "").length > 0;
}

/**
 * De opmaak eraf.
 *
 * Voor de plekken waar één regel past en geen blok: een tegel in het
 * raster, de aankondiging van een melding, de kop van een kaart. Daar zou
 * `**zo**` als sterretjes op het scherm belanden.
 */
export function stripMarkdown(input: string | null | undefined): string {
  return (input ?? "")
    .replace(/\r\n?/g, "\n")
    .replace(RULE_RE_GLOBAL, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*[-•]\s+/gm, "• ")
    .replace(/^\s*(\d+)[.)]\s+/gm, "$1. ")
    .replace(/\*\*([\s\S]+?)\*\*/g, "$1")
    .replace(/\*([^*\n][\s\S]*?)\*/g, "$1")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

const RULE_RE_GLOBAL = /^\s*-{3,}\s*$/gm;

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

/**
 * Enter in een lijst.
 *
 * Dit is wat een opsomming van een truc een gereedschap maakt. Zonder dit
 * typ je elk streepje met de hand, en dan gebruik je het na twee regels
 * niet meer.
 *
 * Twee gevallen. Staat er iets op de regel, dan komt de volgende markering
 * eronder (en telt een genummerde lijst door). Is de regel leeg — je tikte
 * Enter op een lege bullet — dan is dat het teken dat je klaar bent: de
 * markering verdwijnt en je staat weer in een gewone alinea. Precies zoals
 * elke teksteditor het doet, dus niemand hoeft het te leren.
 *
 * Geeft `null` terug als de cursor niet in een lijst staat; dan moet Enter
 * gewoon Enter blijven.
 */
export function continueList(text: string, selection: Selection): EditResult | null {
  const { start, end } = normalise(selection, text);
  if (start !== end) return null;

  const from = text.lastIndexOf("\n", start - 1) + 1;
  const line = text.slice(from, start);

  const ordered = ORDERED_RE.exec(line);
  const bullet = ordered ? null : LIST_RE.exec(line);
  if (!ordered && !bullet) return null;

  const marker = (ordered ?? bullet)![0];
  const content = line.slice(marker.length);

  // Lege bullet: de lijst eindigt hier.
  if (content.trim() === "") {
    const result = text.slice(0, from) + text.slice(start);
    return { text: result, selection: { start: from, end: from } };
  }

  let nextMarker: string;
  if (ordered) {
    const n = parseInt(marker, 10);
    const sep = marker.includes(")") ? ")" : ".";
    nextMarker = `${(Number.isFinite(n) ? n : 1) + 1}${sep} `;
  } else {
    nextMarker = marker.replace(/^\s*/, "");
  }

  const insert = "\n" + nextMarker;
  const result = text.slice(0, start) + insert + text.slice(start);
  const caret = start + insert.length;
  return { text: result, selection: { start: caret, end: caret } };
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
