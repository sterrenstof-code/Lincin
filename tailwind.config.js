/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./lib/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // =========================================================
        // HET SYSTEEM — lavendel / plum / inkt, met één rood accent.
        //
        // Sinds de v3-uitrol is dit het palet van de HELE app, niet
        // meer alleen de feed. De semantische namen hieronder
        // (shell/paper/ink/cream/page/carbon) zijn bewust blijven
        // bestaan: ~1000 klassegebruiken in 37 schermen wijzen
        // ernaar, en door de wáárden te herwijzen schuift alles in
        // één keer mee zonder die schermen aan te raken.
        //
        // De oude warme waarden staan in `_backup_feed_v3/` en in
        // git-historie als je wil vergelijken.
        // =========================================================

        // ---- Vlakken ----
        page: {
          DEFAULT: "#CDBEE3", // lavendel — het paginavlak
          alt: "#EFE9F5",     // lichter paneel, voor afwisseling
        },
        sheet: "#EFE9F5",     // licht vlak, voor beeldkaders
        paper: {
          DEFAULT: "#CDBEE3", // lavendel
          soft: "#EFE9F5",    // paneel
          warm: "#BFACDB",    // iets dieper lavendel, voor banden
          light: "#F5F1FA",   // bijna wit met een lila zweem
        },
        shell: {
          DEFAULT: "#0B0A0C", // inkt — de donkere app-omlijsting
          soft: "#2E2138",    // plum — élk donker kaart-oppervlak
        },

        // ---- Tekst ----
        ink: {
          DEFAULT: "#0B0A0C", // op lavendel
          soft: "#3A3540",
          muted: "#6B6474",
        },
        carbon: {
          DEFAULT: "#0B0A0C",
          soft: "#3A3540",
          muted: "#6B6474",
        },
        cream: {
          DEFAULT: "#F3EDE4", // op inkt of plum
          soft: "#D9D2E4",
          muted: "#A79FB5",
        },

        // ---- Accent ----
        // Het scherpe drukwerk-rood uit de referenties. Vervangt het
        // oude warme oranje (#E66B3F) overal; `bg-flame` en
        // `text-flame` blijven dus werken en worden alleen roder.
        // `deep` is de variant die klein gezet nog leest op lavendel —
        // de DEFAULT haalt op die achtergrond geen 4.5:1.
        flame: {
          DEFAULT: "#E63329", // citaten, indexcijfers, vullingen, lijnwerk
          deep: "#A81C13",    // kickers, categorielabels, kleine tekst
        },

        // Het warme oranje van de aankondigingsbalk. Dat is de ENIGE plek
        // waar het nog voorkomt — het rood hierboven draagt alle andere
        // accenten. Bewust een eigen naam, zodat een latere zoek-vervang op
        // `flame` de balk niet per ongeluk meeneemt.
        announce: "#E66B3F",

        // ---- Feed-specifiek (ongewijzigd) ----
        feed: {
          lav: "#CDBEE3",
          ink: "#0B0A0C",
          panel: "#EFE9F5",
          post: "#2E2138",
          text: "#F3EDE4",
          dim: "rgba(243,237,228,0.62)",
        },

        // Secundaire accenten. Enkel voor de tegels in de feed —
        // buiten de feed draagt het rood het accent alleen.
        teal: "#4FBDB0",
        gold: "#E3A84B",

        brand: "#5B8DEF",   // Lincin-blauw — logo / e2e-badge only
        line: {
          DEFAULT: "#0B0A0C",
          paper: "rgba(11,10,12,0.25)",
        },

        // ---- Legacy aliases (uitfaseren) ----
        bg: {
          DEFAULT: "#0B0A0C",
          soft: "#2E2138",
          card: "#EFE9F5",
        },
        accent: {
          DEFAULT: "#0B0A0C",
          soft: "#3A3540",
        },
        muted: "#6B6474",
      },
    },
  },
  plugins: [],
};
