import { existsSync } from "node:fs";

import { ExpoConfig, ConfigContext } from "expo/config";

/**
 * Firebase voor pushmeldingen op Android (Expo push loopt daar via FCM).
 * Lokaal `./google-services.json`; op EAS een omgevingsvariabele van het
 * type "file" met de naam GOOGLE_SERVICES_JSON. Ontbreekt hij, dan bouwt
 * de app nog steeds — alleen komen er op Android geen meldingen binnen.
 */
const googleServicesFile =
  process.env.GOOGLE_SERVICES_JSON ?? (existsSync("./google-services.json") ? "./google-services.json" : undefined);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Lincin",
  slug: "lincin",
  version: "0.1.0",
  /**
   * Geldt hier alleen nog voor Android: telefoons blijven staand.
   *
   * Voor iOS wordt hij genegeerd omdat `ios.infoPlist` de twee
   * oriëntatiesleutels expliciet zet — Expo meldt dat ook tijdens prebuild.
   * Zo blijft de iPhone staand én kan de iPad draaien, zonder plugin.
   */
  orientation: "portrait",
  icon: "./assets/images/icon.png",
  scheme: "lincin",
  // De app volgt het toestel; wie liever kiest, doet dat in de app zelf
  // (lib/design/theme.ts). Op Android werkt dit via expo-system-ui.
  userInterfaceStyle: "automatic",
  newArchEnabled: true,

  ios: {
    supportsTablet: true,
    bundleIdentifier: "io.beyondesign.lincin",
    /**
     * Privacy manifest. Apple wil van élke app horen waarom hij een paar
     * "required reason"-API's aanraakt; zonder verklaring komt er een
     * waarschuwing (ITMS-91053) of afwijzing bij het inleveren. Dit zijn
     * de vier die React Native en de Expo-modules zelf gebruiken — voor
     * AsyncStorage, bestandscache, tijdmeting en vrije ruimte — met de
     * redencodes die Apple daarvoor voorschrijft. De app verzamelt geen
     * trackinggegevens; vandaar de lege lijsten.
     */
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
          NSPrivacyAccessedAPITypeReasons: ["CA92.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp",
          NSPrivacyAccessedAPITypeReasons: ["C617.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategorySystemBootTime",
          NSPrivacyAccessedAPITypeReasons: ["35F9.1"],
        },
        {
          NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryDiskSpace",
          NSPrivacyAccessedAPITypeReasons: ["E174.1"],
        },
      ],
    },
    infoPlist: {
      UIBackgroundModes: ["remote-notification", "fetch"],
      NSCameraUsageDescription:
        "Lincin gebruikt je camera om foto's en video's te maken voor chats en events.",
      NSMicrophoneUsageDescription:
        "Lincin gebruikt je microfoon voor videogesprekken.",
      NSPhotoLibraryUsageDescription:
        "Lincin gebruikt je fotobibliotheek om afbeeldingen te delen in chats en posts.",
      /**
       * Draaien: de iPhone niet, de iPad wel.
       *
       * Eén `orientation` in de Expo-config geldt voor allebei, en dat is
       * te grof. Op een telefoon is liggend geen winst: de app is een
       * leesomgeving, en bij 852pt breed zou hij in de brede tweekolomsmodus
       * schieten op een scherm dat maar 393pt hoog is. Op een tablet is
       * liggend juist de stand waarin de opzet tot zijn recht komt — en een
       * tablet-app die niet meedraait als je hem omdraait voelt kapot.
       *
       * De `~ipad`-achtervoegsels zijn de manier waarop iOS dat onderscheid
       * zelf maakt, dus dit vraagt geen code en geen extra bibliotheek.
       */
      UISupportedInterfaceOrientations: ["UIInterfaceOrientationPortrait"],
      "UISupportedInterfaceOrientations~ipad": [
        "UIInterfaceOrientationPortrait",
        "UIInterfaceOrientationPortraitUpsideDown",
        "UIInterfaceOrientationLandscapeLeft",
        "UIInterfaceOrientationLandscapeRight",
      ],
      /**
       * Exportregels (VS, categorie 5 deel 2).
       *
       * `false` betekent: alleen vrijgestelde versleuteling (HTTPS, wat het
       * OS zelf doet). Dat klopt hier niet — de app versleutelt berichten
       * en bestanden zelf met XChaCha20-Poly1305 uit @stablelib, buiten
       * het OS om. Standaardalgoritmen, geen eigen vinding, dus het valt
       * onder de mass-market-vrijstelling 740.17(b)(1): geen CCATS nodig,
       * wel een jaarlijkse zelfclassificatie bij BIS.
       *
       * Eén keer in App Store Connect (App Encryption Documentation)
       * invullen: gebruikt standaardalgoritmen, geen eigen algoritmen,
       * mass market. Apple geeft dan een code terug; zet die hier als
       * `ITSEncryptionExportComplianceCode` zodat elke build hem meeneemt
       * en de vraag niet meer terugkomt.
       */
      ITSAppUsesNonExemptEncryption: true,
      UIViewControllerBasedStatusBarAppearance: false,
    },
  },

  android: {
    package: "io.beyondesign.lincin",
    ...(googleServicesFile ? { googleServicesFile } : {}),
    adaptiveIcon: {
      backgroundColor: "#0A0A0B",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    /**
     * Alleen wat de app zelf vraagt. Foto's kiezen loopt via de Android
     * Photo Picker (expo-image-picker), dus READ_MEDIA_IMAGES/VIDEO zijn
     * niet nodig — en Google Play eist een aparte verklaring zodra ze in
     * het manifest staan. Wat bibliotheken zelf nodig hebben (meldingen,
     * boot) voegen hun eigen manifesten toe.
     */
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.VIBRATE",
    ],
    /**
     * Wat bibliotheken meebrengen maar de app niet gebruikt. Play vraagt bij
     * elk ervan een verklaring, en wie de lijst leest ziet een app die meer
     * wil dan hij zegt:
     *   WRITE_CONTACTS          expo-contacts; we lezen alleen
     *   READ/WRITE_EXTERNAL_STORAGE  foto's lopen via de Photo Picker
     *   SYSTEM_ALERT_WINDOW     alleen nodig voor het dev-menu
     */
    blockedPermissions: [
      "android.permission.WRITE_CONTACTS",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
  },

  web: {
    output: "static",
    favicon: "./assets/images/favicon.png",
    name: "Lincin",
    shortName: "Lincin",
    description:
      "Privé chats, foto-events en feed voor je inner circle. End-to-end versleuteld.",
    themeColor: "#0A0A0B",
    backgroundColor: "#0A0A0B",
    display: "standalone",
    lang: "nl",
    orientation: "portrait",
  },

  plugins: [
    "expo-router",
    [
      // Een plek delen in een gesprek ("+ Bijlage → Plek"). Alleen tijdens
      // gebruik, en alleen als je het zelf aantikt.
      "expo-location",
      {
        locationWhenInUsePermission: "Lincin gebruikt je locatie alleen als je zelf een plek deelt in een gesprek.",
        // Nooit op de achtergrond: zonder deze twee zette de plugin Engelse
        // "Always"-teksten in Info.plist voor iets wat de app niet doet.
        locationAlwaysAndWhenInUsePermission: false,
        locationAlwaysPermission: false,
      },
    ],
    [
      // "Uit je contacten": alleen als je het zelf opent. De adressen gaan
      // als hash naar de server (0088), nooit leesbaar.
      "expo-contacts",
      {
        contactsPermission: "Lincin kijkt in je contacten wie er al op Lincin zit. Je adressen worden niet bewaard.",
      },
    ],
    [
      // De app-vergrendeling in Instellingen (Face ID / vingerafdruk).
      "expo-local-authentication",
      {
        faceIDPermission: "Lincin gebruikt Face ID om de app te ontgrendelen als je dat aanzet.",
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "Lincin gebruikt je fotobibliotheek om afbeeldingen te delen.",
        cameraPermission: "Lincin gebruikt je camera om foto's en video's te maken.",
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission: "Lincin gebruikt je camera om foto's te maken voor events.",
        microphonePermission: "Lincin gebruikt je microfoon voor videogesprekken.",
      },
    ],
    [
      "expo-notifications",
      {
        // Android tekent dit als wit silhouet in de statusbalk; een
        // gekleurd icoon wordt daar een wit vierkant. Vandaar de
        // monochrome variant, niet het app-icoon.
        icon: "./assets/images/android-icon-monochrome.png",
        color: "#0A0A0B",
        sounds: [],
      },
    ],
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#0A0A0B",
        dark: { backgroundColor: "#0A0A0B" },
      },
    ],
    [
      "expo-build-properties",
      {
        android: {
          // R8: ongebruikte klassen en resources uit de release-build.
          // Standaard staat dit uit in de Expo-template; het scheelt
          // doorgaans een derde van de AAB. Test een preview-build
          // vóór een store-inzending, want dit werkt alleen op release.
          enableMinifyInReleaseBuilds: true,
          enableShrinkResourcesInReleaseBuilds: true,
        },
      },
    ],
  ],

  updates: {
    url: "https://u.expo.dev/16c89c1a-3ad4-4b4a-b199-00bda2a5f3df",
    fallbackToCacheTimeout: 0,
  },

  runtimeVersion: {
    policy: "appVersion",
  },

  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },

  extra: {
    router: {},
    eas: {
      projectId: "16c89c1a-3ad4-4b4a-b199-00bda2a5f3df",
    },
    /**
     * De publieke helft van het VAPID-paar, voor web push.
     *
     * Die hoort hier en niet in een geheim: hij gaat naar élke browser die
     * zich abonneert — dat is precies zijn functie. De private helft staat
     * als secret bij de Edge Function en komt nergens in deze repo voor.
     *
     * Hij stond nergens, en daarom deed `registerWebPush()` niets: zonder
     * sleutel geen abonnement, zonder abonnement geen rij in `user_devices`,
     * en dan meldt send-push terecht "no devices". Web push heeft dus nooit
     * gewerkt — het was geen storing maar een ontbrekende sleutel.
     *
     * `process.env` blijft voorgaan zodat een deploy hem kan overschrijven
     * zonder dit bestand aan te raken.
     */
    vapidPublicKey:
      process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY ??
      "BJ59YR8gKJwpwrBwnNRhMyR9k2LnCLuvIZgYWdnq3xnRk2zkgKwHQADif2WmaIphUju9xC_LijPn7CdomL_zskQ",
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
