import { Ionicons } from "@expo/vector-icons";
import { useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { SafeImage } from "@/components/SafeImage";
import { feed } from "@/lib/design/type";

/**
 * Door een album bladeren.
 *
 * Eén foto per keer, horizontaal, met stippen eronder en — op web, waar
 * niemand veegt — pijlen aan de zijkanten. De scroller klikt vast per
 * foto (`pagingEnabled`), zodat je nooit tussen twee foto's blijft hangen.
 *
 * Waarom geen bibliotheek: dit is een rij met `overflow: scroll` en een
 * teller. Wat een carrousel-bibliotheek daarbovenop biedt — oneindig
 * doorlopen, autoplay, meerdere zichtbaar — wil dit ontwerp geen van
 * alle.
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
  const scroller = useRef<ScrollView>(null);

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

  return (
    <View style={style} onLayout={onLayout}>
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
              transition={150}
              fallbackBg="bg-feed-post"
              fallbackColor={feed.inkDim}
            />
          </Pressable>
        ))}
      </ScrollView>

      {/* Pijlen: alleen op web, en alleen waar er nog iets te halen valt. */}
      {Platform.OS === "web" && urls.length > 1 ? (
        <>
          {index > 0 ? (
            <Arrow side="left" onPress={() => goTo(index - 1)} />
          ) : null}
          {index < urls.length - 1 ? (
            <Arrow side="right" onPress={() => goTo(index + 1)} />
          ) : null}
        </>
      ) : null}

      {urls.length > 1 ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 10,
            flexDirection: "row",
            justifyContent: "center",
            gap: 6,
          }}
        >
          {urls.map((_, i) => (
            <View
              key={i}
              style={{
                width: i === index ? 18 : 6,
                height: 6,
                backgroundColor: i === index ? "#FFFFFF" : "rgba(255,255,255,0.5)",
              }}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Arrow({ side, onPress }: { side: "left" | "right"; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        position: "absolute",
        top: "50%",
        marginTop: -20,
        [side]: 8,
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(11,10,12,0.55)",
      }}
    >
      <Ionicons
        name={side === "left" ? "chevron-back" : "chevron-forward"}
        size={22}
        color="#FFFFFF"
      />
    </Pressable>
  );
}
