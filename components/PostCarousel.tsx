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
import { feed, feedType, space } from "@/lib/design/type";

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
              fallbackBg="bg-feed-post"
              fallbackColor={feed.inkDim}
            />
          </Pressable>
        ))}
      </ScrollView>

      {many ? (
        <>
          {/* Teller rechtsboven: bij tien foto's zeggen stippen niet meer
              hoeveel er nog komen, een getal wel. */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: space.md,
              right: space.md,
              paddingHorizontal: space.sm,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: "rgba(11,10,12,0.55)",
            }}
          >
            <Text style={[feedType.label, { color: feed.text, fontSize: 11 }]}>
              {`${index + 1} / ${urls.length}`}
            </Text>
          </View>

          <Animated.View
            pointerEvents="box-none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              bottom: 0,
              opacity: controls,
            }}
          >
            {index > 0 ? <Arrow side="left" onPress={() => goTo(index - 1)} /> : null}
            {index < urls.length - 1 ? (
              <Arrow side="right" onPress={() => goTo(index + 1)} />
            ) : null}
          </Animated.View>

          {/* Stippen op één doorschijnend vlak: los op de foto verdwijnen
              ze in een lichte lucht of een witte muur. */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: space.md,
              alignItems: "center",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                paddingHorizontal: space.sm,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: "rgba(11,10,12,0.45)",
              }}
            >
              {urls.map((_, i) => (
                <Animated.View
                  key={i}
                  style={{
                    height: 5,
                    borderRadius: 999,
                    backgroundColor: feed.text,
                    // Alleen de actieve is een streepje; de rest blijft een
                    // stip. De overgang loopt mee met het vegen.
                    width: active.interpolate({
                      inputRange: [i - 1, i, i + 1],
                      outputRange: [5, 18, 5],
                      extrapolate: "clamp",
                    }),
                    opacity: active.interpolate({
                      inputRange: [i - 1, i, i + 1],
                      outputRange: [0.45, 1, 0.45],
                      extrapolate: "clamp",
                    }),
                  }}
                />
              ))}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function Arrow({ side, onPress }: { side: "left" | "right"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        position: "absolute",
        top: "50%",
        marginTop: -18,
        [side]: space.md,
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? "rgba(11,10,12,0.8)" : "rgba(11,10,12,0.5)",
      })}
    >
      <Ionicons
        name={side === "left" ? "chevron-back" : "chevron-forward"}
        size={20}
        color={feed.text}
      />
    </Pressable>
  );
}
