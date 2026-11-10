import { createContext, useContext, type ReactNode } from "react";
import { ScrollView, View, type ScrollViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useCat } from "./stijl";

/**
 * Het kader van een catalogusscherm: kop bovenaan, inhoud, en onderaan de
 * tabbalk of een invoerregel.
 *
 * In de app schuift de inhoud tussen kop en voet. De testpagina's
 * (app/dev/catalogus) zetten `vast`: dan staat alles op zijn volle hoogte
 * onder elkaar, zoals in de referentiebeelden, en bepaalt `hoogte` (uit
 * schermen.json) of er een vaste maat is waarbinnen de voet onderaan zakt.
 */
type Vast = { hoogte?: number } | null;
const VastCtx = createContext<Vast>(null);

export function VastScherm({ hoogte, children }: { hoogte?: number; children: ReactNode }) {
  return <VastCtx.Provider value={{ hoogte }}>{children}</VastCtx.Provider>;
}

export function useVast(): boolean {
  return useContext(VastCtx) !== null;
}

export function Scherm({
  kop,
  voet,
  laag,
  children,
  scrollProps,
}: {
  kop: ReactNode;
  voet?: ReactNode;
  /** Wat over het hele scherm ligt: een dimlaag, een menu. */
  laag?: ReactNode;
  children: ReactNode;
  scrollProps?: Omit<ScrollViewProps, "children">;
}) {
  const c = useCat();
  const vast = useContext(VastCtx);
  const insets = useSafeAreaInsets();
  if (vast) {
    return (
      <View testID="scherm" style={{ width: "100%", height: vast.hoogte, backgroundColor: c.vlak, flexDirection: "column", position: "relative" }}>
        {kop}
        <View style={vast.hoogte ? { flex: 1, minHeight: 0 } : undefined}>{children}</View>
        {voet}
        {laag}
      </View>
    );
  }
  return (
    <View testID="scherm" style={{ flex: 1, backgroundColor: c.vlak, paddingTop: insets.top, paddingBottom: insets.bottom }}>
      {kop}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" {...scrollProps}>
        {children}
      </ScrollView>
      {voet}
      {laag}
    </View>
  );
}
