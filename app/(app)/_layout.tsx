import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { useAuth } from "@/lib/auth/provider";
import { bootstrapProfile } from "@/lib/auth/bootstrap";
import { listMyChats } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { subscribeToAllMyMessages } from "@/lib/api/messages";
import { addNotificationTapListener, registerPushToken } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";
import { InstallBanner } from "@/components/InstallBanner";

export default function AppLayout() {
  const { session, loading, hasPassword } = useAuth();
  const [bootstrapping, setBootstrapping] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        await bootstrapProfile({
          userId: session.user.id,
          email: session.user.email ?? "unknown@example.com",
        });
      } catch (err) {
        console.warn("bootstrapProfile failed", err);
      } finally {
        setBootstrapping(false);
      }
    })();
  }, [session]);

  // Totaal aantal ongelezen berichten over alle chats — toont op de
  // Chats-tab als badge zodat je ziet wanneer iemand jou geschreven heeft.
  // Friend-requests krijgen géén tab-badge (te ruis), enkel de incoming-
  // teller op de Vrienden-pagina zelf.
  //
  // We hoeven niet meer aggressief te pollen want we hebben een globale
  // realtime subscription die de query invalideert bij elk inkomend bericht.
  // refetchOnWindowFocus vangt netwerk-blips op: keer terug naar de tab en
  // we trekken meteen de actuele state binnen (catch-up voor wat realtime
  // tijdens disconnect heeft gemist).
  const chats = useQuery({
    queryKey: ["chats", session?.user.id ?? "anon"],
    queryFn: () => listMyChats(session!.user.id),
    enabled: !!session && !bootstrapping && hasPassword,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const totalUnread = (chats.data ?? []).reduce(
    (sum, c) => sum + (c.unread_count ?? 0),
    0
  );

  // Inkomende vriendschapsverzoeken — telt enkel pending requests die naar
  // mij zijn gestuurd (addressee_id == mij). Hetzelfde patroon als de chat-
  // unread badge: een vlam-pil op de Vrienden-tab + meegerekend in de
  // browser tab-titel zodat je het ziet in een andere tab.
  //
  // refetchInterval 60s is genoeg — vriendschapsverzoeken zijn lage-frequentie
  // events. Geen aparte realtime subscription nodig.
  const friendships = useQuery({
    queryKey: ["friendships", session?.user.id ?? "anon"],
    queryFn: () => listMyFriendships(session!.user.id),
    enabled: !!session && !bootstrapping && hasPassword,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const pendingIncoming = (friendships.data ?? []).filter(
    (f) =>
      f.status === "pending" && f.addressee_id === (session?.user.id ?? "")
  ).length;

  // Globale realtime: zodra er ergens in een van mijn chats een nieuw
  // bericht valt, invalideren we de chatlijst zodat de bottom-bar badge,
  // de chats-screen, én eventuele "laatst bericht" previews direct
  // updaten. Telegram-snel — geen 30s poll-wait meer.
  useEffect(() => {
    if (!session || bootstrapping || !hasPassword) return;
    const myId = session.user.id;
    const channel = subscribeToAllMyMessages(myId, () => {
      qc.invalidateQueries({ queryKey: ["chats", myId] });
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, bootstrapping, hasPassword, qc]);

  // Web: zet ongelezen-aantal in de browser tab-titel zodat je het ziet
  // wanneer Lincin in een andere tab open staat. Poor-man's web push.
  //
  // We tellen chat-unreads + inkomende friend-requests samen op — dat is
  // wat de gebruiker wil weten ("is er iets nieuws voor mij?"). De badges
  // op de tabs zelf blijven afzonderlijk (chats vs vrienden) zodat
  // gebruikers in de app zien WAT er nieuw is.
  const totalAttention = totalUnread + pendingIncoming;
  useEffect(() => {
    if (typeof document === "undefined") return;
    const base = "Lincin";
    document.title =
      totalAttention > 0
        ? `(${totalAttention > 99 ? "99+" : totalAttention}) ${base}`
        : base;
    return () => {
      document.title = base;
    };
  }, [totalAttention]);

  // PWA app-icoon badge — toont het ongelezen-aantal op het homescreen-icoon,
  // net als WhatsApp/Telegram. Werkt op iOS 16.4+ PWA en Chrome Android/desktop.
  // In de browser zelf wordt dit stil genegeerd.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    if (totalAttention > 0) {
      (navigator as any).setAppBadge(totalAttention).catch(() => {});
    } else {
      (navigator as any).clearAppBadge().catch(() => {});
    }
  }, [totalAttention]);

  useEffect(() => {
    if (!session || bootstrapping || !hasPassword) return;
    registerPushToken(session.user.id).catch(() => {});
  }, [session, bootstrapping, hasPassword]);

  // Native: expo-notifications tap listener
  useEffect(() => {
    return addNotificationTapListener((data) => {
      if (data?.chat_id) {
        import("expo-router").then(({ router }) => {
          router.push(`/chat/${data.chat_id}`);
        });
      } else if (data?.post_id) {
        import("expo-router").then(({ router }) => {
          router.push(`/post/${data.post_id}`);
        });
      }
    });
  }, []);

  // Web: service worker stuurt een postMessage na notificatieklik zodat
  // expo-router de navigatie kan oppakken zonder een full page reload.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    function onMessage(event: MessageEvent) {
      if (event.data?.type !== "PUSH_NAV") return;
      const path = event.data.path as string;
      if (!path) return;
      import("expo-router").then(({ router }) => {
        router.push(path as any);
      });
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/login" />;
  if (!hasPassword) return <Redirect href="/set-password" />;

  if (bootstrapping) {
    return (
      <View className="flex-1 items-center justify-center bg-shell">
        <ActivityIndicator color="#F5E8D3" />
      </View>
    );
  }

  return (
    <>
    <InstallBanner />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#15141A",
          borderTopColor: "#2A2620",
          borderTopWidth: 1,
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: "#1A1714",
        tabBarInactiveTintColor: "#8A8275",
        tabBarShowLabel: false,
        tabBarItemStyle: { paddingHorizontal: 4 },
        tabBarBadgeStyle: {
          backgroundColor: "#E66B3F",
          color: "#F5E8D3",
          fontSize: 10,
          fontWeight: "700",
          minWidth: 18,
          height: 18,
          lineHeight: 18,
        },
      }}
      tabBar={(props) => (
        <PaperTabBar
          {...props}
          totalUnread={totalUnread}
          pendingFriendRequests={pendingIncoming}
        />
      )}
    >
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="profile" />
    </Tabs>
    </>
  );
}

/**
 * Custom tab bar geïnspireerd op de screenshot referentie: een paper-warm
 * pil rondom de actieve tab, cream icoon op shell achtergrond voor inactieve.
 */
function PaperTabBar({
  state,
  descriptors,
  navigation,
  totalUnread,
  pendingFriendRequests,
}: any) {
  const tabs: Array<{
    key: string;
    routeName: string;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  }> = [
    { key: "feed", routeName: "feed", icon: "images-outline", label: "Feed" },
    // Events-tab tijdelijk verborgen tot de feature productie-klaar is.
    // De Tabs.Screen route hieronder blijft staan zodat directe URLs en de
    // feed-link niet breken — alleen het tab-knopje is weg.
    // { key: "events", routeName: "events", icon: "sparkles-outline", label: "Events" },
    { key: "chats", routeName: "chats", icon: "chatbubbles-outline", label: "Chats" },
    { key: "friends", routeName: "friends", icon: "people-outline", label: "Vrienden" },
    { key: "profile", routeName: "profile", icon: "person-outline", label: "Profiel" },
  ];

  return (
    <View className="bg-shell-soft border-t border-line">
      <View
        className="flex-row items-center py-2 px-3 self-center"
        style={{ width: "100%", maxWidth: 600 }}
      >
        {tabs.map((tab, index) => {
          const route = state.routes.find((r: any) => r.name === tab.routeName);
          if (!route) return null;
          const isFocused =
            state.index === state.routes.findIndex((r: any) => r.name === tab.routeName);
          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };
          // Per-tab badge: chats = ongelezen berichten, friends = inkomende
          // friend-requests. Beide gebruiken dezelfde flame-pill styling
          // (consistente visuele taal voor "er is iets dat aandacht vraagt").
          let badge = 0;
          if (tab.routeName === "chats") badge = totalUnread;
          else if (tab.routeName === "friends") badge = pendingFriendRequests ?? 0;

          return (
            <Pressable
              key={tab.key}
              onPress={onPress}
              className={`flex-1 items-center justify-center py-2 mx-0.5 rounded-full ${
                isFocused ? "bg-paper-warm" : ""
              }`}
            >
              <View>
                <Ionicons
                  name={tab.icon}
                  size={isFocused ? 18 : 20}
                  color={isFocused ? "#1A1714" : "#8A8275"}
                />
                {badge > 0 && (
                  <View
                    className="bg-flame rounded-full absolute -right-2 -top-1.5 px-1.5"
                    style={{ minWidth: 16, height: 16, alignItems: "center", justifyContent: "center" }}
                  >
                    <Text className="text-cream text-[9px] font-bold">
                      {badge > 99 ? "99+" : badge}
                    </Text>
                  </View>
                )}
              </View>
              {isFocused && (
                <Text className="text-ink text-[10px] font-semibold mt-0.5">
                  {tab.label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
