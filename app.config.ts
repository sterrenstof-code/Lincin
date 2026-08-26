import { ExpoConfig, ConfigContext } from "expo/config";

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
  userInterfaceStyle: "dark",
  newArchEnabled: true,

  ios: {
    supportsTablet: true,
    bundleIdentifier: "io.beyondesign.lincin",
    buildNumber: "1",
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
      ITSAppUsesNonExemptEncryption: false,
      UIViewControllerBasedStatusBarAppearance: false,
    },
  },

  android: {
    package: "io.beyondesign.lincin",
    versionCode: 1,
    adaptiveIcon: {
      backgroundColor: "#0A0A0B",
      foregroundImage: "./assets/images/android-icon-foreground.png",
      backgroundImage: "./assets/images/android-icon-background.png",
      monochromeImage: "./assets/images/android-icon-monochrome.png",
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
    permissions: [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.RECEIVE_BOOT_COMPLETED",
      "android.permission.VIBRATE",
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
        icon: "./assets/images/icon.png",
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
    // expo-updates wordt toegevoegd via `npx expo install expo-updates`
    // en daarna via `eas update:configure`
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
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
