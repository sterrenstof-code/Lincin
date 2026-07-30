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
        // palet van de composer en de nog niet omgezette feed-delen.
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
        // FEED V3 — lavendel / plum. ALLEEN het feed-scherm.
        //
        // Bewust een eigen `feed-`namespace: het oudere warme palet
        // gebruikt `ink` en `paper` al voor heel andere waarden, en
        // die schermen (chat, vrienden, profiel, events, auth) mogen
        // hier niet door verschuiven. Zie DESIGN.md §10.
        //
        //   feed-lav    (--lav)            paginavlak van de feed
        //   feed-ink    (--ink)            tekst + kaders, altijd 1.5px
        //   feed-panel  (--paper-150)      enkel het zijbalk-paneel
        //   feed-post   (--post-bg)        élk post-oppervlak
        //   feed-text   (--post-text)      tekst op feed-post
        //   feed-dim    (--post-text-dim)  bijschrift op feed-post
        // =========================================================
        feed: {
          lav: "#CDBEE3",
          ink: "#0B0A0C",
          panel: "#EFE9F5",
          post: "#2E2138",
          text: "#F3EDE4",
          dim: "rgba(243,237,228,0.62)",
        },

        // Secundaire accenten van de feed. Opgehelderd t.o.v. de
        // oorspronkelijke waarden (#1E7A72 / #B8862E) omdat die enkel
        // op wit werkten — op `feed-post` zakken ze weg.
        teal: "#4FBDB0",
        gold: "#E3A84B",

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
        // `flame` was een losse string; nu een object zodat `bg-flame`
        // exact hetzelfde blijft en `flame-deep` erbij kan. Deep is de
        // variant die klein gezet nog leesbaar is (kickers, categorie).
        flame: {
          DEFAULT: "#E66B3F", // warm oranje — hooguit één accent per scherm
          deep: "#C4491F",    // klein-tekst-veilig
        },
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
