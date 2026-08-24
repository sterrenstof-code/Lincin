import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import {
  announce,
  announceDeep,
  feed,
  FEED_BORDER,
  feedType,
  flame,
  space,
} from "@/lib/design/type";

/**
 * De chrome van het feed-scherm: het kader en het persoonlijke blok.
 *
 * Alles hier is rechthoekig en omkaderd met één lijndikte (`FEED_BORDER`,
 * 1.5px). De enige ronding in dit hele scherm is de avatar — dat is de
 * regel uit DESIGN.md §7 ("geen tweede navigatiebalk").
 *
 * De kaders staan in `style` en niet in een `border-[1.5px]`-class. Dat is
 * dezelfde afweging die de oude `Band` in feed.tsx al maakte voor de
 * kolomrichting: als NativeWind om welke reden dan ook niet meedoet (stale
 * CSS na een config-wijziging, Metro-cache), zou het hele rasterontwerp
 * stilletjes uit elkaar vallen.
 */

// ---------------------------------------------------------------
// Kader
// ---------------------------------------------------------------

/** Een gekaderd vlak. De bouwsteen van dit hele scherm. */
export function Frame({
  children,
  style,
  filled = false,
}: {
  children: ReactNode;
  style?: ViewStyle;
  /** Paneelvulling (`feed-panel`) — alleen voor chrome, nooit voor posts. */
  filled?: boolean;
}) {
  return (
    <View
      style={{
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        ...(filled ? { backgroundColor: feed.panel } : null),
        ...style,
      }}
    >
      {children}
    </View>
  );
}

// ---------------------------------------------------------------
// De zijbalk
// ---------------------------------------------------------------

/**
 * De zijbalk is het **persoonlijke blok**: wie je bent, en alles wat over
 * jou gaat in plaats van over de uitgave. Delen, je meldingen, je profiel,
 * je instellingen.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT HIER STAAT EN NIET IN DE KOP
 * ---------------------------------------------------------------
 * De kop (`AppChrome`) droeg dit eerder: een micro-utilityregel met
 * "Instellingen · Meldingen" en een actieknop rechts in de balk. Dat
 * mengde twee soorten dingen door elkaar. De kop navigeert tussen de
 * **rubrieken van de uitgave** — feed, events, chats, vrienden — en dat
 * zijn plekken die voor iedereen hetzelfde zijn. Meldingen en instellingen
 * zijn van jou alleen; die horen bij je naam en je avatar, niet tussen de
 * rubrieken.
 *
 * Het is géén navigatiemenu: de tabstrip blijft de enige navigatie
 * (DESIGN.md §7). Dit blok is de rest.
 *
 * Op desktop een kolom van 200px met een scheidingslijn rechts; onder het
 * breekpunt kantelt hij naar een liggend blok.
 */
/**
 * De knop om iets te delen: een oranje rondje met een plus.
 *
 * De enige ronding in dit ontwerp naast de avatar, en met opzet: alles
 * hier is vierkant, dus een cirkel is per definitie geen kader, geen tegel
 * en geen vlak — hij ligt erbovenop. Dat is precies wat hij is.
 *
 * Hij staat zowel in de zijbalk als los op een smal scherm; daar zweeft
 * hij rechtsonder mee, want de zijbalk scrolt daar weg.
 */
export function ShareButton({
  onPress,
  size = 56,
}: {
  onPress: () => void;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: pressed ? announceDeep : announce,
      })}
    >
      <Ionicons name="add" size={Math.round(size * 0.5)} color={feed.text} />
    </Pressable>
  );
}

/**
 * De deelknop met zijn woord ernaast.
 *
 * Bovenaan staat er "Delen" naast het rondje; ben je voorbij de kop, dan
 * blijft alleen het rondje over. Dat gebeurt niet met een sprong maar met
 * een beweging: het woord vervaagt en schuift naar het rondje toe terwijl
 * de ruimte die het innam dichttrekt. Een element dat plots verdwijnt leest
 * als een fout; hetzelfde element dat wegtrekt leest als een keuze.
 */
function ShareAction({ onPress, compact }: { onPress: () => void; compact: boolean }) {
  const open = useRef(new Animated.Value(compact ? 0 : 1)).current;

  useEffect(() => {
    Animated.timing(open, {
      toValue: compact ? 0 : 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      // Breedte animeren kan de native driver niet.
      useNativeDriver: false,
    }).start();
  }, [compact, open]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <ShareButton onPress={onPress} />
      <Animated.View
        style={{
          opacity: open,
          marginLeft: open.interpolate({ inputRange: [0, 1], outputRange: [0, space.md] }),
          maxWidth: open.interpolate({ inputRange: [0, 1], outputRange: [0, 160] }),
          transform: [
            { translateX: open.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) },
          ],
          overflow: "hidden",
        }}
      >
        <Text
          style={[feedType.tile, { fontSize: 16, fontWeight: "800", color: feed.ink }]}
          numberOfLines={1}
        >
          Delen
        </Text>
      </Animated.View>
    </View>
  );
}

export function FeedRail({
  displayName,
  avatarUrl,
  compactShare = false,
  onShare,
  onProfile,
  onNotifications,
  onSettings,
  unreadNotifications = 0,
  wide,
}: {
  displayName: string;
  avatarUrl?: string | null;
  onShare: () => void;
  onProfile: () => void;
  onNotifications: () => void;
  onSettings: () => void;
  /** Ongelezen meldingen. Alleen een getal als er iets ligt. */
  unreadNotifications?: number;
  wide: boolean;
  /**
   * Ben je voorbij de bovenkant gescrold, dan krimpt de deelknop tot alleen
   * de plus. Bovenaan mag hij zeggen wat hij doet; daarna weet je dat, en
   * dan is een vlak van vijftig pixels naast je leeslijst alleen nog een
   * vlak van vijftig pixels.
   */
  compactShare?: boolean;
}) {
  const identity = (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {/* De enige ronding in dit scherm. */}
      <Avatar name={displayName} avatarUrl={avatarUrl} size="sm" tint="light" />
      <View style={{ flex: 1, paddingLeft: 10, minWidth: 0 }}>
        <Text
          style={[feedType.label, { fontSize: 13, fontWeight: "700", color: feed.ink }]}
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Pressable onPress={onProfile} hitSlop={6}>
          <Text
            style={[feedType.label, { color: feed.ink, opacity: 0.65, marginTop: 2 }]}
          >
            Bekijk profiel
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const actions = (
    <>
      {/*
          Delen was een zwarte balk met "Iets delen" erin, tussen twee
          tekstregels die net zo breed waren. Eén van de drie was de reden
          dat je hier komt, en dat zag je er niet aan af.

          Nu één groot oranje vlak met een plus. Wát je deelt kies je erna:
          de vraag "foto, link of notitie?" hoort bij het delen zelf en niet
          bij de knop ernaartoe.
      */}
      <ShareAction onPress={onShare} compact={compactShare} />
      <RailLink
        label="Meldingen"
        badge={unreadNotifications}
        onPress={onNotifications}
      />
      <RailLink label="Instellingen" onPress={onSettings} />
    </>
  );

  if (!wide) {
    return (
      <View
        style={{
          backgroundColor: feed.panel,
          padding: 20,
          borderBottomWidth: FEED_BORDER,
          borderBottomColor: feed.ink,
        }}
      >
        <Text
          style={[feedType.kicker, { color: feed.ink, opacity: 0.6, marginBottom: 12 }]}
        >
          PERSOONLIJK
        </Text>
        {identity}
        <View
          style={{
            borderTopWidth: FEED_BORDER,
            borderTopColor: feed.ink,
            paddingTop: 16,
            marginTop: 16,
          }}
        >
          {actions}
        </View>
      </View>
    );
  }

  return (
    <View
      style={{
        width: 200,
        backgroundColor: feed.panel,
        padding: 20,
        borderRightWidth: FEED_BORDER,
        borderRightColor: feed.ink,
      }}
    >
      <Text
        style={[feedType.kicker, { color: feed.ink, opacity: 0.6, marginBottom: 12 }]}
      >
        PERSOONLIJK
      </Text>
      {identity}
      <View
        style={{
          borderTopWidth: FEED_BORDER,
          borderTopColor: feed.ink,
          paddingTop: 16,
          marginTop: 16,
        }}
      >
        {actions}
      </View>
    </View>
  );
}

/**
 * Eén regel in het persoonlijke blok. Geen icoon en geen kader: dit staat
 * onder een knop die wél gevuld is, en drie gelijkwaardige vlakken onder
 * elkaar zou de hiërarchie platslaan.
 */
function RailLink({
  label,
  badge = 0,
  onPress,
}: {
  label: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 9,
        marginTop: 4,
      }}
      hitSlop={4}
    >
      <Text style={[feedType.label, { color: feed.ink, flex: 1 }]} numberOfLines={1}>
        {label}
      </Text>
      {badge > 0 ? (
        <View style={{ backgroundColor: flame, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={[feedType.kicker, { color: "#FFFFFF" }]}>
            {badge > 99 ? "99+" : String(badge)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
