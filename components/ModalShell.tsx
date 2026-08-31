import { useEffect, useRef, useState, type ReactNode } from "react";
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

import { IconButton } from "@/components/IconButton";
import { CONTROL_H, feed, FEED_BORDER, feedType, space } from "@/lib/design/type";

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
  /**
   * Of er überhaupt een `Modal` in de boom hangt.
   *
   * ---------------------------------------------------------------
   * WAAROM DIT NIET GEWOON `visible` IS
   * ---------------------------------------------------------------
   * De `Modal` stond hier onvoorwaardelijk, met alleen zijn eigen
   * `visible`-prop uit. Dat leek gratis en was het niet. `usePostMenu` in de
   * feed wordt per tegel aangeroepen en levert een `ActionSheet` plus een
   * `ModalShell` terug, dus twintig eigen vondsten op het scherm betekende
   * veertig gemonteerde vensters — elk met hun eigen animatie die bij het
   * monteren afloopt, en één ervan met een `autoFocus`-invoerveld erin. Een
   * veld dat focus grijpt in een venster dat niemand ziet is op web een
   * scherm dat zonder aanleiding naar beneden springt.
   *
   * Maar hij mag ook niet meteen verdwijnen als `visible` op `false` gaat:
   * dan is het venster weg vóórdat de 140ms van het wegvallen gelopen heeft,
   * en dat is precies de beweging die dit bestand beschrijft. Vandaar één
   * stand extra: gemonteerd blijven tot de animatie klaar is.
   */
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
    Animated.timing(anim, {
      toValue: visible ? 1 : 0,
      duration: visible ? 200 : 140,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
  }, [visible, anim]);

  if (!mounted) return null;

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
          {/* De sluier sluit ook, maar hij is geen knop: hij heet nergens
              iets. Zolang hij "Sluiten" heette waren er voor een schermlezer
              twee knoppen met dezelfde naam — de echte staat nu in de kop. */}
          <Pressable
            onPress={onClose}
            accessible={false}
            importantForAccessibility="no"
            style={{ width: "100%", height: "100%" }}
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
                paddingLeft: space.lg,
                paddingRight: space.md,
                // De knop is zelf CONTROL_H hoog; een eigen verticale marge
                // erbovenop zou de kopbalk hoger maken dan zijn inhoud.
                minHeight: CONTROL_H,
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
              {/**
                * De enige zichtbare manier om dit venster te sluiten.
                *
                * Er was er geen. Het venster ging dicht door naast de doos
                * te tikken — een onzichtbare `Pressable` over de sluier —
                * en verder nergens aan te zien. Wie dat gebaar niet kent,
                * en wie het venster met een toetsenbord bedient, zat vast
                * aan het venster tot hij toevallig raak klikte. Op native
                * vangt de terug-knop het nog op; op web, het hoofdplatform,
                * is er niets.
                *
                * `IconButton` en geen los kruisje: §7 wil een échte doos van
                * 44 punten, want `hitSlop` valt op web weg.
                */}
              <IconButton
                name="close"
                label="Sluiten"
                onPress={onClose}
                size={18}
                color={feed.ink}
                dense
                style={{ marginRight: -space.sm }}
              />
            </View>
          ) : null}

          <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
