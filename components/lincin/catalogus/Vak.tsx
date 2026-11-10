import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { Pressable, View, type StyleProp, type ViewStyle } from "react-native";

import { Kaartje, type Regel } from "./Kaartje";
import { MARGE, NAAD, useCat } from "./stijl";

/**
 * Het vak (ontwerp 3e): een grijs vlak met 12 px marge, het voorwerp
 * gecentreerd in de ruimte die overblijft, het kaartje eronder.
 *
 * Tikken op het héle vak opent de bijdrage; er is geen aparte knop. Lang
 * drukken geeft de snelle handelingen (scherm 17).
 */
export function Vak({
  hoogte,
  regels,
  kaartje,
  children,
  onPress,
  onLongPress,
  gekozen = false,
  opgetild = false,
  tussen,
  label,
  breed,
  style,
}: {
  hoogte: number;
  /** De regels van het kaartje onder het voorwerp. */
  regels?: Regel[];
  /** Een eigen onderkant in plaats van het kaartje (het vak met hartje, scherm 18). */
  kaartje?: ReactNode;
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Gekozen (nieuwe bijdrage, stap 1): wit vlak met een kader van 2. */
  gekozen?: boolean;
  /** Losgekomen van het blad (lang drukken): wit, boven de dimlaag, met schaduw. */
  opgetild?: boolean;
  /** Ruimte tussen voorwerp en kaartje (scherm 19: 10). */
  tussen?: number;
  label?: string;
  /** Over de volle breedte van het raster. Gelezen door `Raster`. */
  breed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useCat();
  void breed;
  const vlak: ViewStyle = {
    height: hoogte,
    backgroundColor: gekozen || opgetild ? c.kaart : c.vlak,
    padding: MARGE,
    flexDirection: "column",
    justifyContent: "space-between",
    ...(tussen ? { rowGap: tussen } : null),
    ...(gekozen ? { outlineColor: c.inkt, outlineStyle: "solid", outlineWidth: 2, outlineOffset: -2 } : null),
    ...(opgetild ? { zIndex: 2, boxShadow: `0px 20px 50px ${c.schaduw}` } : null),
  } as ViewStyle;
  const inhoud = (
    <>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>{children}</View>
      {kaartje ?? (regels ? <Kaartje regels={regels} /> : null)}
    </>
  );
  if (!onPress && !onLongPress) {
    return (
      <View testID="vak" style={[vlak, style]}>
        {inhoud}
      </View>
    );
  }
  return (
    <Pressable
      testID="vak"
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={380}
      style={[vlak, style]}
    >
      {inhoud}
    </Pressable>
  );
}

/**
 * Het raster: twee kolommen met een naad van 2 px, boven en onder ook een
 * naad. Een vak met `breed` neemt een hele rij; een oneven laatste vak houdt
 * zijn halve breedte en laat de naad ernaast zien.
 */
export function Raster({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useCat();
  const kinderen = Children.toArray(children).filter(isValidElement) as ReactElement<{ breed?: boolean }>[];
  type Kind = ReactElement<{ breed?: boolean }>;
  const rijen: Kind[][] = [];
  let half: Kind[] = [];
  for (const k of kinderen) {
    if (k.props.breed) {
      if (half.length) rijen.push(half);
      half = [];
      rijen.push([k]);
    } else {
      half.push(k);
      if (half.length === 2) {
        rijen.push(half);
        half = [];
      }
    }
  }
  if (half.length) rijen.push(half);
  return (
    <View style={[{ backgroundColor: c.naad, paddingVertical: NAAD, rowGap: NAAD }, style]}>
      {rijen.map((rij, i) =>
        rij.length === 1 && rij[0].props.breed ? (
          <View key={i}>{rij[0]}</View>
        ) : (
          <View key={i} style={{ flexDirection: "row", columnGap: NAAD }}>
            <View style={{ flex: 1, minWidth: 0 }}>{rij[0]}</View>
            {/* Een halve rij: de lege helft is vlak, geen naad. */}
            <View style={{ flex: 1, minWidth: 0, backgroundColor: rij[1] ? undefined : c.vlak }}>{rij[1] ?? null}</View>
          </View>
        ),
      )}
    </View>
  );
}

/** Een naad over de volle breedte, als scheiding tussen twee banden. */
export function Naad() {
  const c = useCat();
  return <View style={{ height: NAAD, backgroundColor: c.naad }} />;
}
