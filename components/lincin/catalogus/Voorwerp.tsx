import { Image, type ImageSource } from "expo-image";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { CATALOGUS } from "@/lib/design/theme";

import { Pauze, Speel } from "./Pictogram";
import { kaartjeTekst, letter, tekst, titel, useCat } from "./stijl";

/**
 * De voorwerpen (ontwerp 3e): wat er op het grijze vlak ligt. Eén per soort
 * inhoud — foto, tekst, poll, muziek, kleur, link, plek, spraak — plus de
 * linc (een foto, of een vierkant in zijn kleur met zijn initiaal).
 *
 * Elk voorwerp heeft een vaste maat die het vak meegeeft; rechte hoeken.
 */

export type Beeld = ImageSource | string | null | undefined;

function bron(b: Beeld): ImageSource | undefined {
  if (!b) return undefined;
  return typeof b === "string" ? { uri: b } : b;
}

/** Een foto: het beeld vult de maat, bijgesneden. Zonder beeld de plaatshouder. */
export function Foto({ b, h, beeld, cacheKey, style, testID = "voorwerp" }: { b: number; h: number; beeld: Beeld; cacheKey?: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  const c = useCat();
  const src = bron(beeld);
  return (
    <View testID={testID} style={[{ width: b, height: h, flexShrink: 0, overflow: "hidden", backgroundColor: c.plaatshouder }, style]}>
      {src ? (
        <Image
          source={cacheKey && "uri" in src ? { ...src, cacheKey } : src}
          contentFit="cover"
          transition={0}
          style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

/** Het lege beeld, met een woord erin ("[beeld]" in het ontwerp). */
export function Plaatshouder({ b, h, woord }: { b: number; h: number; woord: string }) {
  const c = useCat();
  return (
    <View testID="voorwerp" style={{ width: b, height: h, backgroundColor: c.plaatshouder, alignItems: "center", justifyContent: "center" }}>
      <Text style={[kaartjeTekst, { color: c.inkt }]}>{woord}</Text>
    </View>
  );
}

/**
 * Een linc: zijn foto, of een vierkant in zijn eigen kleur met zijn
 * initiaal. Zonder kleur (wie je niet kent) het grijs van de plaatshouder.
 */
export function Linc({
  maat,
  beeld,
  kleur,
  initiaal,
  letterMaat,
  letterKleur,
  style,
  testID,
}: {
  maat: number;
  beeld?: Beeld;
  kleur?: string | null;
  initiaal: string;
  letterMaat: number;
  letterKleur?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = useCat();
  // Een foto is een voorwerp, ook als avatar (zo telt de referentie elk beeld).
  if (beeld) return <Foto b={maat} h={maat} beeld={beeld} style={style} testID={testID ?? "voorwerp"} />;
  return (
    <View
      testID={testID ?? "linc"}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width: maat, height: maat, flexShrink: 0, backgroundColor: kleur ?? c.plaatshouder, alignItems: "center", justifyContent: "center" }, style]}
    >
      {/* Op een linc-kleur altijd donker; op het grijs van de plaatshouder de inkt van de stand. */}
      <Text style={{ ...letter(700), fontSize: letterMaat, color: letterKleur ?? (kleur ? CATALOGUS.lincInkt : c.inkt) }}>{initiaal}</Text>
    </View>
  );
}

/** Het witte blad waarop tekst, poll, link en spraak liggen: 150 × 180, 10 marge. */
export type Maat = { b: number; h: number };

function Blad({ children, donker = false, maat, style }: { children: ReactNode; donker?: boolean; maat?: Maat; style?: StyleProp<ViewStyle> }) {
  const c = useCat();
  return (
    <View
      testID="voorwerp"
      style={[
        { width: maat?.b ?? 150, height: maat?.h ?? 180, backgroundColor: donker ? c.inkt : c.kaart, padding: 10, flexDirection: "column", justifyContent: "space-between" },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function TekstBlad({ tekst: t, maat, pagineer = false }: { tekst: string; maat?: Maat; pagineer?: boolean }) {
  const c = useCat();
  if (pagineer) return <TekstBladen tekst={t} maat={maat ?? { b: 150, h: 180 }} />;
  return (
    <Blad maat={maat}>
      <Text style={[titel(19, 1.15), { color: c.inkt }]} numberOfLines={7}>
        {t}
      </Text>
    </Blad>
  );
}

const BLADEN_REGEL = 19 * 1.15;
const BLADEN_BALK = 44;

/**
 * De hele tekst op het blad, in bladzijden (de bijdrage zelf). Het blad
 * houdt zijn maat; de tekst schuift per bladzijde een veelvoud van de
 * regelhoogte op, zodat er nooit een halve regel staat. Onderaan ← n / m →
 * zodra de tekst niet op één bladzijde past.
 */
function TekstBladen({ tekst: t, maat }: { tekst: string; maat: Maat }) {
  const c = useCat();
  const [hoogte, setHoogte] = useState(0);
  const [blz, setBlz] = useState(0);
  useEffect(() => setBlz(0), [t]);

  const binnen = maat.h - 20;
  const regels = (ruimte: number) => Math.max(1, Math.floor(ruimte / BLADEN_REGEL));
  const past = hoogte <= regels(binnen) * BLADEN_REGEL + 1;
  const perBlz = regels(past ? binnen : binnen - BLADEN_BALK) * BLADEN_REGEL;
  const aantal = past ? 1 : Math.ceil((hoogte - 1) / perBlz);
  const nu = Math.min(blz, aantal - 1);

  const pijl = (richting: -1 | 1) => {
    const kan = richting < 0 ? nu > 0 : nu < aantal - 1;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={richting < 0 ? "Vorige bladzijde" : "Volgende bladzijde"}
        accessibilityState={{ disabled: !kan }}
        disabled={!kan}
        onPress={() => setBlz(nu + richting)}
        style={{ width: 44, height: BLADEN_BALK, alignItems: richting < 0 ? "flex-start" : "flex-end", justifyContent: "center", opacity: kan ? 1 : 0.3 }}
      >
        <Text style={[tekst(18), { color: c.inkt }]}>{richting < 0 ? "←" : "→"}</Text>
      </Pressable>
    );
  };

  return (
    <Blad maat={maat} style={{ justifyContent: "flex-start" }}>
      <View style={{ height: perBlz, overflow: "hidden" }}>
        <View style={{ position: "absolute", left: 0, right: 0, top: -nu * perBlz }}>
          <Text selectable onLayout={(e) => setHoogte(e.nativeEvent.layout.height)} style={[titel(19, 1.15), { color: c.inkt }]}>
            {t}
          </Text>
        </View>
      </View>
      {aantal > 1 ? (
        <View style={{ marginTop: "auto", height: BLADEN_BALK, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {pijl(-1)}
          <Text accessibilityLiveRegion="polite" style={[kaartjeTekst, { color: c.label }]}>{`${nu + 1} / ${aantal}`}</Text>
          {pijl(1)}
        </View>
      ) : null}
    </Blad>
  );
}

export type PollOptie = { id: string; label: string; procent: number; gekozen: boolean; tekst: string };

export function PollBlad({ vraag, opties, onStem, maat }: { vraag: string; opties: PollOptie[]; onStem?: (id: string) => void; maat?: Maat }) {
  const c = useCat();
  return (
    <Blad maat={maat}>
      <Text style={[tekst(13, 600, 1.2), { color: c.inkt }]} numberOfLines={3}>
        {vraag}
      </Text>
      <View style={{ rowGap: 4 }}>
        {opties.map((o) => (
          <Pressable
            key={o.id}
            accessibilityRole="button"
            accessibilityState={{ selected: o.gekozen }}
            accessibilityLabel={`${o.label}, ${o.tekst}`}
            onPress={onStem ? () => onStem(o.id) : undefined}
            style={{ height: 44, width: "100%", backgroundColor: c.vlak, overflow: "hidden", justifyContent: "center" }}
          >
            <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${o.procent}%`, backgroundColor: o.gekozen ? c.inkt : c.balkInactief }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 8 }}>
              <Text numberOfLines={1} style={[tekst(12, 600), { color: o.gekozen ? c.tekstOpInkt : c.inkt, flexShrink: 1 }]}>
                {o.label}
              </Text>
              <Text style={[tekst(12, 600), { color: c.inkt }]}>{o.tekst}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </Blad>
  );
}

export function MuziekBlad({
  nummer,
  artiest,
  speelt,
  voortgang,
  onSpeel,
  maat,
}: {
  maat?: Maat;
  nummer: string;
  artiest: string;
  speelt: boolean;
  /** 0–1 */
  voortgang: number;
  onSpeel?: () => void;
}) {
  const c = useCat();
  return (
    <Blad donker maat={maat}>
      <View style={{ rowGap: 2 }}>
        <Text numberOfLines={2} style={[tekst(15, 600), { color: c.tekstOpInkt }]}>
          {nummer}
        </Text>
        <Text numberOfLines={1} style={[tekst(12), { color: c.tekstOpInkt, opacity: 0.7 }]}>
          {artiest}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", columnGap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${speelt ? "Pauzeer" : "Speel"} ${nummer}`}
          onPress={onSpeel}
          style={{ width: 44, height: 44, flexShrink: 0, backgroundColor: c.kaart, alignItems: "center", justifyContent: "center" }}
        >
          {speelt ? <Pauze kleur={c.inkt} /> : <Speel kleur={c.inkt} />}
        </Pressable>
        <View style={{ flex: 1, height: 2, backgroundColor: c.tekstTweede }}>
          <View style={{ position: "absolute", left: 0, top: 0, height: 2, width: `${Math.round(voortgang * 100)}%`, backgroundColor: c.accent }} />
        </View>
      </View>
    </Blad>
  );
}

export function KleurVlak({ hex, b = 132, h = 168 }: { hex: string; b?: number; h?: number }) {
  return <View testID="voorwerp" style={{ width: b, height: h, backgroundColor: hex }} />;
}

export function LinkBlad({ beeld, titel: t, maat }: { beeld: Beeld; titel: string; maat?: Maat }) {
  const c = useCat();
  const src = bron(beeld);
  return (
    <Blad maat={maat}>
      <View testID="voorwerp" style={{ height: 84, marginTop: -10, marginHorizontal: -10, overflow: "hidden", backgroundColor: c.plaatshouder }}>
        {src ? <Image source={src} contentFit="cover" transition={0} style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%" }} /> : null}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", columnGap: 6 }}>
        <Text numberOfLines={3} style={[tekst(13, 600, 1.2), { color: c.inkt, flexShrink: 1 }]}>
          {t}
        </Text>
        <Text style={[tekst(16), { color: c.inkt }]}>↗</Text>
      </View>
    </Blad>
  );
}

/**
 * Een plek: een kaartje van een stad in rasterlijnen, een weg schuin
 * erdoor, en de plek als ruit in de accentkleur. Getekend, geen echte kaart:
 * de coördinaten blijven in de bijdrage.
 */
export function PlekKaart({ b = 150, h = 168 }: { b?: number; h?: number }) {
  const c = useCat();
  const lijnen: ReactNode[] = [];
  for (let y = 0; y < h; y += 30) lijnen.push(<View key={`h${y}`} style={{ position: "absolute", left: 0, right: 0, top: y, height: 2, backgroundColor: c.vlak }} />);
  for (let x = 0; x < b; x += 30) lijnen.push(<View key={`v${x}`} style={{ position: "absolute", top: 0, bottom: 0, left: x, width: 2, backgroundColor: c.vlak }} />);
  return (
    <View testID="voorwerp" style={{ width: b, height: h, overflow: "hidden", backgroundColor: c.kaartLand }}>
      {lijnen}
      <View style={{ position: "absolute", left: -20, right: -20, top: 96, height: 8, backgroundColor: c.vlak, transform: [{ rotate: "-14deg" }] }} />
      <View style={{ position: "absolute", left: 68, top: 60, width: 16, height: 16, backgroundColor: c.accent, transform: [{ rotate: "45deg" }] }} />
    </View>
  );
}

/** De golf van een spraakbericht: balken van 3 breed. */
export function Golf({ hoogtes, kleur, hoogte, tussen }: { hoogtes: number[]; kleur: string; hoogte: number; tussen?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: hoogte, flexDirection: "row", alignItems: "center", ...(tussen === undefined ? { justifyContent: "space-between", flex: 1 } : { columnGap: tussen }) }}
    >
      {hoogtes.map((v, i) => (
        <View key={i} style={{ width: 3, height: v, backgroundColor: kleur }} />
      ))}
    </View>
  );
}

export function SpraakBlad({ golf, duur, speelt, onSpeel, maat }: { golf: number[]; duur: string; speelt: boolean; onSpeel?: () => void; maat?: Maat }) {
  const c = useCat();
  return (
    <Blad maat={maat}>
      <View style={{ height: 70, flexDirection: "row" }}>
        <Golf hoogtes={golf} kleur={c.inkt} hoogte={70} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={speelt ? "Pauzeer spraakbericht" : "Speel spraakbericht af"}
          onPress={onSpeel}
          style={{ width: 44, height: 44, backgroundColor: c.inkt, alignItems: "center", justifyContent: "center" }}
        >
          {speelt ? <Pauze kleur={c.tekstOpInkt} /> : <Speel kleur={c.tekstOpInkt} />}
        </Pressable>
        <Text style={[kaartjeTekst, { color: c.inkt }]}>{duur}</Text>
      </View>
    </Blad>
  );
}
