import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { feed, FEED_BORDER, feedType, space } from "@/lib/design/type";

/**
 * De vorm en de beweging van élk venster in deze app.
 *
 * ---------------------------------------------------------------
 * WAAROM IN HET MIDDEN, EN WAAROM VERVAGEN
 * ---------------------------------------------------------------
 * De vensters kwamen als blad van onderen omhoog. Dat is het patroon van
 * een telefoon-app: daar is de onderrand waar je duim zit. Op een breed
 * scherm is diezelfde rand juist de plek waar je níet kijkt, en dan trekt
 * een blad dat daarvandaan komt zetten je aandacht naar de verkeerde hoek
 * terwijl je vraag in het midden staat.
 *
 * Dus: in het midden, en het donkere vlak erachter komt op in plaats van er
 * ineens te zijn. Een harde zwarte laag over een pagina leest als een
 * storing; dezelfde laag die in tweehonderd milliseconden opkomt leest als
 * "even dit eerst".
 *
 * Het venster zelf komt met dat vlak mee: een tikje kleiner en iets lager,
 * naar zijn plek toe. Eén beweging, dezelfde kromme als elders in de app.
 */
export function ModalShell({
  visible,
  onClose,
  title,
  children,
  /** Breedte-plafond; een lijst mag smaller blijven dan een formulier. */
  maxWidth = 460,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  maxWidth?: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const { height } = useWindowDimensions();

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 200 : 140,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [visible, anim]);

  return (
    <Modal
      visible={visible}
      // De beweging doen we zelf; `animationType` zou er een tweede
      // overheen leggen.
      animationType="none"
      transparent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "center", padding: space.lg }}>
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(11,10,12,0.55)",
            opacity: anim,
          }}
        >
          <Pressable
            onPress={onClose}
            style={{ width: "100%", height: "100%" }}
            accessibilityLabel="Sluiten"
          />
        </Animated.View>

        <Animated.View
          style={{
            width: "100%",
            maxWidth,
            alignSelf: "center",
            maxHeight: height * 0.8,
            backgroundColor: feed.lav,
            borderWidth: FEED_BORDER,
            borderColor: feed.ink,
            opacity: anim,
            transform: [
              { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
              { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            ],
          }}
        >
          {title ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                borderBottomWidth: FEED_BORDER,
                borderBottomColor: feed.ink,
              }}
            >
              <Text
                style={[
                  feedType.kicker,
                  { color: feed.inkDim, letterSpacing: 0.6, flex: 1 },
                ]}
                numberOfLines={1}
              >
                {title.toUpperCase()}
              </Text>
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
