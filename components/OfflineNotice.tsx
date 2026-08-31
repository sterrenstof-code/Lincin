import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { creamOnDark, FEED_BORDER, feedType, flame, shell, space } from "@/lib/design/type";
import { useIsOnline } from "@/lib/online";

/**
 * De strook die zegt dat je geen verbinding hebt.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT GEEN TOAST IS
 * ---------------------------------------------------------------
 * `useToast()` is voor iets dat gebeurd is: een mutatie die faalde, een
 * rij die terugkwam. Die strook gaat na een paar seconden weg, en dat
 * hoort ook — een gebeurtenis is voorbij.
 *
 * Offline zijn is geen gebeurtenis maar een toestand. Hij duurt, en
 * zolang hij duurt is élke knop in de app een knop die niets gaat doen.
 * Een melding die na vijf seconden verdwijnt terwijl de toestand blijft
 * is dan misleidend: je leest hem, hij gaat weg, je probeert het
 * opnieuw, het faalt weer.
 *
 * Vandaar een strook die blijft staan tot hij niet meer waar is.
 *
 * ---------------------------------------------------------------
 * DE VORM
 * ---------------------------------------------------------------
 * Dezelfde als de toast — `shell`-zwart met crème in béide standen (§2),
 * een `flame`-kantlijn — want het is hetzelfde soort ding: een laag óver
 * de pagina, niet erin. Hij ligt bovenaan, waar de toast ook komt, en
 * schuift dus niet over het toetsenbord of over het veld waarin je typt.
 *
 * Geen knop: er valt niets te doen dan wachten, en een knop die dat niet
 * kan veranderen zou alleen maar suggereren van wel.
 */
export function OfflineNotice() {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();

  if (online) return null;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        paddingTop: insets.top,
        alignItems: "center",
        zIndex: 60,
      }}
    >
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.sm,
          backgroundColor: shell,
          borderWidth: FEED_BORDER,
          borderColor: flame,
          borderLeftWidth: 4,
          paddingHorizontal: space.lg,
          paddingVertical: space.sm,
          maxWidth: 460,
          width: "100%",
        }}
      >
        <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>
          Geen verbinding
        </Text>
        <Text style={[feedType.caption, { color: creamOnDark.muted, flex: 1 }]}>
          Wat je nu verstuurt komt niet aan.
        </Text>
      </View>
    </View>
  );
}
