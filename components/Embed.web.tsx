import { createElement } from "react";
import { View } from "react-native";

/**
 * Web-variant van de inline speler: een echte iframe.
 *
 * react-native-web rendert naar de DOM, dus `createElement("iframe", …)`
 * werkt hier gewoon — dezelfde truc die VideoCallModal.web.tsx gebruikt.
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
      {createElement("iframe", {
        src: url,
        style: {
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          backgroundColor: "#0A0A0B",
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
