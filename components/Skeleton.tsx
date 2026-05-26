import { useEffect, useRef } from "react";
import { Animated, View, type StyleProp, type ViewStyle } from "react-native";

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
      className={className ?? "bg-paper-warm h-4 rounded-full"}
      style={[style, { opacity }]}
    />
  );
}

// ----- Preset shapes -----

/** Single skeleton row matching a friend / chat list item. */
export function SkeletonListRow({ isLast = false }: { isLast?: boolean }) {
  return (
    <View
      className={`flex-row items-center px-4 py-3 ${
        isLast ? "" : "border-b border-line-paper/60"
      }`}
    >
      <Skeleton className="w-11 h-11 bg-paper-warm rounded-full" />
      <View className="flex-1 ml-3">
        <Skeleton className="w-32 h-3.5 bg-paper-warm rounded-full" />
        <View className="h-1.5" />
        <Skeleton className="w-48 h-3 bg-paper-warm rounded-full" />
      </View>
    </View>
  );
}

/** Stacked rows inside a paper-soft card, mimics the chats / friends list. */
export function SkeletonListCard({ rows = 3 }: { rows?: number }) {
  return (
    <View className="bg-paper-soft rounded-2xl overflow-hidden">
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonListRow key={i} isLast={i === rows - 1} />
      ))}
    </View>
  );
}

/** Skeleton for one full feed post card. */
export function SkeletonPostCard() {
  return (
    <View className="bg-paper-soft rounded-3xl overflow-hidden">
      <View className="flex-row items-center px-4 py-3">
        <Skeleton className="w-11 h-11 bg-paper-warm rounded-full" />
        <View className="flex-1 ml-3">
          <Skeleton className="w-32 h-3.5 bg-paper-warm rounded-full" />
          <View className="h-1.5" />
          <Skeleton className="w-20 h-3 bg-paper-warm rounded-full" />
        </View>
      </View>
      <Skeleton style={{ width: "100%", aspectRatio: 1, borderRadius: 0 }} />
      <View className="px-4 py-3">
        <Skeleton className="w-3/4 h-3.5 bg-paper-warm rounded-full" />
      </View>
    </View>
  );
}

/** 3-column gallery skeleton for the user profile page. */
export function SkeletonGallery({ tiles = 6 }: { tiles?: number }) {
  return (
    <View className="flex-row flex-wrap" style={{ marginHorizontal: -3 }}>
      {Array.from({ length: tiles }).map((_, i) => (
        <View key={i} className="w-1/3 p-[3px]">
          <Skeleton style={{ aspectRatio: 1, borderRadius: 12 }} />
        </View>
      ))}
    </View>
  );
}
