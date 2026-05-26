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
        // ---- Shell (dark outer background) ----
        shell: {
          DEFAULT: "#0A0A0B",
          soft: "#15141A",
        },
        // ---- Paper (warm content surfaces) ----
        paper: {
          DEFAULT: "#F0D5B0", // peach (primary card)
          soft: "#EFE2CD",     // cream (subtle card)
          warm: "#D4C4A8",     // sand (group / sidebar)
          light: "#F5EFE2",    // ivory (body-text panel)
        },
        // ---- Ink (text on paper) ----
        ink: {
          DEFAULT: "#1A1714",
          soft: "#5A4F40",
          muted: "#8A7E6C",
        },
        // ---- Cream (text on shell) ----
        cream: {
          DEFAULT: "#F5E8D3",
          soft: "#C7BBA9",
          muted: "#8A8275",
        },
        // ---- Brand & accents ----
        brand: "#5B8DEF",   // Lincin blue — logo / e2e badge only
        flame: "#E66B3F",   // warm orange — highlight CTA card
        // ---- Lines ----
        line: {
          DEFAULT: "#2A2620",  // borders on shell
          paper: "#D8C29B",    // borders on paper
        },
        // ---- Legacy aliases (kept for backwards compat) ----
        bg: {
          DEFAULT: "#0A0A0B",
          soft: "#15141A",
          card: "#EFE2CD", // legacy "bg-card" now maps to paper-soft
        },
        accent: {
          DEFAULT: "#1A1714",  // primary CTA = ink
          soft: "#2A2620",
        },
        muted: "#8A7E6C",
      },
    },
  },
  plugins: [],
};
