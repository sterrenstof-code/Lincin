import { Pressable, Text, View } from "react-native";

import { tabTekst, useCat } from "./stijl";

export type CatTab = "feed" | "chats" | "events" | "you";

const TABS: { tab: CatTab; label: string }[] = [
  { tab: "feed", label: "Feed" },
  { tab: "chats", label: "Gesprekken" },
  { tab: "events", label: "Events" },
  { tab: "you", label: "Jij" },
];

/**
 * De tabbalk (ontwerp 3e): 64 px, vier gelijke kolommen. Het actieve
 * tabblad is onderstreept; een vierkantje in de accentkleur zegt dat er in
 * de gesprekken iets ongelezen is.
 */
export function Tabbalk({
  actief,
  ongelezen,
  onKies,
}: {
  actief: CatTab;
  ongelezen: boolean;
  onKies?: (tab: CatTab) => void;
}) {
  const c = useCat();
  return (
    <View testID="tabbalk" accessibilityRole="tablist" style={{ height: 64, flexShrink: 0, flexDirection: "row", backgroundColor: c.vlak }}>
      {TABS.map(({ tab, label }) => {
        const aan = tab === actief;
        const woord = <Text style={[tabTekst, { color: c.inkt }]}>{label}</Text>;
        return (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: aan }}
            accessibilityLabel={tab === "chats" && ongelezen ? `${label}, ongelezen` : label}
            onPress={() => onKies?.(tab)}
            style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center" }}
          >
            {aan ? <View style={{ borderBottomWidth: 2, borderBottomColor: c.inkt, paddingBottom: 3 }}>{woord}</View> : woord}
            {tab === "chats" && ongelezen ? <View style={{ width: 6, height: 6, backgroundColor: c.accent, marginLeft: 6 }} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}
