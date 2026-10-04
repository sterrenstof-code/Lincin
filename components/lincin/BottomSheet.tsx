import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Modal, Platform, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { color, useThemeSpec } from "@/lib/design/theme";

/**
 * De beweging van een blad: de sluier vervaagt (220 ms), het blad schuift
 * met een zachte uitloop (280 ms); dicht is korter en versnelt. `mounted`
 * blijft waar tot de sluitanimatie klaar is.
 */
export function useSheetMotion(visible: boolean) {
  const veil = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const native = Platform.OS !== "web";
  useEffect(() => {
    if (visible) setMounted(true);
    Animated.parallel([
      Animated.timing(veil, { toValue: visible ? 1 : 0, duration: visible ? 220 : 160, easing: Easing.out(Easing.quad), useNativeDriver: native }),
      Animated.timing(slide, {
        toValue: visible ? 1 : 0,
        duration: visible ? 280 : 180,
        easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: native,
      }),
    ]).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, veil, slide, native]);
  return { mounted, veil, slide };
}

/**
 * Een blad dat van onder over de pagina schuift (likes, wie stemde, een
 * bericht aan een vriend).
 *
 * Hier stond `Modal animationType="slide"`, en die schuift het hele venster
 * — ook de sluier. Je zag de donkere laag als een rolluik van onder naar
 * boven komen. Nu doen we de beweging zelf, zoals `ModalShell`: de sluier
 * blijft staan en vervaagt in 220 ms, alleen het blad schuift, met een
 * zachte uitloop; dichtgaan is korter en versnelt. Het venster blijft
 * gemonteerd tot de animatie klaar is, anders is er niets te zien.
 */
export function BottomSheet({
  visible,
  onClose,
  children,
  maxWidth = 520,
  maxHeight = 0.66,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Op een breed scherm een blad in het midden, niet de hele breedte. */
  maxWidth?: number;
  /** Hoogstens dit deel van het venster. */
  maxHeight?: number;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const modern = useThemeSpec().id === "modern";
  const { mounted, veil, slide } = useSheetMotion(visible);
  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Animated.View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(22,22,15,.45)", opacity: veil }}>
          <Pressable onPress={onClose} accessible={false} importantForAccessibility="no" style={{ width: "100%", height: "100%" }} />
        </Animated.View>
        <Animated.View
          style={{
            width: "100%",
            maxWidth,
            alignSelf: "center",
            maxHeight: height * maxHeight,
            backgroundColor: color("paper"),
            borderTopWidth: modern ? 0 : 2,
            borderTopColor: color("ink"),
            borderTopLeftRadius: modern ? 22 : 0,
            borderTopRightRadius: modern ? 22 : 0,
            paddingBottom: insets.bottom + 12,
            transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [Math.min(height, 700), 0] }) }],
          }}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}
