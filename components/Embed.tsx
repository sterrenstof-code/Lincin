import { WebView } from "react-native-webview";
import { View } from "react-native";
import { feed } from "@/lib/design/type";

/**
 * Inline speler voor externe media (YouTube, Vimeo, Spotify, …).
 *
 * Native-variant: WebView. De web-variant staat in `Embed.web.tsx` en
 * gebruikt een echte iframe — Expo kiest automatisch het juiste bestand.
 *
 * Bewust géén autoplay: een feed die uit zichzelf begint te spelen is
 * precies het gedrag waar dit product tegen bestaat.
 */
export function Embed({
  url,
  aspectRatio = 16 / 9,
}: {
  url: string;
  aspectRatio?: number;
}) {
  return (
    <View style={{ width: "100%", aspectRatio }} className="bg-shell">
      <WebView
        source={{ uri: url }}
        style={{ flex: 1, backgroundColor: feed.ink }}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        allowsFullscreenVideo
        javaScriptEnabled
        domStorageEnabled
        setSupportMultipleWindows={false}
        originWhitelist={["https://*"]}
      />
    </View>
  );
}
