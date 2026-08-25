/**
 * De kleurtokens voor klassen. De tweelingbroer hiervan staat in
 * `lib/design/type.ts` (dezelfde kleuren, maar als prop) en het systeem
 * eromheen in `DESIGN.md`.
 *
 * ---------------------------------------------------------------
 * WAT HIER SINDS DE TWEE STANDEN VERANDERD IS
 * ---------------------------------------------------------------
 * Er staan geen hexwaarden meer in dit bestand. Élk token wijst naar een
 * CSS-variabele, en die variabelen krijgen hun waarde in `global.css`:
 * één set onder `:root` (licht) en één onder `.dark:root` (donker). De
 * leesbare versie mét de redenering per kleur staat in
 * `lib/design/theme.ts`.
 *
 * De tokennamen zijn precies dezelfde gebleven — ~1000 klassegebruiken in
 * 37 schermen wijzen ernaar. Dat is dezelfde zet als bij de v3-uitrol: de
 * namen houden, de waarden verplaatsen. Alleen gebeurt het nu niet meer
 * bij een commit maar op het moment dat iemand van stand wisselt.
 */

/**
 * Een token dat standaard níet dekkend is — een lijn op 25%, een
 * bijschrift op 58%.
 *
 * Tailwind geeft bij een klasse zónder modifier (`border-line-paper`) niet
 * `undefined` mee maar zijn eigen `var(--tw-border-opacity)`. Daar is niets
 * aan te zien, dus herkennen we die vorm en zetten we onze eigen
 * standaarddoorzichtigheid ervoor in de plaats. Mét modifier
 * (`border-line-paper/60`) komt er een echt getal binnen en gebruiken we dat.
 */
const withAlpha = (v, defaultAlpha) => ({ opacityValue } = {}) => {
  const bare = opacityValue === undefined || String(opacityValue).startsWith("var(--tw-");
  return `rgb(var(${v}) / ${bare ? defaultAlpha : opacityValue})`;
};

/** Een dekkend token. De modifier (`bg-shell/70`) werkt gewoon. */
const solid = (v) => `rgb(var(${v}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  // De stand hangt aan een klasse op <html>, niet aan de mediaquery: anders
  // kan iemand die licht kiest terwijl zijn systeem donker staat niet uit de
  // donkere stand komen. Zie `applyWeb` in lib/design/theme.ts.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ---- Vlakken ----
        page: {
          DEFAULT: solid("--c-page"), // het paginavlak
          alt: solid("--c-panel"),    // lichter paneel
        },
        sheet: solid("--c-panel"),    // licht vlak, voor beeldkaders
        paper: {
          DEFAULT: solid("--c-page"),
          soft: solid("--c-panel"),
          warm: solid("--c-paper-warm"),
          light: solid("--c-paper-light"),
        },
        shell: {
          DEFAULT: solid("--c-shell"),     // de balk bovenaan — zwart in béide standen
          soft: solid("--c-shell-soft"),   // donker vlak bínnen die balk
        },

        // Het werkblad van de niet-gemigreerde schermen (DESIGN.md §8): een
        // vlak dat, net als `feed-post`, samen met zijn tekst kantelt. Zwart
        // met crème in de donkere stand — exact wat die schermen nu al zijn —
        // en een blad met inkt in de lichte.
        desk: {
          DEFAULT: solid("--c-desk"),
          ink: solid("--c-desk-ink"),
          soft: solid("--c-desk-soft"),
          muted: solid("--c-desk-muted"),
          panel: solid("--c-desk-panel"),
        },

        // ---- Tekst ----
        ink: {
          DEFAULT: solid("--c-ink"),
          soft: solid("--c-ink-soft"),
          muted: solid("--c-ink-muted"),
        },
        carbon: {
          DEFAULT: solid("--c-ink"),
          soft: solid("--c-ink-soft"),
          muted: solid("--c-ink-muted"),
        },
        // Tekst op zwart, op plum-in-de-balk en op de oranje knop. Blijft in
        // béide standen licht — de vlakken waar hij op staat blijven donker.
        cream: {
          DEFAULT: solid("--c-cream"),
          soft: solid("--c-cream-soft"),
          muted: solid("--c-cream-muted"),
        },

        // ---- Accent ----
        // Donker: het drukwerkrood. Licht: de oranje, dieper gezet zodat hij
        // op wit blijft staan. `deep` is in beide standen de variant die
        // klein gezet nog 4.5:1 haalt.
        flame: {
          DEFAULT: solid("--c-flame"),
          deep: solid("--c-flame-deep"),
        },
        // De aankondigingsbalk en de primaire actie. Dezelfde oranje in
        // beide standen — dat is de kleur die de app herkenbaar maakt.
        announce: {
          DEFAULT: solid("--c-announce"),
          deep: solid("--c-announce-deep"),
        },

        // ---- Het kaartoppervlak ----
        // `post` kantelt als enige vlak volledig mee: plum in de donkere
        // stand, wit in de lichte. Zijn tekst (`feed-text`) en zijn lijn
        // (`feed-rule`) kantelen mee, anders staat er crème op wit.
        feed: {
          lav: solid("--c-page"),
          ink: solid("--c-ink"),
          panel: solid("--c-panel"),
          post: solid("--c-post"),
          fill: solid("--c-post-fill"), // beeldvlak in afwachting van de foto
          text: solid("--c-post-text"),
          dim: withAlpha("--c-post-text", "var(--a-post-dim)"),
          rule: withAlpha("--c-post-text", "var(--a-post-rule)"),
        },

        // Secundaire accenten. Enkel voor de tegels in de feed.
        teal: solid("--c-teal"),
        gold: solid("--c-gold"),

        brand: solid("--c-brand"), // logo / e2e-badge only
        line: {
          DEFAULT: solid("--c-ink"),
          paper: withAlpha("--c-ink", "var(--a-line-paper)"),
        },

        // ---- Legacy aliases (uitfaseren) ----
        bg: {
          DEFAULT: solid("--c-ink"),
          soft: solid("--c-shell-soft"),
          card: solid("--c-panel"),
        },
        accent: {
          DEFAULT: solid("--c-ink"),
          soft: solid("--c-ink-soft"),
        },
        muted: solid("--c-ink-muted"),
      },
    },
  },
  plugins: [],
};
