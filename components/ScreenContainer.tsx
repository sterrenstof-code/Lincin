import { type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

/**
 * Mobile-first content wrapper. On narrow screens (phones) this is just a
 * full-width view. On wider screens (desktop/tablet web) it caps width at
 * 600px and centers horizontally so the app keeps its "phone column" feel
 * instead of stretching across a 1920px monitor.
 *
 * Always place this *inside* a SafeAreaView so the shell background still
 * fills the dark gutter on either side on desktop.
 */
export function ScreenContainer({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      className={`flex-1 w-full self-center ${className ?? ""}`}
      style={[{ maxWidth: 600 }, style]}
    >
      {children}
    </View>
  );
}
