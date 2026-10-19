import { useIsRestoring, useQuery, useQueryClient } from "@tanstack/react-query";
import { Redirect, Tabs } from "expo-router";
import { Fragment, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";

import { offerAppLockOnce } from "@/lib/app-lock";
import { useAuth } from "@/lib/auth/provider";
import { bootstrapProfile, type KeyStatus } from "@/lib/auth/bootstrap";
import { listMyChats, shareMyMessagesOnce, watchMyChatList } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { countUnreadNotifications, subscribeToNotifications } from "@/lib/api/notifications";
import { touchLastSeen } from "@/lib/api/profiles";
import { addNotificationTapListener, registerPushToken } from "@/lib/push";
import { setUnreadBadge } from "@/lib/page-title";
import { supabase } from "@/lib/supabase/client";
import { InstallBanner } from "@/components/InstallBanner";
import { KeyGate } from "@/components/KeyGate";
import { PageTransition } from "@/components/PageTransition";
import { useTheme } from "@/lib/design/theme";
import { creamOnDark, desk, feed, flame } from "@/lib/design/type";

/** Zie `ThemedScreen` in app/_layout.tsx: een tabblad hertekent bij een themawissel. */
function ThemedTab({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Fragment key={theme}>
      <PageTransition>{children}</PageTransition>
    </Fragment>
  );
}

const themedTabLayout = ({ children }: { children: ReactNode }) => <ThemedTab>{children}</ThemedTab>;

export default function AppLayout() {
  const { session, loading, recovering } = useAuth();
  const [bootstrapping, setBootstrapping] = useState(true);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({ state: "ready" });
  const qc = useQueryClient();
  const restoring = useIsRestoring();

  useEffect(() => {
    if (!session) return;
    runBootstrap();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function runBootstrap() {
    try {
      const userId = session!.user.id;
      const result = await bootstrapProfile({
        userId,
        email: session!.user.email ?? "unknown@example.com",
      });
      // Het profiel is net gelezen; `onboarded` hieronder hoeft er dan niet
      // nóg eens om te vragen. Lukte het opstarten niet, dan doet die query
      // het zelf, zoals vroeger.
      qc.setQueryData(["onboarded", userId], result.onboarded);
      setKeyStatus(result.keys);
    } catch (err) {
      console.warn("bootstrapProfile failed", err);
    }
    setBootstrapping(false);
  }

  // Met je sleutel op zijn plaats: deel je eigen berichten met wie ze mist
  // (nieuwe groepsleden, of een bericht vlak na een ledenwissel). 0095.
  // Eén keer per sessie: zie `shareMyMessagesOnce`.
  useEffect(() => {
    if (!session || bootstrapping || keyStatus.state !== "ready") return;
    shareMyMessagesOnce(session.user.id);
  }, [session, bootstrapping, keyStatus.state]);

  // Heeft dit account de stappen na het aanmaken al gehad? (0082) Bestaande
  // accounts tellen als klaar; alleen een nieuw account ziet ze. Meestal
  // gevuld door `runBootstrap`; de vraag hieronder is de terugval.
  const onboarded = useQuery({
    queryKey: ["onboarded", session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("id", session!.user.id)
        .maybeSingle();
      // Bij twijfel niet blokkeren: de app is belangrijker dan de stappen.
      if (error || !data) return true;
      return data.onboarded_at !== null;
    },
    enabled: !!session && !bootstrapping,
    staleTime: Infinity,
  });

  // Totaal aantal ongelezen berichten over alle chats — toont op de
  // Chats-tab als badge zodat je ziet wanneer iemand jou geschreven heeft.
  // Friend-requests krijgen géén tab-badge (te ruis), enkel de incoming-
  // teller op de Vrienden-pagina zelf.
  //
  // We hoeven niet meer aggressief te pollen want we hebben een globale
  // realtime subscription die de lijst bij elk inkomend bericht bijwerkt.
  // refetchOnWindowFocus vangt netwerk-blips op: keer terug naar de tab en
  // we trekken meteen de actuele state binnen (catch-up voor wat realtime
  // tijdens disconnect heeft gemist).
  //
  // Wat realtime níet ziet — gelezen op een ander toestel, toegevoegd aan
  // een groep zonder berichten, een andere naam — haalt de lijst op bij
  // terugkeer naar de app, en als vangnet eens per vijf minuten. Elke
  // minuut was dat de volle lijst, de hele dag, voor wie de app open liet.
  //
  // Deze drie tellers hebben je sleutel niet nodig (de chatlijst is
  // metadata; de voorvertoning ontsleutelt pas op het scherm zelf, zie
  // lib/chat-preview.ts). Ze wachten dus niet op `bootstrapping` maar
  // lopen gelijk op met het opstarten: één wachttijd minder vóór de tabs.
  const chats = useQuery({
    queryKey: ["chats", session?.user.id ?? "anon"],
    queryFn: () => listMyChats(session!.user.id),
    enabled: !!session,
    refetchInterval: 5 * 60_000,
    refetchOnWindowFocus: true,
  });
  const totalUnread = (chats.data ?? []).reduce(
    (sum, c) => sum + (c.unread_count ?? 0),
    0
  );

  const unreadNotifications = useQuery({
    queryKey: ["notifications-unread", session?.user.id ?? "anon"],
    queryFn: () => countUnreadNotifications(session!.user.id),
    enabled: !!session,
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
    enabled: !!session,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
  const pendingIncoming = (friendships.data ?? []).filter(
    (f) =>
      f.status === "pending" && f.addressee_id === (session?.user.id ?? "")
  ).length;

  // Globale realtime: zodra er ergens in een van mijn chats een nieuw
  // bericht valt, werken we de gecachte chatlijst bij (tijdstip, volgorde,
  // ongelezen) zodat de badge, de chats-screen én de "laatst bericht"
  // previews direct meegaan — zonder de hele lijst opnieuw op te halen.
  // Eén kanaal, gedeeld met een open gesprek: zie `watchMyChatList`.
  useEffect(() => {
    if (!session || bootstrapping) return;
    return watchMyChatList(qc, session.user.id);
  }, [session, bootstrapping, qc]);

  // Realtime: nieuwe notificaties invalideren de badge teller direct
  useEffect(() => {
    if (!session || bootstrapping) return;
    const myId = session.user.id;
    const channel = subscribeToNotifications(myId, () => {
      qc.invalidateQueries({ queryKey: ["notifications-unread", myId] });
    });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session, bootstrapping, qc]);

  // Web: zet ongelezen-aantal in de browser tab-titel zodat je het ziet
  // wanneer Lincin in een andere tab open staat. Poor-man's web push.
  //
  // We tellen chat-unreads + inkomende friend-requests samen op — dat is
  // wat de gebruiker wil weten ("is er iets nieuws voor mij?"). De badges
  // op de tabs zelf blijven afzonderlijk (chats vs vrienden) zodat
  // gebruikers in de app zien WAT er nieuw is.
  const unreadNotifCount = unreadNotifications.data ?? 0;
  const totalAttention = totalUnread + pendingIncoming + unreadNotifCount;
  //
  // Het aantal is maar de hélft van de titel. Welke pagina dit is stond er
  // niet in, dus elke vondst, elk event en elk gesprek heette `Lincin` —
  // zeven tabs open en ze zijn niet uit elkaar te houden. Twee schrijvers
  // op één `document.title` gaat mis zodra ze elkaar niet kennen, dus
  // schrijft `lib/page-title.ts` hem en leveren wij alleen ons stuk aan.
  useEffect(() => {
    setUnreadBadge(totalAttention);
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
    if (!session || bootstrapping) return;
    registerPushToken(session.user.id).catch(() => {});
  }, [session, bootstrapping]);

  // Native, één keer: Face ID / vingerafdruk aanbieden — pas als de
  // stappen na het aanmaken klaar zijn, en even na het eerste beeld.
  useEffect(() => {
    if (!session || bootstrapping || onboarded.data !== true) return;
    const t = setTimeout(() => void offerAppLockOnce(), 1500);
    return () => clearTimeout(t);
  }, [session, bootstrapping, onboarded.data]);

  // Activiteitsindicator: update last_seen_at bij opstarten + elke 2 min
  useEffect(() => {
    if (!session || bootstrapping) return;
    const myId = session.user.id;
    touchLastSeen(myId).catch(() => {});
    const interval = setInterval(() => touchLastSeen(myId).catch(() => {}), 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [session, bootstrapping]);

  // Native: expo-notifications tap listener
  useEffect(() => {
    return addNotificationTapListener((data) => {
      // `path` zet send-push zelf (zie daar); de rest is voor oudere meldingen.
      // Alleen een pad binnen de app: "//ergens.anders" is een andere site.
      if (typeof data?.path === "string" && /^\/(?![\/\\])/.test(data.path)) {
        import("expo-router").then(({ router }) => {
          router.push(data.path);
        });
      } else if (data?.chat_id) {
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
      if (typeof path !== "string" || !/^\/(?![\/\\])/.test(path)) return;
      import("expo-router").then(({ router }) => {
        router.push(path as any);
      });
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

  if (loading) return null;
  if (!session) return <Redirect href="/(auth)/welcome" />;
  // Binnen via "Wachtwoord vergeten": eerst een nieuw wachtwoord. Een
  // wachtwoord is verder niet verplicht — magic link, Apple en Google zijn
  // volwaardige manieren om in te loggen (handoff okt 2026).
  if (recovering) return <Redirect href="/set-password" />;
  // Nieuw account: eerst de stappen na het aanmaken (foto, uitnodigen).
  if (onboarded.data === false) return <Redirect href="/onboarding" />;

  // Ook wachten tot de bewaarde cache terug is (lib/query-cache.ts): dat is
  // lokaal en bijna altijd al klaar, maar een tabblad dat ervóór tekent
  // ziet geen gegevens en geen laden, en toont dan "nog niets".
  if (bootstrapping || onboarded.isLoading || restoring) {
    return (
      <View className="flex-1 items-center justify-center bg-desk">
        <ActivityIndicator color={desk.ink} />
      </View>
    );
  }

  // Eerst je sleutel: op dit toestel, en met herstelcode op de server.
  if (keyStatus.state !== "ready") {
    return <KeyGate userId={session.user.id} status={keyStatus} onDone={runBootstrap} />;
  }

  return (
    <>
    <InstallBanner />
    <Tabs
      // Begint de navigator opnieuw, dan op de feed — niet op het eerste
      // scherm in de lijst hieronder (Meldingen).
      initialRouteName="feed"
      // Een tabwissel krijgt van deze navigator zelf geen animatie: hij
      // toont en verbergt gemounte schermen. Op web dekt de View
      // Transition dat af (de tabs navigeren via router.push in AppChrome),
      // maar op native — en in een browser zonder die API — knippert het
      // zonder deze laag. Zie components/PageTransition.tsx.
      screenLayout={themedTabLayout}
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
