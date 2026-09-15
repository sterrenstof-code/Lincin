# Delen naar Lincin

Doel: vanuit Safari, YouTube, Spotify of een e-reader op "Deel" tikken en Lincin in de lijst
zien staan. Eén tik moet genoeg zijn — een curatie-app die om een formulier vraagt wordt niet
gebruikt.

Er zijn twee helften. **De web-helft is klaar en werkt.** De native helft vraagt één
`npm install` en een nieuwe build, en staat hieronder uitgeschreven.

---

## 1. Web (PWA) — KLAAR

Werkt in Chrome/Edge op Android en in geïnstalleerde PWA's op desktop. iOS Safari ondersteunt
Web Share Target (nog) niet — daarvoor is de native helft nodig.

**Wat er staat:**

- `comm-app/public/manifest.json` — bevat het `share_target`-blok:
  ```json
  "share_target": {
    "action": "/post-compose",
    "method": "GET",
    "params": { "title": "title", "text": "text", "url": "url" }
  }
  ```
  `method: "GET"` is bewust: een POST-share-target vereist een service worker die het
  formulier onderschept. Met GET komt alles als querystring binnen en is er niets extra nodig.

- `comm-app/app/+html.tsx` — linkt de manifest expliciet.
  Let op: Expo genereert **zelf geen** `manifest.json` (gecontroleerd in de web-export — er
  stond er geen in `dist/`). De web-PWA had dus tot nu toe helemaal geen manifest en leunde
  volledig op de Apple-meta-tags. Nu wel.

- `comm-app/app/post-compose.tsx` — leest `title` / `text` / `url` uit
  `useLocalSearchParams` en vult het formulier in. Omdat de praktijk rommelig is (Android zet
  de URL vaak in `text`, iOS stuurt tekst mét URL erin) vist hij de URL eruit en houdt de rest
  over als toelichting. Lange tekst zonder URL wordt automatisch een **fragment**.

**Testen na deploy:** installeer lincin.vercel.app als app op een Android-toestel, deel dan een
YouTube-link vanuit de YouTube-app. Lincin hoort in het deelmenu te staan en de composer moet
de video al ingevuld tonen.

---

## 2. Native (iOS + Android) — NOG TE DOEN

Dit vereist een native share-extensie. Die kan niet vanuit deze sessie worden geïnstalleerd
(geen netwerktoegang tot npm), dus hieronder staat het recept in plaats van de code.
**Ongetest** — behandel het als een startpunt, niet als een garantie.

### Stap 1 — installeren

```bash
cd comm-app
npx expo install expo-share-intent
```

Controleer eerst even of de versie SDK 54 ondersteunt (`npm view expo-share-intent peerDependencies`).

### Stap 2 — plugin in `app.config.ts`

Toevoegen aan de `plugins`-array:

```js
[
  "expo-share-intent",
  {
    iosActivationRules: {
      NSExtensionActivationSupportsWebURLWithMaxCount: 1,
      NSExtensionActivationSupportsWebPageWithMaxCount: 1,
      NSExtensionActivationSupportsText: true,
    },
    androidIntentFilters: ["text/*"],
  },
],
```

### Stap 3 — opvangen in `app/_layout.tsx`

```tsx
import { useShareIntent } from "expo-share-intent";

// binnen RootLayout, naast de bestaande effects:
const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent();

useEffect(() => {
  if (!hasShareIntent) return;
  router.push({
    pathname: "/post-compose",
    params: {
      url: shareIntent.webUrl ?? "",
      text: shareIntent.text ?? "",
      title: shareIntent.meta?.title ?? "",
    },
  });
  resetShareIntent();
}, [hasShareIntent]);
```

De composer hoeft **niet** aangepast te worden: hij leest al exact deze drie parameters, of ze
nu van de PWA-querystring of van de native extensie komen. Dat was de reden om ze op één plek
uit te lezen.

### Stap 4 — bouwen

Een share-extensie is native code, dus Expo Go volstaat niet:

```bash
npx expo prebuild --clean
eas build --profile development --platform ios
```

### Waarom niet gewoon een Android intent-filter?

`android.intentFilters` in `app.config.ts` zou Lincin wél in het deelmenu zetten, maar de
gedeelde tekst komt binnen als `Intent.EXTRA_TEXT` en die bereikt JS niet zonder native code.
Resultaat: de app opent met een lege composer. Dat lijkt kapot, dus dat doen we niet half.

---

## 3. Waar dit op aansluit

De composer is opgezet rond één principe: **plakken moet genoeg zijn.** De share-target is
daar de logische verlenging van — in plaats van kopiëren, app wisselen en plakken, is het één
tik. Zie `lincin_feed_finds` in het projectgeheugen voor de rest van de vondsten-feature.
