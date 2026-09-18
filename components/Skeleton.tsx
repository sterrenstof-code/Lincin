import { useEffect, useRef } from "react";
import { Animated, View, type StyleProp, type ViewStyle } from "react-native";

import { feed, FEED_BORDER, space } from "@/lib/design/type";

/**
 * Animated placeholder for loading content. Pulses opacity between 0.4 and 0.8
 * on a 1.6s loop, with the same paper-warm fill so it sits naturally inside
 * paper-soft cards in our design system.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.45,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      className={className ?? "h-4"}
      style={[
        // Was ``. Toen het omhulsel zijn vulling verloor stond
        // die balk niet meer op `panel` maar op `page`, en dat is in de
        // donkere stand 1,19:1 — een balk die je niet ziet is geen balk.
        // `postRule` is inkt op lage dekking: hij leest op béide vlakken.
        { backgroundColor: feed.postRule },
        style,
        { opacity },
      ]}
    />
  );
}

// ----- Preset shapes -----

/** Single skeleton row matching a friend / chat list item. */
function SkeletonListRow({ isLast = false }: { isLast?: boolean }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: space.lg,
        paddingVertical: space.md,
        ...(isLast
          ? null
          : { borderBottomWidth: FEED_BORDER, borderBottomColor: feed.postRule }),
      }}
    >
      <Skeleton className="w-11 h-11" />
      <View className="flex-1 ml-3">
        <Skeleton className="w-32 h-3.5" />
        <View className="h-1.5" />
        <Skeleton className="w-48 h-3" />
      </View>
    </View>
  );
}

/**
 * De lijst zoals hij eruitziet vóór hij er is.
 *
 * Stond op `bg-paper-soft` terwijl de lijst die hij nabootst zijn vulling
 * kwijt is (§4) — dan is het laden een grijs blok en het resultaat een
 * kader, en dat springt.
 */
export function SkeletonListCard({ rows = 3 }: { rows?: number }) {
  return (
    <View style={{ borderWidth: FEED_BORDER, borderColor: feed.ink }}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonListRow key={i} isLast={i === rows - 1} />
      ))}
    </View>
  );
}
