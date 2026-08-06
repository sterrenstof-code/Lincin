import { usePathname, useRouter, type Href } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View, type ViewStyle } from "react-native";

import { Avatar } from "@/components/Avatar";
import { BoxButton } from "@/components/Editorial";
import { feed, FEED_BORDER, feedType } from "@/lib/design/type";

/**
 * De chrome van het feed-scherm: de gekaderde kop en de zijbalk.
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

/** Horizontale scheiding binnen een kader — zelfde dikte als het kader. */
function Divider() {
  return <View style={{ height: FEED_BORDER, backgroundColor: feed.ink }} />;
}

// ---------------------------------------------------------------
// De kop
// ---------------------------------------------------------------

/**
 * De tabstrip gebruikt de échte routes uit `app/(app)/_layout.tsx` — er
 * wordt hier geen eigen navigatieset verzonnen. Meldingen zit niet in de
 * strip maar in de micro-utilityregel erboven, precies zoals in het ontwerp.
 */
// `as const satisfies`: de literals blijven behouden (nodig als React-key
// én voor de gegenereerde route-types), en `satisfies` bewaakt dat elke
// href een bestaande route is. Met een kale `Href`-annotatie zou het type
// de object-vorm meenemen, en die kan geen key zijn.
const TABS = [
  { href: "/feed", label: "Feed" },
  { href: "/events", label: "Events" },
  { href: "/chats", label: "Chats" },
  { href: "/friends", label: "Vrienden" },
  { href: "/profile", label: "Profiel" },
] as const satisfies readonly { href: Href; label: string }[];

export function FeedHeader({ wide }: { wide: boolean }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <Frame>
      {/* Rij A — micro-utility, drie gelijke kolommen. Het woordmerk staat
          hier als platte tekst; het merkteken krijgt zijn eigen plaat
          direct onder deze kop. */}
      <View style={{ flexDirection: "row" }}>
        <View style={{ flex: 1 }} className="px-3.5 py-2.5">
          <Text style={[feedType.micro, { color: feed.ink, fontSize: 13, fontWeight: "800" }]}>
            Lincin
          </Text>
        </View>
        <View style={{ flex: 1 }} className="px-3.5 py-2.5">
          {wide ? (
            <Text
              style={[feedType.label, { color: "#3A3540", textAlign: "center" }]}
            >
              Voor je vrienden.
            </Text>
          ) : null}
        </View>
        <View
          style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end" }}
          className="px-3.5 py-2.5"
        >
          <Pressable onPress={() => router.push("/profile-edit")} hitSlop={6}>
            <Text style={[feedType.label, { color: feed.ink }]}>Instellingen</Text>
          </Pressable>
          <Text style={[feedType.label, { color: feed.ink, marginHorizontal: 5 }]}>
            ·
          </Text>
          {/* `as never`: de gegenereerde typed routes in `.expo/types` zijn
              verouderd en kennen /notifications niet. Zelfde workaround als
              SharedListCard al gebruikt voor /list/[id]. */}
          <Pressable onPress={() => router.push("/notifications")} hitSlop={6}>
            <Text style={[feedType.label, { color: feed.ink }]}>Meldingen</Text>
          </Pressable>
        </View>
      </View>

      <Divider />

      {/* Rij B — de gesegmenteerde tabstrip. Actieve cel omgekeerd: inkt
          vlak met lavendel tekst, precies zoals in de mockup. */}
      <View style={{ flexDirection: "row" }}>
        {TABS.map((tab, i) => {
          const active = pathname === tab.href;
          return (
            <Pressable
              key={tab.href}
              onPress={() => {
                if (!active) router.push(tab.href);
              }}
              style={{
                flex: 1,
                backgroundColor: active ? feed.ink : "transparent",
                ...(i < TABS.length - 1
                  ? { borderRightWidth: FEED_BORDER, borderRightColor: feed.ink }
                  : null),
              }}
              className="py-3 px-2 items-center"
            >
              <Text
                style={[
                  feedType.label,
                  { fontSize: 12, color: active ? feed.lav : feed.ink },
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Divider />

      {/* Rij C — de tagline als échte kop, aankondiging rechtsonder. */}
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          justifyContent: "space-between",
          alignItems: wide ? "flex-end" : "flex-start",
          paddingHorizontal: 18,
          paddingTop: 22,
          paddingBottom: 26,
        }}
      >
        <Text
          style={[
            wide ? feedType.tagline : feedType.taglineSmall,
            { color: feed.ink, maxWidth: 520 },
          ]}
        >
          Ontdekkingen van je vrienden — links, fragmenten, muziek en ideeën.
        </Text>
        <Pressable
          onPress={() => router.push("/notifications")}
          style={{ marginTop: wide ? 0 : 12, marginLeft: wide ? 24 : 0 }}
        >
          <Text
            style={[
              feedType.label,
              { fontSize: 12, color: feed.ink, textDecorationLine: "underline" },
            ]}
          >
            Aankondiging: nieuwe functie deze week ↗
          </Text>
        </Pressable>
      </View>
    </Frame>
  );
}

// ---------------------------------------------------------------
// De zijbalk
// ---------------------------------------------------------------

/**
 * De zijbalk is géén navigatiemenu — die zit al in de tabstrip hierboven.
 * Er staat alleen wat je hier nieuw kunt doen, plus wie je bent.
 *
 * Op desktop een kolom van 200px met een scheidingslijn rechts; onder het
 * breekpunt kantelt hij naar een rij met de scheidingslijn tussen CTA en
 * account, zoals de media-query in de mockup.
 */
export function FeedRail({
  displayName,
  avatarUrl,
  onShare,
  onProfile,
  wide,
}: {
  displayName: string;
  avatarUrl?: string | null;
  onShare: () => void;
  onProfile: () => void;
  wide: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: feed.panel,
        padding: 20,
        ...(wide
          ? {
              width: 200,
              borderRightWidth: FEED_BORDER,
              borderRightColor: feed.ink,
              justifyContent: "space-between",
            }
          : {
              borderBottomWidth: FEED_BORDER,
              borderBottomColor: feed.ink,
              flexDirection: "row",
              alignItems: "center",
            }),
      }}
    >
      <View style={wide ? undefined : { flex: 1 }}>
        <Text
          style={[
            feedType.kicker,
            { color: feed.ink, opacity: 0.6, marginBottom: 10 },
          ]}
        >
          NIEUW
        </Text>
        {/* Hergebruikt BoxButton met de feed-toon — geen tweede knop-
            component voor dit scherm. */}
        <BoxButton tone="feed" label="Iets delen" filled block onPress={onShare} />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          ...(wide
            ? {
                borderTopWidth: FEED_BORDER,
                borderTopColor: feed.ink,
                paddingTop: 16,
                marginTop: 16,
              }
            : {
                borderLeftWidth: FEED_BORDER,
                borderLeftColor: feed.ink,
                paddingLeft: 16,
                marginLeft: 16,
              }),
        }}
      >
        {/* De enige ronding in dit scherm. */}
        <Avatar name={displayName} avatarUrl={avatarUrl} size="sm" tint="light" />
        <View style={{ flex: 1, paddingLeft: 10 }}>
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
    </View>
  );
}
