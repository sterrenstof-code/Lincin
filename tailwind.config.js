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
        // EDITORIAL NEUTRALS — de Fondation Phi / Yoko Ono palet.
        // Gebroken wit, zwarte inkt, zwarte haarlijnen. Dit is het
        // palet van de feed en de composer.
        // =========================================================
        page: {
          DEFAULT: "#F2F1EE", // gebroken wit — de pagina zelf
          alt: "#E9E8E4",     // lichtgrijze band, voor afwisseling
        },
        sheet: "#FFFFFF",     // zuiver wit vlak, voor beeldkaders
        carbon: {
          DEFAULT: "#12110F", // bijna-zwart — tekst, voetbalk, gevulde knop
          soft: "#55534E",    // secundaire tekst
          muted: "#8E8C86",   // labels, metadata
        },

        // =========================================================
        // SHELL / PAPER — het oudere warme systeem. Nog in gebruik
        // door chats, vrienden, profiel, events en auth. Zie
        // DESIGN.md §10 voor de migratievolgorde.
        // =========================================================
        shell: {
          DEFAULT: "#0A0A0B",
          soft: "#15141A",
        },
        paper: {
          DEFAULT: "#F0D5B0",
          soft: "#EFE2CD",
          warm: "#D4C4A8",
          light: "#F5EFE2",
        },
        ink: {
          DEFAULT: "#1A1714",
          soft: "#5A4F40",
          muted: "#8A7E6C",
        },
        cream: {
          DEFAULT: "#F5E8D3",
          soft: "#C7BBA9",
          muted: "#8A8275",
        },
        brand: "#5B8DEF",   // Lincin-blauw — logo / e2e-badge only
        flame: "#E66B3F",   // warm oranje — hooguit één accent per scherm
        line: {
          DEFAULT: "#2A2620",
          paper: "#D8C29B",
        },

        // ---- Legacy aliases (uitfaseren) ----
        bg: {
          DEFAULT: "#0A0A0B",
          soft: "#15141A",
          card: "#EFE2CD",
        },
        accent: {
          DEFAULT: "#1A1714",
          soft: "#2A2620",
        },
        muted: "#8A7E6C",
      },
    },
  },
  plugins: [],
};
