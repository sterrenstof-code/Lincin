import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

import { CATALOGUS } from "@/lib/design/theme";

import { VastScherm } from "../Scherm";
import { CatalogusStand } from "../stijl";
import { VOORBEELDEN } from "./voorbeelden";

/**
 * Eén testpagina: `/dev/catalogus/01-home?stand=donker`.
 *
 * Het scherm staat op 390 breed (de breedte van het venster in het
 * vergelijkscript), op zijn volle hoogte of de vaste hoogte uit
 * schermen.json. Wat eronder valt is de naad, zoals in de referentie.
 */
export function DevScherm() {
  const { scherm, stand } = useLocalSearchParams<{ scherm: string; stand?: string }>();
  const s = stand === "donker" ? "dark" : "light";
  const v = VOORBEELDEN[scherm ?? ""];
  if (!v) {
    return (
      <View style={{ padding: 20 }}>
        <Text>Onbekend scherm: {scherm}. Bekend: {Object.keys(VOORBEELDEN).join(", ")}</Text>
      </View>
    );
  }
  return (
    <CatalogusStand stand={s}>
      <View style={{ flex: 1, minHeight: "100%" as unknown as number, backgroundColor: CATALOGUS[s].naad, alignItems: "flex-start" }}>
        <View style={{ width: "100%" }}>
          <VastScherm hoogte={v.hoogte}>{v.render()}</VastScherm>
        </View>
      </View>
    </CatalogusStand>
  );
}
