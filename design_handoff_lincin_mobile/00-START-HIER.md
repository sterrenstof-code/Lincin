# Lincin — design handoff, version 2.1

**Read `HANDOFF.md`.** It is the complete current specification and opens with a table of what is new since 2.0 and what is unchanged.

## Files
| File | What it is |
|---|---|
| `HANDOFF.md` | Full spec: prompt for the dev team, changelog 2.0 → 2.1, tokens, chrome, all 11 screens, the three themes, data model, i18n. |
| `LincinApp.dc.html` | The complete interactive prototype — 11 screens, 3 themes, light/dark, NL/EN/DE. Single source of truth. |
| `Lincin Final.dc.html` | Handoff board: the app framed 11 times with theme + light/dark switches (dark is default). |
| `Lincin Desktop.dc.html` | Desktop/web layout — REFERENCE ONLY, navigation model under review. |
| `Lincin Desktop Opties.dc.html` | Desktop + mobile references for the Magazine and Modern themes. |
| `Lincin v2.dc.html` | Exploration history, reference only. |
| `oud-designsysteem/` | The existing 2.0 design system lifted from the codebase — tokens, type scale, ThemeProvider, post card/media/compose components, fonts, `DESIGN.md`. Reference for diffing against 2.1. |
| `screenshots/` | 66 captures (3 themes × light/dark × 11 screens) + 6 contact sheets. |
| `ios-frame.jsx`, `image-slot.js`, `support.js` | Prototype runtime helpers — **not** to be ported. |

## Order of work
Tokens → ThemeProvider → post card + media kinds → feed → remaining screens. Detail at the top of `HANDOFF.md`.
