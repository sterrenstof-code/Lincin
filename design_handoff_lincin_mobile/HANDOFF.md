# Lincin — development handoff (single file)

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

### Colour — dark (“donker”)
- Paper **#1A1917** · Paper 2 **#232220** · Ink **#EDE8DD** · Dim rgba(237,232,221,.62) · Rule rgba(237,232,221,.20)
- Acid #D9F04A · Red #E4553F
- Friend colours (ink on all = #1A1917): orange #D9764A, blue #5F7FE6, ochre #C9A94F, green #5E9C72, red #CF5442, acid #D2E85A

### Page tint
The screen background is `color-mix(in oklch, <friendColour> 42%, paper)` (dark: 18%) for the friend currently in view (feed), the chat partner (thread), the post’s author (post/profile) or the chosen swatch (compose). Transition `background .7s ease`.

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

**Header** (all screens except thread/post/profile/settings/notifications/compose which use their own top row): 18px padding, mono 11px uppercase. Left “Lincin” (600). Right: counter (feed: `01 / 05` current friend / friends), **◉ notifications** 32×32 outlined (red 9px square badge when unread), **+ new post** 32×32 filled ink.

**Footer tabs**: box `border 1.5px ink`, margin `10px 18px 34px`, four equal cells 60px high, glyph (mono 16px) above label (Archivo 700 10px uppercase, .1em). Active cell = ink background / paper text. Cells: ◫ Feed · ◌ Gesprekken (red 7px dot when unread) · ◷ Events · ◍ Jij. Thread → Gesprekken active; post/profile → Feed; settings/notifications → Jij.

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
- `screenshots/01–11-*.png` — one capture per screen (light mode, as shown in the user's preview).
- Fonts: Archivo, Instrument Serif, IBM Plex Mono (Google Fonts).
- Images are placeholders (`<image-slot>`) — real photos/covers come from the backend.
- Glyphs used as icons: ◉ + ◫ ◌ ◷ ◍ ☺ ↑ ↩ ▶ ❚❚ × ✓ →. Replace with the app's icon set if preferred, same sizes.

## Files
- `LincinApp.dc.html` — the entire app (template + logic + dictionaries). Props: `start` (screen), `stand` (licht|donker).
- `Lincin Final.dc.html` — handoff board: 11 phones, light/dark switch.
- `ios-frame.jsx`, `image-slot.js`, `support.js` — prototype runtime helpers (not to be ported).
- `Lincin v2.dc.html` — exploration history (rounds 1–7), reference only.

