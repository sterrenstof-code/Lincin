// Maakt lib/emoji-data.ts uit unicode-emoji-json (devDependency): per groep
// de emoji met hun Engelse naam, voor de volledige kiezer ("Meer").
// Alleen t/m Emoji 13.1 — 14 en later tonen Android-toestellen van vóór 12L als vierkantje.
// Huidtinten laten we weg (de standaard gele hand).
//   node scripts/gen-emoji.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const groups = JSON.parse(readFileSync(require.resolve("unicode-emoji-json/data-by-group.json"), "utf8"));

const NL = {
  smileys_emotion: "Gezichten",
  people_body: "Mensen",
  animals_nature: "Dieren en natuur",
  food_drink: "Eten en drinken",
  travel_places: "Reizen",
  activities: "Activiteiten",
  objects: "Voorwerpen",
  symbols: "Symbolen",
  flags: "Vlaggen",
};
const ICON = {
  smileys_emotion: "😀", people_body: "👋", animals_nature: "🌿", food_drink: "☕", travel_places: "✈️",
  activities: "⚽", objects: "💡", symbols: "❤️", flags: "🏳️",
};

const out = groups
  .filter((g) => g.slug !== "component")
  .map((g) => ({
    slug: g.slug,
    title: NL[g.slug] ?? g.name,
    icon: ICON[g.slug] ?? g.emojis[0]?.emoji,
    // "emoji naam" per regel, zodat het bestand klein blijft
    list: g.emojis.filter((e) => parseFloat(e.emoji_version) <= 13.1).map((e) => `${e.emoji} ${e.name}`).join("\n"),
  }));

const body = `// GEGENEREERD door scripts/gen-emoji.mjs — niet met de hand aanpassen.
// Bron: unicode-emoji-json (MIT). Per groep: "emoji naam" per regel.
export type EmojiGroup = { slug: string; title: string; icon: string; list: string };
export const EMOJI_GROUPS: EmojiGroup[] = ${JSON.stringify(out, null, 0)};
`;
writeFileSync(new URL("../lib/emoji-data.ts", import.meta.url), body);
console.log(out.map((g) => `${g.slug}: ${g.list.split("\n").length}`).join(", "), (body.length / 1024).toFixed(0) + " KB");
