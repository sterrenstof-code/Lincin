import { Ionicons } from "@expo/vector-icons";

import { Segmented, SettingBlock } from "@/components/Segmented";
import {
  setPreference,
  usePreference,
  type ThemePreference,
} from "@/lib/design/theme";

/**
 * De schakelaar tussen de twee standen.
 *
 * Drie standen en geen twee: `Auto` volgt het besturingssysteem, en dat is
 * waar de app op begint. Wie zijn telefoon 's avonds op donker zet
 * verwacht dat een app meegaat; wie dat niet wil, kiest hier één keer een
 * kant en dan blijft het daarbij.
 *
 * De vorm is die van elke andere keuzerij in dit systeem — zie
 * `components/Segmented.tsx`, waar hij sinds de feed-voorkeuren erbij
 * kwamen één keer staat in plaats van twee keer.
 *
 * Hij staat in het persoonlijke menu achter je avatar. Dat is waar alles
 * woont wat over jou gaat en niet over de uitgave — je meldingen, je
 * profiel, en dus ook hoe de uitgave er voor jóu uitziet.
 */

const OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  { value: "system", label: "Auto", icon: "phone-portrait-outline" },
  { value: "light", label: "Licht", icon: "sunny-outline" },
  { value: "dark", label: "Donker", icon: "moon-outline" },
];

export function ThemeSwitch() {
  const preference = usePreference();

  return (
    <SettingBlock icon="contrast-outline" title="Weergave">
      <Segmented value={preference} onChange={setPreference} options={OPTIONS} />
    </SettingBlock>
  );
}
