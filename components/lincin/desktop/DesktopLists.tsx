import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { listMySharedLists, type SharedListWithDetails } from "@/lib/api/shared-lists";
import { useAuth } from "@/lib/auth/provider";
import { color, useThemeSpec } from "@/lib/design/theme";
import { capf, mono, sans } from "@/lib/design/type";
import { useT } from "@/lib/i18n";

import { DesktopShell, DesktopTitle, MonoLink } from "./Shell";

/**
 * Je lijsten op desktop, in het raster van Events.
 *
 * Twee schermen met dezelfde vorm — een titel met een teller rechts, dan
 * kaarten met haarlijnen ertussen — horen er hetzelfde uit te zien, dus dit
 * volgt `DesktopEvents` op de voet. Waar een event een datum groot links
 * zet, staat hier het icoon: dat is wat een lijst van een afstand
 * herkenbaar maakt.
 *
 * Dit scherm bestond niet. `list-compose` en `list/[id]` waren af, de
 * `shared_lists`-tabel stond er, en de feed haalde ze zelfs op — maar geen
 * enkele knop wees ernaar en geen enkele kaart tekende ze, dus je kon een
 * lijst aanmaken en hem daarna nooit meer terugvinden. Dit is de plek waar
 * ze wonen.
 */

const MIN = 340;

export function DesktopLists() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const router = useRouter();
  const t = useT();
  const spec = useThemeSpec();
  const [gridW, setGridW] = useState(0);
  const cols = Math.max(1, Math.floor((gridW + 1) / (MIN + 1)));
  const cardW = gridW ? (gridW - (cols - 1)) / cols : MIN;

  const lists = useQuery({
    queryKey: ["shared-lists", myUserId],
    queryFn: () => listMySharedLists(myUserId),
    refetchOnWindowFocus: true,
  });
  const data = lists.data ?? [];

  return (
    <DesktopShell active="you">
      <DesktopTitle
        right={
          <>
            <MonoLink label={`${data.length} ${data.length === 1 ? t.list : t.lists}`} on={false} />
            <MonoLink label={`${t.newList} →`} active onPress={() => router.push("/list-compose")} />
          </>
        }
      >
        {t.listsA} <Text style={capf(true, true)}>{t.listsB}</Text>
      </DesktopTitle>
      <View style={{ flex: 1, minHeight: 0 }} onLayout={(e) => setGridW(e.nativeEvent.layout.width)}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {lists.isLoading ? (
            <Meta>{t.loading}</Meta>
          ) : data.length === 0 ? (
            <Meta>{t.noListsYet}</Meta>
          ) : (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 1,
                backgroundColor: color("ink", "postRule"),
                borderBottomWidth: spec.border,
                borderBottomColor: color("ink"),
              }}
            >
              {data.map((l) => (
                <Card key={l.id} list={l} width={cardW} />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </DesktopShell>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return (
    <Text
      style={[
        mono(500),
        {
          fontSize: 10,
          lineHeight: 13,
          color: color("ink", "inkDim"),
          padding: 24,
          textTransform: "uppercase",
          letterSpacing: 1,
        },
      ]}
    >
      {children}
    </Text>
  );
}

function Card({ list: l, width }: { list: SharedListWithDetails; width: number }) {
  const router = useRouter();
  const t = useT();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const done = l.checked_count;
  const total = l.item_count;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const meta = [
    mono(500),
    {
      fontSize: 9,
      lineHeight: 12,
      letterSpacing: 1.08,
      textTransform: "uppercase" as const,
      color: dim,
    },
  ];

  return (
    <Pressable
      accessibilityLabel={l.title}
      onPress={() => router.push(`/list/${l.id}` as never)}
      style={{
        width,
        minHeight: 180,
        backgroundColor: color("paper"),
        flexDirection: "row",
        gap: 20,
        paddingVertical: 22,
        paddingHorizontal: 24,
      }}
    >
      <View style={{ width: 76 }}>
        <Text style={{ fontSize: 44, lineHeight: 52 }}>{l.emoji}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
        <Text numberOfLines={1} style={meta}>
          {l.members.length + 1} {l.members.length + 1 === 1 ? "linc" : "lincs"}
        </Text>
        <Text numberOfLines={2} style={[capf(false, true), { fontSize: 26, lineHeight: 27, color: ink }]}>
          {l.title}
        </Text>
        <Text numberOfLines={1} style={[sans(), { fontSize: 14, lineHeight: 19, color: dim }]}>
          {total === 0 ? t.listEmpty : `${done} ${t.ofWord} ${total} · ${pct}%`}
        </Text>
        {/* De balk zegt in één blik wat de regel erboven uitspelt. Bij een
            lege lijst is er niets te vullen, dus staat hij er ook niet. */}
        {total > 0 ? (
          <View style={{ height: 6, backgroundColor: color("paper2"), marginTop: 2 }}>
            <View style={{ height: 6, width: `${pct}%`, backgroundColor: ink }} />
          </View>
        ) : null}
        <View
          style={{
            flexDirection: "row",
            gap: 16,
            marginTop: "auto",
            paddingTop: 12,
            borderTopWidth: 1,
            borderTopColor: color("ink", "postRule"),
          }}
        >
          <MonoLink label="Open →" active onPress={() => router.push(`/list/${l.id}` as never)} />
        </View>
      </View>
    </Pressable>
  );
}
