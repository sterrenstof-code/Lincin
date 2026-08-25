import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { SafeImage } from "@/components/SafeImage";
import { creamOnDark, feed, feedType, space } from "@/lib/design/type";

/**
 * Door een album bladeren.
 *
 * ---------------------------------------------------------------
 * WAT DE VORM BEPAALT
 * ---------------------------------------------------------------
 * De besturing hoort ín het beeld te liggen en niet ernaast: een grijs
 * vierkantje aan de rand van de kolom leest als een knop van het scherm,
 * niet als een knop van deze foto — en bij een staande foto stond hij zelfs
 * náást het beeld, in de lege ruimte. Alles wat je hier bedient ligt nu
 * over de foto: pijlen links en rechts, de teller rechtsboven, de stippen
 * onderaan, allemaal op een donker doorschijnend vlak zodat ze leesbaar
 * blijven op elke foto.
 *
 * Het zijn de enige ronde vormen in dit ontwerp, samen met de avatar en de
 * deelknop — en om dezelfde reden: ze liggen erbovenop en zijn geen kader,
 * tegel of vlak.
 *
 * ---------------------------------------------------------------
 * WAAROM GEEN CARROUSEL-BIBLIOTHEEK
 * ---------------------------------------------------------------
 * Dit is een rij met `overflow: scroll` en een teller. Wat zo'n bibliotheek
 * daarbovenop biedt — oneindig doorlopen, autoplay, meerdere zichtbaar —
 * wil dit ontwerp geen van alle, en framer-motion werkt alleen in de DOM
 * terwijl dit scherm ook op een telefoon draait. De beweging komt van
 * `Animated`, dat op beide kanten hetzelfde doet.
 */
export function PostCarousel({
  urls,
  cacheKeys,
  style,
  contentFit = "cover",
  onPressImage,
}: {
  urls: string[];
  /** Stabiele sleutels per foto, meestal het storage-pad. */
  cacheKeys?: (string | undefined)[];
  style?: StyleProp<ViewStyle>;
  contentFit?: "cover" | "contain";
  onPressImage?: () => void;
}) {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  /**
   * De verhouding van elke foto, zodra hij binnen is.
   *
   * Nodig omdat de besturing op de fóto moet liggen en niet op de plaat.
   * Bij `contain` is de plaat bijna altijd breder dan de foto — een staande
   * foto in een brede kolom — en dan zweeft een pijl aan de rechterrand
   * ergens in het lege vlak ernaast in plaats van op het beeld.
   */
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const [index, setIndex] = useState(0);
  const [hovered, setHovered] = useState(Platform.OS !== "web");
  const scroller = useRef<ScrollView>(null);

  /** Voor de stippen: de actieve groeit uit tot een streepje. */
  const active = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(active, {
      toValue: index,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [index, active]);

  /**
   * De besturing komt op wanneer je erover gaat.
   *
   * In rust blijft hij op 0.6 en niet op 0: als deze muis-events om welke
   * reden dan ook niet aankomen, moet er nog steeds een pijl te zien zijn.
   * Een knop die alleen bestaat als je hem al gevonden hebt, bestaat niet.
   */
  const controls = useRef(new Animated.Value(Platform.OS === "web" ? 0.6 : 1)).current;
  useEffect(() => {
    Animated.timing(controls, {
      toValue: hovered ? 1 : 0.6,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [hovered, controls]);

  function onLayout(e: LayoutChangeEvent) {
    setWidth(e.nativeEvent.layout.width);
    setHeight(e.nativeEvent.layout.height);
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    if (width <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(Math.max(0, Math.min(urls.length - 1, next)));
  }

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(urls.length - 1, next));
    setIndex(clamped);
    scroller.current?.scrollTo({ x: clamped * width, animated: true });
  }

  if (urls.length === 0) return null;

  const many = urls.length > 1;

  /**
   * Het vak waar de foto écht staat.
   *
   * Bij `cover` vult hij de plaat en is dat de plaat zelf. Bij `contain`
   * past hij erin en houdt hij aan twee kanten ruimte over; de besturing
   * hoort dan tegen de foto aan te liggen, niet tegen de plaat.
   */
  const ratio = ratios[index];
  const plate = { left: 0, top: 0, width, height };
  const box =
    contentFit === "cover" || !ratio || width <= 0 || height <= 0
      ? plate
      : ratio >= width / height
        ? { left: 0, top: (height - width / ratio) / 2, width, height: width / ratio }
        : {
            left: (width - height * ratio) / 2,
            top: 0,
            width: height * ratio,
            height,
          };

  return (
    <View
      style={style}
      onLayout={onLayout}
      onPointerEnter={Platform.OS === "web" ? () => setHovered(true) : undefined}
      onPointerLeave={Platform.OS === "web" ? () => setHovered(false) : undefined}
    >
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      >
        {urls.map((uri, i) => (
          <Pressable
            key={`${uri}-${i}`}
            onPress={onPressImage}
            style={{ width: width || undefined, height: "100%" }}
          >
            <SafeImage
              uri={uri}
              cacheKey={cacheKeys?.[i]}
              style={{ width: "100%", height: "100%" }}
              contentFit={contentFit}
              transition={200}
              fallbackBg="bg-feed-fill"
              fallbackColor={feed.inkDim}
              onLoad={(e) => {
                const { width: w, height: h } = (e as any).source ?? {};
                if (w && h) setRatios((prev) => (prev[i] ? prev : { ...prev, [i]: w / h }));
              }}
            />
          </Pressable>
        ))}
      </ScrollView>

      {many ? (
        <>
          {/* De teller alleen als de balk onderaan het niet meer kan zeggen.
              Tot een stuk of acht zie je aan de segmenten hoeveel er zijn
              en waar je bent; daarboven worden het streepjes en heb je een
              getal nodig. Vierkant, want dat is dit systeem — de pil van
              hiervoor hoorde er niet. */}
          {urls.length > 8 ? (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: box.top + space.md,
                left: box.left + box.width - 58,
                paddingHorizontal: space.sm,
                paddingVertical: 3,
                backgroundColor: "rgba(11,10,12,0.55)",
              }}
            >
              <Text style={[feedType.label, { color: creamOnDark.DEFAULT, fontSize: 11 }]}>
                {`${index + 1} / ${urls.length}`}
              </Text>
            </View>
          ) : null}

          <Animated.View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
              opacity: controls,
            }}
          >
            {index > 0 ? <Arrow side="left" onPress={() => goTo(index - 1)} /> : null}
            {index < urls.length - 1 ? (
              <Arrow side="right" onPress={() => goTo(index + 1)} />
            ) : null}
          </Animated.View>

          {/* De voortgang als één lijn onderaan het beeld, in segmenten.
              Hiervoor stonden hier stippen op een doorschijnende pil: drie
              ronde vormen in een ontwerp dat verder alleen rechthoeken kent,
              en stippen zeggen bovendien niet hoe ver je bent maar alleen
              de hoeveelste je hebt. Een balk die de volle breedte in gelijke
              delen knipt zegt allebei, en hij is een lijn — hetzelfde
              gereedschap waarmee de rest van de pagina zijn opbouw krijgt. */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: box.left,
              width: box.width,
              top: box.top + box.height - 5,
              flexDirection: "row",
              gap: 2,
              paddingHorizontal: 2,
            }}
          >
            {urls.map((_, i) => (
              <Animated.View
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  backgroundColor: creamOnDark.DEFAULT,
                  opacity: active.interpolate({
                    inputRange: [i - 1, i, i + 1],
                    outputRange: [0.32, 1, 0.32],
                    extrapolate: "clamp",
                  }),
                }}
              />
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
}

function Arrow({ side, onPress }: { side: "left" | "right"; onPress: () => void }) {
  return (
    /**
     * De hele zijrand is het doel, niet alleen het knopje.
     *
     * Het was een rond vlak van 36 punten dat halverwege de foto zweefde:
     * de enige cirkel in een scherm vol rechthoeken (DESIGN.md §4 laat er
     * twee toe, en dit is geen van beide), en op een telefoon een doel dat
     * je met je duim moet zoeken. Nu is de strook langs de rand aanraakbaar
     * over de volle hoogte — je hoeft alleen de kant te raken die je bedoelt
     * — en staat er een vierkant tekentje in het midden dat zegt welke kant
     * dat is.
     */
    <Pressable
      onPress={onPress}
      accessibilityLabel={side === "left" ? "Vorige" : "Volgende"}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: 0,
        width: 72,
        alignItems: side === "left" ? "flex-start" : "flex-end",
        justifyContent: "center",
      }}
    >
      {({ pressed }: { pressed: boolean }) => (
        <View
          style={{
            width: 34,
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? "rgba(11,10,12,0.78)" : "rgba(11,10,12,0.42)",
          }}
        >
          <Ionicons
            name={side === "left" ? "chevron-back" : "chevron-forward"}
            size={20}
            color={creamOnDark.DEFAULT}
          />
        </View>
      )}
    </Pressable>
  );
}
