import { createElement } from "react";
import { View } from "react-native";
import { feed } from "@/lib/design/type";

/**
 * Web-variant van de inline speler: een echte iframe.
 *
 * react-native-web rendert naar de DOM, dus `createElement("iframe", …)`
 * werkt hier gewoon — dezelfde truc die VideoCallModal.web.tsx gebruikt.
 */
export function Embed({
  url,
  aspectRatio = 16 / 9,
  /**
   * Wat er in dit kader staat, in woorden.
   *
   * Een `<iframe>` zonder `title` is voor een schermlezer een naamloos
   * document midden in de pagina: hij kondigt "frame" aan en verder niets,
   * en je hebt geen manier om te weten of je hem in of over wilt. Dat is
   * dezelfde regel als §7 voor een knop zonder naam stelt — hier alleen
   * groter, want dit ding beslaat de halve pagina.
   */
  title = "Ingesloten speler",
}: {
  url: string;
  aspectRatio?: number;
  title?: string;
}) {
  return (
    <View style={{ width: "100%", aspectRatio }} className="bg-shell">
      {createElement("iframe", {
        src: url,
        title,
        style: {
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          backgroundColor: feed.ink,
        },
        allow:
          "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen",
        allowFullScreen: true,
        loading: "lazy",
        referrerPolicy: "strict-origin-when-cross-origin",
      })}
    </View>
  );
}
