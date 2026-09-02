import { View } from "react-native";

import { Segmented, SettingBlock } from "@/components/Segmented";
import {
  setFeedDimSeen,
  setFeedLayout,
  setFeedOrder,
  useFeedPrefs,
} from "@/lib/feed-prefs";

/**
 * Hoe de thuispagina eruitziet: weergave, ordening, en of gelezen vondsten
 * dimmen.
 *
 * ---------------------------------------------------------------
 * WAAROM HIER EN NIET BOVEN DE FEED
 * ---------------------------------------------------------------
 * Deze drie schakelaars stonden als vijf tekeningen boven de uitgave, met
 * eronder in woorden wat er aan stond ("Raster · nieuwste eerst"). Dat was
 * al de tweede poging om ze leesbaar te krijgen, en het bleef een
 * bedieningspaneel bovenaan een blad: het eerste wat je zag als je de app
 * opende was niet de uitgave maar de knoppen om hem in te stellen.
 *
 * Het is een instelling, geen gereedschap. Je kiest één keer hoe je wil
 * kijken en daarna maanden niet meer — precies zoals je licht of donker
 * kiest. Dus staat hij waar die keuze ook staat: in het persoonlijke
 * venster achter je avatar, onder dezelfde soort kop, in dezelfde keuzerij
 * (zie `components/Segmented.tsx`).
 *
 * Woorden in de vakken en niet alleen tekeningen. Boven de feed moest het
 * smal, dus werd het een rij pictogrammen met een bijschrift eronder; in
 * een venster is er breedte, en dan hoeft niemand een tekening te raden.
 * De tekening staat er nog wél naast voor metselwerk en raster, want díe
 * twee laten zich beter tekenen dan zeggen.
 */

export function FeedSwitch({ userId }: { userId: string }) {
  const { layout, order, dimSeen } = useFeedPrefs(userId);

  return (
    <SettingBlock icon="grid-outline" title="Thuispagina" divider>
      <Segmented
        value={layout}
        onChange={setFeedLayout}
        options={[
          {
            value: "mosaic",
            label: "Metselwerk",
            glyph: (color) => <LayoutGlyph kind="mosaic" color={color} />,
          },
          {
            value: "grid",
            label: "Raster",
            glyph: (color) => <LayoutGlyph kind="grid" color={color} />,
          },
        ]}
      />
      <Segmented
        value={order}
        onChange={setFeedOrder}
        options={[
          { value: "thematic", label: "Rubrieken", icon: "albums-outline" },
          { value: "chrono", label: "Nieuwste", icon: "time-outline" },
        ]}
      />
      <Segmented
        value={dimSeen ? "dim" : "all"}
        onChange={(next) => setFeedDimSeen(next === "dim")}
        options={[
          { value: "dim", label: "Gelezen dimmen", icon: "eye-off-outline" },
          { value: "all", label: "Alles gelijk", icon: "eye-outline" },
        ]}
      />
    </SettingBlock>
  );
}

/**
 * De tekening van de twee weergaven, opgebouwd uit vlakjes.
 *
 * Geen icoonlettertype en geen SVG-bestand: dit zijn zes rechthoekjes, en
 * die tekenen we met dezelfde bouwstenen als de rest van het scherm. Zo
 * volgt hij vanzelf de kleur van de cel waar hij in staat.
 *
 * Hij is een maatje kleiner dan boven de feed: daar was hij de hele knop,
 * hier staat hij naast een woord van 12px en mag hij dat woord niet
 * overstemmen.
 */
function LayoutGlyph({ kind, color }: { kind: "mosaic" | "grid"; color: string }) {
  const box = (w: number, h: number, key: string) => (
    <View key={key} style={{ width: w, height: h, backgroundColor: color }} />
  );

  if (kind === "grid") {
    return (
      <View style={{ flexDirection: "row", gap: 1.5 }}>
        {[0, 1, 2].map((c) => (
          <View key={c} style={{ gap: 1.5 }}>
            {[0, 1, 2].map((r) => box(3, 3, `${c}-${r}`))}
          </View>
        ))}
      </View>
    );
  }

  // Metselwerk: twee kolommen, blokken van verschillende hoogte.
  return (
    <View style={{ flexDirection: "row", gap: 1.5 }}>
      <View style={{ gap: 1.5 }}>
        {box(5, 7, "a")}
        {box(5, 4, "b")}
      </View>
      <View style={{ gap: 1.5 }}>
        {box(5, 4, "c")}
        {box(5, 7, "d")}
      </View>
    </View>
  );
}
