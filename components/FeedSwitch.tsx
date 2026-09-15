import { Segmented, SettingBlock } from "@/components/Segmented";
import { setFeedOrder, useFeedPrefs } from "@/lib/feed-prefs";

/**
 * Hoe de thuispagina geordend is: in rubrieken, of gewoon nieuwste eerst.
 *
 * Eén keuze, geen drie. Er stonden ook een weergave (metselwerk of raster)
 * en "gelezen dimmen" naast — elke schakelaar is een vraag die de lezer
 * moet beantwoorden, en die twee hadden een goed antwoord dat voor
 * iedereen hetzelfde is. Dat antwoord is nu de standaard.
 *
 * Hij staat in het persoonlijke venster achter je avatar, bij licht/donker:
 * het is een instelling die je één keer zet, geen gereedschap boven de feed.
 */
export function FeedSwitch({ userId }: { userId: string }) {
  const { order } = useFeedPrefs(userId);

  return (
    <SettingBlock icon="albums-outline" title="Thuispagina" divider>
      <Segmented
        value={order}
        onChange={setFeedOrder}
        options={[
          { value: "thematic", label: "Rubrieken", icon: "albums-outline" },
          { value: "chrono", label: "Nieuwste", icon: "time-outline" },
        ]}
      />
    </SettingBlock>
  );
}
