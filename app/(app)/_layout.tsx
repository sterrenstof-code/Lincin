import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, Tabs, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth/provider";
import { bootstrapProfile } from "@/lib/auth/bootstrap";
import { listMyChats } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { subscribeToAllMyMessages } from "@/lib/api/messages";
import { countUnreadNotifications, subscribeToNotifications } from "@/lib/api/notifications";
import { touchLastSeen } from "@/lib/api/profiles";
import { addNotificationTapListener, registerPushToken } from "@/lib/push";
import { supabase } from "@/lib/supabase/client";
import { InstallBanner } from "@/components/InstallBanner";
import { tabScreenLayout } from "@/components/PageTransition";
import { creamOnDark, desk, feed, flame } from "@/lib/design/type";

export default function AppLayout() {
  const { session, loading, hasPassword } = useAuth();
  const router = useRouter();
  const [bootstrapping, setBootstrapping] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    if (!session) return;
    runBootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function runBootstrap() {
    try {
      await bootstrapProfile({
        userId: session!.user.id,
        email: session!.user.email ?? "unknown@example.com",
      });
    } catch (err) {
      console.warn("bootstrapProfile failed", err);
    }
    setBootstrapping(false);
  }

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

  const unreadNotifications = useQuery({
    queryKey: ["notifications-unread", session?.user.id ?? "anon"],
    queryFn: () => countUnreadNotifications(session!.user.id),
    enabled: !!session && !bootstrapping && hasPassword,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

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

  // Realtime: nieuwe notificaties invalideren de badge teller direct
  useEffect(() => {
    if (!session || bootstrapping || !hasPassword) return;
    const myId = session.user.id;
    const channel = subscribeToNotifications(myId, () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread", myId] });
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
  const unreadNotifCount = unreadNotifications.data ?? 0;
  const totalAttention = totalUnread + pendingIncoming + unreadNotifCount;
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

  // Activiteitsindicator: update last_seen_at bij opstarten + elke 2 min
  useEffect(() => {
    if (!session || bootstrapping || !hasPassword) return;
    const myId = session.user.id;
    touchLastSeen(myId).catch(() => {});
    const interval = setInterval(() => touchLastSeen(myId).catch(() => {}), 2 * 60 * 1000);
    return () => clearInterval(interval);
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
      } else if (data?.event_id) {
        import("expo-router").then(({ router }) => {
          router.push(`/event/${data.event_id}`);
        });
      } else if (data?.bug_report_id) {
        import("expo-router").then(({ router }) => {
          router.push("/bugs");
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
      <View className="flex-1 items-center justify-center bg-desk">
        <ActivityIndicator color={desk.ink} />
      </View>
    );
  }

  return (
    <>
    <InstallBanner />
    <Tabs
      // Een tabwissel krijgt van deze navigator zelf geen animatie: hij
      // toont en verbergt gemounte schermen. Op web dekt de View
      // Transition dat af (de tabs navigeren via router.push in AppChrome),
      // maar op native — en in een browser zonder die API — knippert het
      // zonder deze laag. Zie components/PageTransition.tsx.
      screenLayout={tabScreenLayout}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: feed.panel,
          borderTopColor: feed.ink,
          borderTopWidth: 1,
          height: 68,
          paddingTop: 8,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: feed.ink,
        tabBarInactiveTintColor: feed.inkDim,
        tabBarShowLabel: false,
        tabBarItemStyle: { paddingHorizontal: 4 },
        tabBarBadgeStyle: {
          backgroundColor: flame,
          color: creamOnDark.DEFAULT,
          fontSize: 10,
          fontWeight: "700",
          minWidth: 18,
          height: 18,
          lineHeight: 18,
        },
      }}
      // De navigatie zit sinds de v3-uitrol in de kop (`AppChrome`), op elk
      // tabblad. Een tweede navigatiebalk onderaan zou hetzelfde nog eens
      // zeggen én ruimte kosten die de pagina zelf nodig heeft. De Tabs-
      // navigator blijft wél staan: die regelt de routes en het behouden
      // van scrollpositie per tab.
      tabBar={() => null}
    >
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="feed" />
      <Tabs.Screen name="events" />
      <Tabs.Screen name="chats" />
      <Tabs.Screen name="friends" />
      <Tabs.Screen name="profile" />
    </Tabs>
    </>
  );
}
