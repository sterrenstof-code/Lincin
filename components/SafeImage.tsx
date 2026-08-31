import { Ionicons } from "@expo/vector-icons";
import { Image, type ImageProps } from "expo-image";
import { useState } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { Skeleton } from "@/components/Skeleton";
import { feed } from "@/lib/design/type";

/**
 * Image-wrapper die bij broken URL, lege source of laad-fout terugvalt op
 * een placeholder met icoon. Voorkomt witte/zwarte gaten in de UI wanneer
 * signed URLs expireren of het netwerk faalt.
 *
 * `cacheKey` — stabiele sleutel voor de schijfcache (bijv. `image_path`).
 * Omdat Supabase signed URLs bij elke fetch veranderen maar de inhoud
 * hetzelfde blijft, gebruiken we `cacheKey` om de cache-hit te garanderen
 * ongeacht de URL. Zonder `cacheKey` herlaadt expo-image elke navigatie.
 */
export function SafeImage({
  uri,
  cacheKey,
  fallbackIcon = "image-outline",
  fallbackBg = "bg-paper-warm",
  fallbackColor = feed.inkDim,
  iconSize = 32,
  containerStyle,
  skeleton = true,
  /**
   * Het invagen stond op zes van de dertien aanroepen en op de andere zeven
   * niet — dezelfde foto in dezelfde lijst kwam dus de ene keer op en
   * knalde de andere keer in beeld. Dat is geen keuze die per aanroep
   * gemaakt hoort te worden; het is één beweging in het systeem (§6). Wie
   * hem écht niet wil zet hem op 0.
   */
  transition = 150,
  ...rest
}: Omit<ImageProps, "source"> & {
  uri: string | null | undefined;
  /** Stabiele cache-sleutel los van de URL, bijv. de storage path. */
  cacheKey?: string;
  fallbackIcon?: keyof typeof Ionicons.glyphMap;
  fallbackBg?: string;
  fallbackColor?: string;
  iconSize?: number;
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Een kloppend vlak zolang de foto onderweg is. Uit te zetten voor beeld
   * dat al een eigen wachtstand heeft.
   */
  skeleton?: boolean;
}) {
  /**
   * De stand hoort bij de fóto, niet bij het onderdeel.
   *
   * ---------------------------------------------------------------
   * WAT ER MISGING
   * ---------------------------------------------------------------
   * `errored` en `loaded` stonden in `useState` en werden nooit
   * teruggezet. Op zichzelf lijkt dat onschuldig, maar React hergebruikt
   * een onderdeel op dezelfde plek in de boom: zet je in de feed een filter
   * aan, wissel je van metselwerk naar raster, of komt er na een refetch een
   * andere volgorde binnen, dan houdt cel drie zijn `SafeImage` en krijgt
   * hij alleen een andere `uri`.
   *
   * Was er ooit één foto stukgelopen — een verlopen token, een tunnel, één
   * mislukte fetch — dan bleef `errored` op `true` staan, en toonde die cel
   * vanaf dat moment het grijze plaatshoudertje voor élke foto die er nog
   * in terechtkwam. Verversen hielp niet, want er was niets dat het weer op
   * `false` zette. Alleen de app afsluiten.
   *
   * `loaded` deed de tegenhanger: bleef op `true`, dus de nieuwe foto kreeg
   * geen wachtvlak meer en er stond een gat tot hij binnen was.
   *
   * De sleutel is de bron. Verandert die, dan begint de stand opnieuw — en
   * dat gebeurt tijdens het renderen zelf, niet in een `useEffect`, zodat er
   * geen enkele render bestaat waarin de nieuwe foto met de oude uitslag
   * getekend wordt.
   */
  const [state, setState] = useState<{
    uri: string | null | undefined;
    errored: boolean;
    loaded: boolean;
  }>({ uri, errored: false, loaded: false });

  const { errored, loaded } = state.uri === uri
    ? state
    : { errored: false, loaded: false };
  if (state.uri !== uri) {
    setState({ uri, errored: false, loaded: false });
  }

  if (!uri || errored) {
    return (
      <View
        style={[rest.style as any, containerStyle]}
        className={`${fallbackBg} items-center justify-center`}
      >
        <Ionicons name={fallbackIcon} color={fallbackColor} size={iconSize} />
      </View>
    );
  }

  return (
    <>
      {/*
          Zolang de foto onderweg is staat er een pulserend vlak op zijn
          plek. Niet uit cosmetica: zonder dat is er een gat in de bladspiegel
          dat pas dichtgaat als de foto binnen is, en op een trage lijn leest
          dat als een pagina die stuk is. Het vlak ligt eróver en niet
          eronder, zodat het exact de maat van het beeld heeft, wat de
          aanroeper die maat ook geeft.
      */}
      <Image
        {...rest}
        source={{ uri, cacheKey: cacheKey ?? uri }}
        cachePolicy="disk"
        transition={transition}
        /**
         * expo-image heeft hetzelfde probleem als de stand hierboven, en
         * lost het met deze prop op: bij hergebruik van een view weet hij
         * dat de inhoud een ándere is en gooit hij de vorige weg, in plaats
         * van het oude beeld te laten staan tot het nieuwe binnen is. Het
         * pad en niet de URL, om dezelfde reden als `cacheKey` — een signed
         * URL wisselt bij elke ondertekening terwijl de foto hetzelfde is.
         */
        recyclingKey={cacheKey ?? uri}
        onError={() => setState({ uri, errored: true, loaded: true })}
        onLoadEnd={() => setState((s) => ({ ...s, uri, loaded: true }))}
      />
      {skeleton && !loaded ? (
        <Skeleton
          className="bg-paper-warm"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
    </>
  );
}
