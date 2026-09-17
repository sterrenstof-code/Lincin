# Lincin — development handoff (single file)

**Version 2.1 · 17 September 2026 · Kleur = default theme, dark = default mode.** New since 2.0: dark default, verloop gradient, band ticker, Rubrieken tab bar, comment reactions, lightbox, poll composer — see the table below.

## Prompt for Claude Code / the dev team

> Read this file top to bottom. Then open `LincinApp.dc.html` (the complete interactive prototype: template + logic + NL/EN/DE dictionaries) and `Lincin Final.dc.html` (board with all 11 screens × 3 themes) and `Lincin Desktop Opties.dc.html` (desktop + mobile references for the Magazine and Modern themes).
>
> Implement this in our Expo / React Native app (`comm-app`, Supabase backend), in this order:
> 1. **Tokens** — replace `lib/design/theme.ts` and `type.ts` with the token sets below (light, dark, and the three themes). Load Archivo (variable), Instrument Serif and IBM Plex Mono via `expo-font`.
> 2. **ThemeProvider** — a `theme` value `'kleur' | 'magazine' | 'modern'` stored on the user profile (Supabase column `profiles.theme`, default `kleur`), cached locally, exposed via context. Switching must not require a reload.
> 3. **Post card + media kinds** (foto, krabbel, plek, spraak, tekst, poll, muziek) as documented — this component is shared by all themes.
> 4. **Feed screen** — `FeedScreen` renders `FeedKleur`, `FeedMagazine` or `FeedModern` depending on theme. All three consume the same `posts` / `friends` query. Behaviour (read state, per-friend vs by-time, end card, pull-to-refresh) is described per theme below.
> 5. **Post page, friend profile, chats, thread (with mentions strip, quick reactions, replies, emoji/GIF bar), events (incl. draft event from a post), profile, settings (Theme · Language · light/dark), notifications, compose, empty state.**
> 6. Compare every screen against `screenshots/` and the prototype at 402 × 874. Fidelity is high — colours, type, spacing, copy are final.
>
> Ask before inventing anything the prototype does not show. Do not port the HTML runtime files (`support.js`, `ios-frame.jsx`, `image-slot.js`).

---

## Version 2.1 — what is NEW, what is UNCHANGED

Handoff of **17 September 2026**. Everything is marked so you can see at a glance what changed since the 2.0 package.

### NEW in 2.1 (build these)
| # | Change | Where in this doc | Impact |
|---|---|---|---|
| 1 | **Light/dark follows the device** (`prefers-color-scheme`) as the default; the user can override to Licht or Donker in Settings, which then persists. Dark = "nachtpapier" (ink-black paper, 18 % friend tint). | Colour — dark | Theme provider |
| 2 | **"Verloop" page tint** — background is a vertical gradient: current friend's tint on top, the **next** friend's tint at the bottom (other screens fade to paper). | Page tint | Feed + tinted screens |
| 3 | **Band ticker** — a friend band with unread posts replaces the red "2 nieuw" chip and the count column with a scrolling mono line of what is new. Read bands stay static. | Global chrome › Motion | Feed band component |
| 4 | **New footer tabs, model "Rubrieken"** — 4-column grid, numbered 01–04, name under the number, active cell filled in the friend colour of the moment. Replaces the icon-above-label tab bar. | Footer tabs | Tab bar (rewrite) |
| 5 | **Reactions on comments** — every comment gets reaction chips + a ☺ picker (6 emoji). Before, reactions existed only on the post itself. | Comment reactions | Post page comments |
| 6 | **Lightbox** — tapping a photo opens it full-screen, always full width, height from the image's real pixel ratio, so landscape and portrait both display correctly. Meta + px-size + orientation shown. | Lightbox | New component |
| 7 | **Poll composer** — kind `poll` in Nieuwe bijdrage now opens a real choice editor (2–4 numbered options, add/remove, one-vote ↔ multiple-choice toggle). The question is the post title. | Poll composer | Compose screen |
| 8 | **Several photos per post** — a post can carry up to 6 images. Card and post page show a scroll-snap **carousel** (edge-to-edge, `scroll-snap-type:x mandatory`, one image per frame) with a counter chip `01 / 03` top-right and dash indicators bottom-centre (active 16px, rest 6px). Compose lets you drop several photos: a slot carousel with `+ foto erbij` / `−`, up to 6. | Photo carousel | Card, post, compose |
| 9 | **Screenshots for all three themes × light/dark** (66 PNG, 402 × 874) plus 6 contact sheets. | Assets | Reference only |

### Removed since 2.0
- The **"breathing" tint overlay** that pulsed while scrolling — tried, judged too busy, taken out. Do not build it.
- The **acid marker bar** on the active tab (superseded by item 4).
- The old icon-glyph tab bar (◫ ◌ ◷ ◍ above the label).

### UNCHANGED since 2.0 (already specified, still valid)
Screen inventory (11 screens) · navigation and routing · post card "7h" and all seven media kinds · feed grouping (per friend / by time), read state, pull-to-refresh, end card · post page, friend profile, chats, thread (mentions strip, quick reactions, replies, emoji/GIF bar) · events incl. draft event from a post · profile, settings, notifications, empty state · private-message sheet · typography, shape, spacing, hit targets · the Magazine and Modern themes · NL/EN/DE dictionaries · data model and session state.

**In short:** structure and features did not change. What changed is the Kleur skin (dark default, gradient, ticker), the tab bar, and three functional additions: comment reactions, lightbox, poll composer.

### Desktop — DECIDED: model 3c “Prikbord + lade”, posts and chats full width
`Lincin Desktop.dc.html` is rebuilt on model **3c** and is now interactive: 
- **Feed** — rail 196 px · feed · chat list 300 px. Full-width friend bands in the friend colour (name Archivo 900 condensed + a mono line of what is new), cards in an auto-fill grid (min 330 px) with a 34 px colour spine carrying `№` and `by · kind · time`, photo carousel inside the card, title + caption + reactions + comment count below.
- **Click a card → the post page, full width**: the rail collapses to 64 px, the chat list disappears, the carousel runs edge to edge with ‹ › and dash indicators, and the bottom band holds title/caption/body + reaction chips + ☺ picker on the left and a 420 px **comment column** on the right where you can actually write comments (Enter or ↑) and react per comment. `← Feed` or × returns.
- **A conversation is also full width**: Gesprekken = list 280 px + thread over the rest, mentions strip on top, working input, bubbles max 620 px.
- Profile, Events, Jij (settings incl. language + light/dark/device) and Nieuwe bijdrage (multi-photo carousel up to 6, poll editor) are in the same file. Light/dark follows the device by default; the rail toggle cycles device → licht → donker.
- The previous desktop is kept as `Lincin Desktop v1.dc.html` for reference.

### Earlier open question (resolved above)
**Desktop navigation.** The current 3-column desktop puts feed, post, profile and chat in one right-hand panel, which makes it unclear where you are. Three replacement models are drawn in `Lincin Desktop Opties.dc.html`, section 3 (1280 × 800):
- **3a Index + lezer** — numbered index of all posts (column 2) + one large reader (column 3); active index row filled in the friend colour; chats are their own screen. Keyboard ↑↓/⏎.
- **3b Diavoorstelling** — one post fills the screen; ← → moves through that friend's posts, ↑ ↓ switches friend; colour rail of friends on the left, per-friend progress bar on top; comments in a right column.
- **3c Prikbord + lade** — closest to today: full-width friend bands in colour, cards with a colour spine + big number, and a post opens in a wide **drawer under the feed** instead of the right panel; the right panel then only ever shows chats.

- **3d Volle breedte · bijdrage** and **3e Volle breedte · gesprek** — applies to all three models: a post and a conversation can each take the WHOLE window, never all panes at once. Opening a post collapses the nav rail to 64 px and hides the index/chat panel (⤢ or double-click opens, Esc or × closes); the photo carousel then runs edge to edge with ‹ › and dash indicators, title + reactions bottom-left and a 420 px comment column bottom-right. Gesprekken is its own screen: list 280 px left, thread filling the rest with the mentions strip on top; bubbles stay readable through a 620 px max line width, not a narrow column.

**Chosen: 3c**, with 3d/3e (full-width post and conversation) included — built out in `Lincin Desktop.dc.html`.

---

## Themes

| theme | look | reference |
|---|---|---|
| `kleur` (default) | Playful poster look: paper, ink lines, friend colours, sticky friend bands, 7h cards | all sections below; screenshots/ |
| `magazine` | Paper, giant Archivo masthead in the hero post's friend colour over today's hero image, serif table of contents | `Lincin Desktop Opties.dc.html` #1b (desktop) · #2a (mobile) · `LincinApp.dc.html` block `FEED · MAGAZINE` |
| `modern` | Warm dark radial gradient (#8A3A1E → #3A1A10 → #1A1210) with 3px grain overlay at 18%, image-first 2-col mosaic per friend, glass chat bar | #1c (desktop) · #2b (mobile) · block `FEED · MODERN` |

The theme changes the **whole app**, not just the feed. Two layers:
1. **Token set** (applied at the app root, every screen): paper/ink/dim/rule/accent colours, border width + colour, headline typeface, radius, band style, active-tab style.
   - `kleur`: paper #F2EFE8, ink #141414, borders 1.5px ink, headlines Archivo 900 condensed uppercase, radius 0, friend bands filled with friend colour, active tab = ink fill, page tints with the friend in view.
   - `magazine`: paper #F7F4EE, ink #141414, hairlines 1px ink, headlines Instrument Serif regular (no uppercase), radius 0, friend bands paper with colour bar, active tab underlined, no page tint, accent #F06A2B.
   - `modern`: radial gradient background (#8A3A1E → #3A1A10 → #1A1210) + 3px grain at 18% on every screen, ink #F2EFE8, borders 1px rgba(242,239,232,.18), headlines Instrument Serif, radius 10px on cards/tabs, accent #FF8A65, glass surfaces rgba(242,239,232,.08) + blur.
   - Card title strip: `kleur` = filled with friend colour; `magazine`/`modern` = paper with 6px friend-colour left bar, serif 24px.
2. **Feed layout** (home only): `FeedKleur` (sticky bands + 7h cards), `FeedMagazine` (masthead hero + TOC), `FeedModern` (mosaic per friend + glass chat bar). All other screens share one layout and pick up the token set.

### Magazine feed (mobile)
- Hero = newest post. 520px image (or friend-colour block for non-image kinds), dark gradient 25 % top / 15 % bottom.
- Top line mono 9px: "Editie wo 16 sep · № 38" | "4 nieuw". Masthead "LINCIN" Archivo 900 wdth 62 132px, colour = hero friend colour, overlapping the image top-left.
- Left block (max 220px, `mix-blend-mode: difference` white): title Archivo 900 26px uppercase, caption serif italic 15px, then body serif 14px at y≈330.
- Right block "Op *spotlight*" serif 24px + 4 mono lines (by · kind) → each opens that post.
- Bottom row: reaction chips (1.5px border, nowrap) + COMMENT · n + PRIVAAT.
- Below: sticky "In deze *editie*" bar (serif 24px, 1.5px rule) then TOC rows: 6px colour bar, mono byline, serif 19px title, № right, "Privaat" underlined. End line mono.
- Tabs remain the standard footer.

### Modern feed (mobile)
- Root background = the radial gradient + grain. Ink is paper-white.
- Sub-header mono 10px: "Per vriend | Op tijd" (inactive 50 % opacity) … "4 nieuw · 6 lincs".
- Per friend: sticky mono label with 8px colour dot, name, count, "n nieuw" in #FF8A65; then a 2-column grid, rows 150px, gap 5px; first tile spans 2 columns unless the friend has exactly 2 posts. Tiles: image kinds on rgba(0,0,0,.2); text/poll/plek/spraak on rgba(242,239,232,.08) + blur(10px); muziek on #7A1E1E. Colour dot top-left; title + ✉ (private) bottom, text-shadow.
- Glass chat bar under the feed (rgba(242,239,232,.08), blur 18, 1px border 18 %) with the latest unread thread → opens Gesprekken.

---

# Kleur theme (default) — full spec

## Overview
Lincin is a friend-first social app: no algorithm, no strangers. The feed shows **only what your friends make**, grouped per friend under sticky colour bands. Every contribution (“bijdrage”) is an editorial poster card. Around it: private chats (with post mentions, replies, emoji/GIF), events (incl. events created from a post), a profile, settings (language NL/EN/DE, light/dark) and notifications.

Target codebase: the existing Expo / React Native app in `comm-app` (Supabase backend). Recreate these screens with the existing routing (`app/(app)/…`), replacing the v4 design system tokens (`lib/design/theme.ts`, `type.ts`) with the tokens below.

## About the design files
The bundled files are **design references written in HTML** (interactive prototypes). They are not production code. Recreate the look and behaviour in the Expo/RN codebase using its established patterns. `LincinApp.dc.html` is the single source of truth for all screens; `Lincin Final.dc.html` only frames it eleven times, each started on a different screen.

## Fidelity
**High-fidelity.** Colours, type, spacing, states and copy are final. Recreate pixel-accurately at 402 × 874 (iPhone 15/16 class); layouts are fluid in width.

---

## Design tokens

### Colour — light (“licht”)
- Paper `--p` **#F2EFE8** · Paper 2 `--p2` **#E7E3D8** (secondary surfaces, media backgrounds)
- Ink `--i` **#141414** · Dim `--dim` rgba(20,20,20,.58) · Rule `--rule` rgba(20,20,20,.20)
- Accent acid `--acid` **#E5FF3A** (call-to-action cards, active tab in sheets) · Red `--red` **#D8321F** (unread/new)
- Friend colours (each friend/group owns one): orange **#F06A2B** (ink on it #141414), blue **#2F5BFF** (ink #F2EFE8), ochre **#E0B64A** (#141414), green **#4C9A63** (#F2EFE8), red **#D8321F** (#F2EFE8), acid **#E5FF3A** (#141414)

### Colour — dark (“donker” / “nachtpapier”) — NEW in 2.1
Mode follows the **device** by default (`prefers-color-scheme`, live-updating); an explicit Licht/Donker choice in Settings overrides and persists. Dark = ink-black paper with 18 % friend tint, bands in full friend colour, cards dark with paper-coloured 1.5px lines.
- Paper **#1A1917** · Paper 2 **#232220** · Ink **#EDE8DD** · Dim rgba(237,232,221,.62) · Rule rgba(237,232,221,.20)
- Acid #D9F04A · Red #E4553F
- Friend colours (ink on all = #1A1917): orange #D9764A, blue #5F7FE6, ochre #C9A94F, green #5E9C72, red #CF5442, acid #D2E85A

### Page tint — “verloop” — NEW in 2.1
The screen background is a vertical gradient, not a flat fill. Feed (per friend): current friend tint 0–38 %, then blends to the **next** friend’s tint at 100 % — the page anticipates who comes next. Other tinted screens (thread, post, profile, compose): tint 0–30 %, blending to plain paper at 100 %. Tint = `color-mix(in oklch, <friendColour> 42%, paper)` (dark: 18%) for the friend currently in view (feed), the chat partner (thread), the post’s author (post/profile) or the chosen swatch (compose). Transition `background .7s ease`.

### Typography (Google Fonts)
- **Archivo** variable (wdth 62–125, wght 500–900). Headlines: weight 900, `font-stretch: 75%`, uppercase, line-height .9–1, letter-spacing −.01em. Body 15px/1.35 regular.
- **Instrument Serif** (regular + italic): captions, page titles, sheet quotes.
- **IBM Plex Mono** 400/500/600: meta, labels, buttons (uppercase, letter-spacing .04–.1em).

Scale: mono meta 9–11px · body 13–15px · serif caption 15–17px (cards) / 20px (post) · serif page title 30px · Archivo card title 22px · post title 32px · band name 22px · profile name 44px · empty-state title 40px.

### Shape
- Borders **1.5px solid ink** everywhere. **No border-radius** (except circular avatars & play buttons). **No shadows.**
- Screen side padding 18px. Card/list gaps 12px. Hit targets ≥ 44px (inputs/buttons 44px; secondary chips 28–34px).

### Motion
- `rise` 0.25–0.45s cubic-bezier(.2,.7,.2,1): fade + translateY(24px) for sheets, menus, expanded content.
- `heroIn` 0.45s same easing: scale(.94) translateY(18px) → identity, on post page media.
- `sheet` 0.35s: translateY(100%) → 0 for the private-message sheet.
- Reveal-on-scroll (`[data-reveal]`): opacity 0 / translateY(18px) → visible, 0.6s.
- Band read-state: background/color .5s; poll bars width .4s; toggles .2s.

---

## Global chrome

**Motion (Kleur only)** — NEW in 2.1
- **Ticker**: in a friend band that has unread posts, the red “2 nieuw” chip and the count/time column are replaced by a scrolling mono line (600 9px uppercase, .1em, edge-faded 10 % mask): `2 NIEUW · FOTO 22:41 · PLEK 22:58 ·` repeated, translateX 0 → −50 % linear, duration = max(7 s, 0.28 s × chars). Read bands are static. Pause when reduce-motion is on.

**Header** (all screens except thread/post/profile/settings/notifications/compose which use their own top row): 18px padding, mono 11px uppercase. Left “Lincin” (600). Right: counter (feed: `01 / 05` current friend / friends), **◉ notifications** 32×32 outlined (red 9px square badge when unread), **+ new post** 32×32 filled ink.

**Footer tabs — “Rubrieken”** — NEW in 2.1 (replaces the 2.0 icon tab bar): box `border 1.5px ink`, margin `10px 18px 34px`, 4-column grid (`minmax(0,1fr)`), cells 56px high, padding 0 10px, 1px `rule` dividers between cells, paper background. Each cell is left-aligned, two lines: number (mono 500 9px: `01 02 03 04`, red 6px square after `02` when unread) above the name (Archivo 900 uppercase 13px, stretch 75 %; 62 % for names longer than 8 chars so “Gesprekken” never truncates). Active cell = filled in the **friend colour of the moment** (feed: friend in view; thread: chat partner; post/profile: author) with that colour’s ink; when no friend is in view (chats list, events, jij, settings…) active = ink fill / paper text. Inactive = dim ink. Order: 01 Feed · 02 Gesprekken · 03 Events · 04 Jij. Thread → 02 active; post/profile → 01; settings/notifications → 04.

---

## Screens

### 01 Feed (`schrift`)
- Title row: serif 30px “Wat je vrienden *maken*” + segmented control **Per vriend | Op tijd** (mono 10px uppercase, active = ink fill).
- Pull-to-refresh: a 56px zone above content (“↓ trek om te vernieuwen” → “Vernieuwen…” for 1.1s). Scroll starts at 56px.
- **Per vriend**: one group per friend (and per **group**, e.g. “Kamp '26”, green, square avatar, chip `GROEP`). Sticky band 56px: top border 3px friend colour, bottom 1.5px ink; avatar 30px circle (paper fill / ink text), name Archivo 900 22px uppercase underlined (→ profile; group → group chat), red chip `n NIEUW`, right: `n bijdragen / last time` mono 10px, `+` 30px box toggles collapse (rotates 45°).
  - **Read state**: once the user scrolls past a band or opens one of its posts, band becomes paper with ink text, avatar takes the friend colour, chip replaced by `GELEZEN`.
  - Under the band: horizontal snap row, padding 14px 18px 16px, gap 12px, cards 340px wide; last item “Zeg iets tegen {naam} →” dashed 120px card → private sheet.
- **Op tijd**: groups “Vanochtend (07:00 – nu)” / “Vannacht (gisteren 22:00 – 00:00)” under a sticky ink band 44px; cards full width, gap 12px, sorted newest first.
- Page tints with the friend whose band is at the top.
- **End card** (no infinite scroll): mono line “— einde · geen algoritme, geen oneindig scrollen —”, then acid card “Niemand maakte iets nieuws. Jij wel?” / serif italic “Je vrienden zien het als eerste.” + 44px ink `+` → compose.

#### Post card (final variant “7h”)
Box 1.5px ink, paper. Layout: `[main column | 40px meta column]` + action bar.
- Media 150px (see media kinds).
- Title strip: friend colour bg, ink-on-colour, padding 10px 12px, Archivo 900 22px uppercase, max 3 lines (66px, clamp).
- Caption: serif 15px/1.25, dim, max 3 lines (56px), padding 10px 12px.
- Meta column (paper 2 bg, left border): avatar 26px circle in friend colour (→ profile) top; rotated mono 10px uppercase “NAAM · SOORT · TIJD” bottom.
- Action bar 42px, top border: reactions (emoji + count, no border, 28px, active = ink fill/paper text) | `COMMENT · n` | `PRIVAAT BERICHT` (ink fill). Whole card tap → post page.

#### Media kinds (150px in card, 300px on post page with 34px colour strip on the left showing “SOORT · TIJD” rotated)
- **foto / krabbel**: image.
- **plek**: paper-2 map grid (28px lines), dashed route, pin (colour label with place name, stem, 10px dot), coordinates bottom-left mono.
- **spraak**: 44px round play button (▶/❚❚ toggles), 28 waveform bars (heights deterministic per post), duration mono.
- **tekst**: the text itself in serif 19px/1.25 on paper 2.
- **poll**: options as 36px outlined bars; fill width = share; tap to vote (own vote fills with friend colour, ✓); note “n stemmen · tik om te stemmen”.
- **muziek**: square cover left, right: track (Archivo 900 18px), artist (serif italic 14px), play button + progress hairline + duration.

### 02 Post (`post`)
- Top row: `← Terug` outlined chip · “BIJDRAGE № 01” mono dim.
- Card: media 300px (heroIn animation), then title Archivo 32px, caption serif 20px, body 13.5px dim, author row (avatar 28px + underlined name + “· bekijk profiel” → profile).
- Action row: reactions 34px (no border), extra reactions the user added (ink fill), spacer, small dashed `◷ EVENT` (only when caption contains “?” or kind = plek) → creates draft event, `PRIVAAT BERICHT` ink fill → private sheet.
- “COMMENTS · n” list: 26px avatar, name mono 600 12px, time mono dim, text 14px; GIF comments show 160×110 image with `GIF` tag.
- **Bottom bar** (fixed, top border): `☺` 44px outlined (toggles reaction box) + input 44px + `↑` 44px ink — one continuous 44px row, no gaps. Enter or ↑ posts the comment as “Jij”.
- **Reaction box** (above the bar when open, `rise`): tabs Emoji | GIF | Sticker (disabled) | ×; Emoji = 6-col grid 48px cells 24px glyphs (tap toggles reaction chip, active cell acid); GIF = search field + 3-col grid 80px cells (tap posts a GIF comment).

### 03 Friend profile (`vriend`)
`← Terug`; hero card in friend colour: 56px avatar, “linc sinds mrt '24 / n bijdragen”, name Archivo 44px, bio serif italic 17px, buttons `PRIVÉGESPREK →` (ink) + `SAMEN PLANNEN` (outlined). Then “ALLES VAN {NAAM}” and full-width 7h cards.

### 04 Chats (`chats`)
Title serif 30px “Gesprekken” + “2 ongelezen”. List box: rows 72px: 56px colour cell with initial (Archivo 900 26px) | name serif 20px + time (red if unread) | preview 13px dim ellipsis | unread count red badge 22px. Groups have their own colour (Kamp '26 green).

### 05 Thread (`thread`)
- Top bar 48px box: `← Terug` | name serif 20px | 48px colour cell with initial.
- **Mentioned strip** (when any message quotes a post): paper-2 box, rotated “VERMELD” label, 96×56 mini posters (colour, “№ · soort”, title) → post page.
- Messages: bubbles max 78%, 1.5px ink border, 15px/1.35; own = ink fill/paper text right, theirs = paper left; time mono 10px dim under. Quote line “over «…»” (serif italic, colour left border) above a message → post. Reply line “↩ …” above replies. Emoji-only messages render 34px. GIF messages 180×120 with tag.
- **Tap a bubble** → border turns friend colour and a quick menu appears above it: 5 emoji (38px cells) + `↩ ANTWOORD` (ink). Emoji → 22px chip under the bubble (toggle). Antwoord → reply preview bar above the input (colour left border, ×).
- Typing indicator “{naam} schrijft…” serif italic for 2s after sending.
- **Bottom bar**: `☺` 44px + input + `↑`, identical to the post page. ☺ opens the same Emoji/GIF/Sticker box; emoji append to the draft, GIF sends immediately.

### 06 Events (`events`)
Title “Wat er *komt*” + “n gepland / 1 wacht op jou”. Cards min 150px: 84px colour date cell (day Archivo 44px, month mono) | by + time mono, title serif 24px, place · who 12.5px dim, buttons `IK KOM` / `MISSCHIEN` (toggle → ink fill). Draft events created from a post appear first with acid chip `CONCEPT · UIT № 01`, day “zo”, time “nog te kiezen”. Dashed “Plan iets nieuws →” at the end.

### 07 You (`jij`)
Name serif 44px two lines (surname italic dim) + 72px orange avatar; stats box 3 cells (Archivo 900 28px + mono label): 23 bijdragen · 6 lincs · '24 sinds mrt; “JOUW LAATSTE BIJDRAGEN” horizontal 150×190 mini cards (44px rotated colour strip + image); list box: Instellingen →, Meldingen (red “3 nieuw →”), Lincs & uitnodigingen (6 →), Mijn QR-code →.

### 08 Settings (`instellingen`)
`← Jij` + title serif 32px. Groups (mono label + box, rows 12px padding, hairline dividers):
- **Hoe het eruitziet**: **Taal** — segmented `NL | EN | DE` (persists; translates all UI strings, dictionary in `dict()` of LincinApp.dc.html; user content stays in original language) · Licht of donker (value) · Blad kleurt mee (toggle 44×24, knob 16px).
- **Meldingen**: Nieuwe bijdragen (on) · Stil tussen 23:00 en 08:00.
- **Wie ziet wat**: Lincs zien mijn bijdragen (on) · Mijn lincs 6 →.
Footer mono dim “Lincin 2.0 · versleuteld op je toestel”.

### 09 Notifications (`meldingen`)
`← Terug` + title. List box rows: 10px colour bar | bold name + text 14px | time mono dim. Unread rows have a faint ink tint; tap marks read (header badge clears after 3).

### 10 Compose (`compose`)
`× Annuleer` · “NIEUWE BIJDRAGE · № 24”. Poster preview 300px: 36% colour panel with rotated kind label + № | image slot. Inputs: Title (Archivo 900 26px uppercase, underline only), caption (serif 19px). **Kleur**: 6 swatches in one box (active = 10px ink square). **Soort** chips: foto, krabbel, tekst, spraak, poll, link, plek, muziek. Bottom: `KLAD` outlined + `DEEL MET JE VRIENDEN` ink (→ “GEDEELD ✓” green for 1.2s, then back to feed).

### 11 Empty state (`leeg`)
Acid card: “NOG NIEMAND HIER”, title Archivo 40px “Je feed is zo leeg als een nieuw schetsboek”, serif body, buttons `SCAN EEN QR-CODE` (ink fill, acid text) + `DEEL MIJN CODE` (outlined). Dashed “Of maak alvast je eerste bijdrage →”.

### Private-message sheet (from any card / post / band)
Dim overlay rgba(20,20,20,.35); bottom sheet paper, top border, padding 16px 18px 44px, `sheet` animation. Label “PRIVÉGESPREK MET {NAAM}”, toggle chip `VERMELD ✓` / `BIJDRAGE VERMELDEN` (include quote), quoted caption serif 17px with 3px ink left border, input 44px + ↑. Sending opens the thread with the message (quote attached when “Vermeld”).

---

**Comment reactions** (post page) — NEW in 2.1: every comment has a row of reaction chips (24px, 1.5px ink border, emoji 12px + mono count; mine = acid fill) plus a dashed ☺ button. Tap ☺ → 6-emoji picker (❤️ 😂 🔥 😮 👏 🥹, 32px cells) in a bordered box under the comment; picking toggles my reaction and closes the picker. State `cReacts{postNo:idx → {emoji: bool}}`.

**Lightbox** — NEW in 2.1: tapping any photo/scribble media (feed card, post hero) opens a full-screen lightbox — 92 %-opaque ink ground, mono meta line top (`№ 01 · Noor · foto · 22:41`) with a bordered ×, the image centred in a 1.5px-framed box whose `aspect-ratio` is the image's REAL pixel ratio (read from the loaded image; falls back to 3:2 for photos, 3:4 for scribbles, 1:1 for covers). The frame is ALWAYS full width (edge to edge, no side gaps, no border); its height comes from the image's own ratio, so landscape stays short and portrait tall. The centre area scrolls vertically when a very tall image exceeds the viewport; the image is `object-fit:cover` inside its exact-ratio frame, so it never letterboxes. **With several photos** the lightbox becomes a slideshow: ‹ › buttons over the image (40px, 1.5px paper border on a 50 %-dark ground), counter `01 / 03` in the top bar, a 52px thumbnail filmstrip under the caption (active = full-opacity paper border), ←/→ keys, and it opens on the image you tapped. Footer: title (serif 24px) + `3024 × 4032 px · staand|liggend|vierkant`. Close = tap the ground or Esc.

**Poll composer** — NEW in 2.1: in Nieuwe bijdrage, picking kind `poll` swaps the media box for a choice editor — 2 to 4 numbered rows (01–04) with text inputs, × to remove (only above 2), a dashed “+ Keuze erbij” row, and a footer toggle `één stem per linc` ↔ `meerdere keuzes`. The question itself is the post title. Other kinds keep the image slot.

## State (per app session)
`screen, prev, view(friends|time), feedIdx, openFriends{}, seen{friend→bool}, post, vriend, chat, sent{chat→msg[]}, draft, replyTo, activeMsg, msgReacts{}, comments{postNo→[]}, extra{postNo→emoji→bool}, reacts{}, votes{postNo→idx}, playing{postNo}, rsvp{}, draftEvent, toggles{}, lang(nl|en|de, persisted), stand(licht|donker), reactBoxOpen, chatBoxOpen, reactTab, gifQuery, readNotes{}, compose fields`.

Data: posts (no, by, group?, when, kind, title, caption, body, kind-specific fields, reacts, baseComments), friends (name → colour, bio), groups (name → colour, members), chats, events. See the arrays in `LincinApp.dc.html` for seed content.

## i18n
Complete NL/EN/DE dictionaries live in `dict()` inside `LincinApp.dc.html` (≈90 keys). Selection stored in `lincin-lang`. Only UI strings translate; friend content does not.

## Themes (user setting)
Profile › Settings › **Thema**: `kleur` (default, this README) · `magazine` · `modern`. Stored per user (Supabase profile column `theme`), applied at app root via a ThemeProvider — no reload needed. Only the **Feed/home** layout and the token set differ; chats, events, settings and the post model are shared.
- **kleur** — the playful poster look documented above.
- **magazine** — paper, serif masthead over today's hero post, table-of-contents list. Reference: `Lincin Desktop Opties.dc.html` #1b (desktop) and #2a (mobile).
- **modern** — warm dark gradient with grain, image-first mosaic grid, glass chat panel. Reference: #1c (desktop) and #2b (mobile).
Implementation hint: `FeedScreen` switches on `theme` between `FeedKleur`, `FeedMagazine`, `FeedModern`; each consumes the same `posts`/`friends` query.

## Assets
- `screenshots/<thema>-<licht|donker>/01–11-*.png` — NEW in 2.1: all 11 screens for every theme × mode (66 PNG, 402 × 874, iPhone frame included), plus `screenshots/contactbladen/*.png` (all 11 screens of one theme on one sheet, 1680 × 2670).
- Fonts: Archivo, Instrument Serif, IBM Plex Mono (Google Fonts).
- Images are placeholders (`<image-slot>`) — real photos/covers come from the backend.
- Glyphs used as icons: ◉ + ◫ ◌ ◷ ◍ ☺ ↑ ↩ ▶ ❚❚ × ✓ →. Replace with the app's icon set if preferred, same sizes.

## Files
- `LincinApp.dc.html` — the entire app (template + logic + dictionaries). Props: `start` (screen), `stand` (licht|donker).
- `Lincin Final.dc.html` — handoff board: 11 phones, light/dark switch (dark = default).
- `Lincin Kleur Verdieping.dc.html` — Kleur exploration rounds 4–7; round 8 (the final skin) = 7a verloop + 7i ticker + 7l nachtpapier, applied in `LincinApp.dc.html`.
- `ios-frame.jsx`, `image-slot.js`, `support.js` — prototype runtime helpers (not to be ported).
- `Lincin v2.dc.html` — exploration history (rounds 1–7), reference only.

