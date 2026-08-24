import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

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
export function FeedRail({
  displayName,
  avatarUrl,
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
      <Pressable
        onPress={onShare}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingHorizontal: space.lg,
          height: 56,
          backgroundColor: pressed ? announceDeep : announce,
        })}
      >
        <Ionicons name="add" size={26} color={feed.text} />
        <Text
          style={[feedType.tile, { fontSize: 16, fontWeight: "800", color: feed.text }]}
        >
          Delen
        </Text>
      </Pressable>
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
