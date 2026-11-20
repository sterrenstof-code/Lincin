// npm run rls:proef — draait scripts/rls-proef.sql tegen de gekoppelde
// database (alles wordt teruggedraaid) en faalt bij één rode regel.
import { execFileSync } from "node:child_process";

const uit = execFileSync("supabase", ["db", "query", "--linked", "-f", "scripts/rls-proef.sql"], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
const rijen = JSON.parse(uit.slice(uit.indexOf("{"), uit.lastIndexOf("}") + 1)).rows;
for (const r of rijen) console.log(`${r.uitkomst === "groen" ? "✓" : "✗"} ${r.naam}`);
const rood = rijen.filter((r) => r.uitkomst !== "groen").length;
console.log(rood ? `\n${rood} van ${rijen.length} rood` : `\n${rijen.length}/${rijen.length} groen`);
process.exit(rood ? 1 : 0);
