import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { ChatDetail } from "@/app/chat/[id]";
import { chatTitle, otherMember } from "@/lib/api/chats";
import { listMyFriendships } from "@/lib/api/friends";
import { RASTER, color, friendColor, pageTint, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { head, mono, sans, serif } from "@/lib/design/type";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { pickThread } from "@/lib/lincin/desktop";

import { chatHue, ChatList, useSortedChats } from "./ChatList";
import { DesktopShell, PageHead } from "./Shell";

/**
 * Gesprekken op desktop (desktop-*-pages.dc.html, GESPREKKEN).
 *
 * Bovenaan de paginakop ("02 Gesprekken", ongelezen en aantal). Links de
 * lijst (420, magazine 440), rechts het gesprek: een kop in de kleur van de
 * ander met de naam, "linc sinds …" of "groep · n lincs" en Profiel →;
 * daaronder de draad zelf — dezelfde als op de telefoon, versleuteling en
 * al — met de invoer onderaan.
 *
 * `/chats` kiest zelf (het laatste ongelezen, anders het laatste);
 * `/chat/[id]` toont dat gesprek. Een andere rij kiezen verandert de URL.
 */

const LOCALE: Record<Lang, string> = { nl: "nl-BE", en: "en-GB", de: "de-DE" };

export function DesktopChats({ chatId }: { chatId?: string | null }) {
  const router = useRouter();
  const t = useT();
  const scheme = useScheme();
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const spec = useThemeSpec();
  const { myUserId, list, chats } = useSortedChats();
  const current = pickThread(chatId ?? null, list);
  const chat = list.find((c) => c.id === current) ?? null;
  const tint = chat ? friendColor(chatHue(chat, myUserId), scheme).fill : null;
  const unread = list.reduce((n, c) => n + (c.unread_count ?? 0), 0);
  const th = spec.id;

  const open = (id: string) => {
    if (id === current) return;
    if (chatId) router.setParams({ id });
    else router.push(`/chat/${id}` as never);
  };

  const thread = current ? (
    <>
      <ThreadHead chatId={current} />
      <View style={[{ flex: 1, minHeight: 0 }, th === "modern" ? { borderRadius: RASTER.tileRadius, overflow: "hidden", backgroundColor: color("tile", "tileFill") } : null]}>
        <ChatDetail key={current} id={current} embedded />
      </View>
    </>
  ) : chats.isLoading ? null : (
    <EmptyThread />
  );

  return (
    <DesktopShell active="chats" tint={th === "modern" ? tint : null}>
      <View style={[{ flex: 1, minHeight: 0 }, th === "modern" ? { gap: RASTER.seam } : null]}>
        <PageHead num="02" title={t.chats} sub={`${unread} ${t.unread} · ${list.length} ${t.chats.toLowerCase()}`} />
        <View style={[{ flex: 1, minHeight: 0, flexDirection: "row" }, th === "kleur" ? null : { gap: RASTER.seam }, th === "magazine" ? { padding: RASTER.seam } : null]}>
          <View style={[{ width: th === "magazine" ? 440 : 420, minHeight: 0 }, th === "kleur" ? { borderRightWidth: spec.border, borderRightColor: color("ink") } : null]}>
            <ChatList activeId={current} onOpen={open} full />
          </View>
          <View
            style={[
              { flex: 1, minWidth: 0, minHeight: 0 },
              th === "magazine" && tint ? { backgroundColor: color("paper2"), borderLeftWidth: 5, borderLeftColor: tint } : null,
              th === "modern" ? { gap: RASTER.seam } : null,
            ]}
          >
            {thread}
          </View>
        </View>
      </View>
    </DesktopShell>
  );
}

function EmptyThread() {
  const t = useT();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: color("ink", "inkDim") }]}>{t.noFriendsYet}</Text>
    </View>
  );
}

/** De kop van het gesprek: initiaal, naam, ondertitel en Profiel →. */
function ThreadHead({ chatId }: { chatId: string }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const spec = useThemeSpec();
  const scheme = useScheme();
  const { myUserId, list } = useSortedChats();
  const friendships = useQuery({ queryKey: ["friendships", myUserId], queryFn: () => listMyFriendships(myUserId) });
  const chat = list.find((c) => c.id === chatId);
  if (!chat) return null;
  const isGroup = chat.type === "group";
  const other = isGroup ? null : otherMember(chat, myUserId);
  const since = other ? (friendships.data ?? []).find((f) => f.other.id === other.id && f.status === "accepted")?.accepted_at : null;
  const sub = isGroup
    ? `${t.group} · ${chat.members.length} lincs`
    : since
      ? `${t.lincSince} ${new Date(since).toLocaleDateString(LOCALE[lang], { month: "short" }).replace(".", "")} '${String(new Date(since).getFullYear()).slice(2)}`
      : "";
  const name = chatTitle(chat, myUserId);
  const fc = friendColor(chatHue(chat, myUserId), scheme);
  const goProfile = isGroup
    ? () => router.push(`/group/${chat.id}` as never)
    : other?.username
      ? () => router.push(`/user/${other.username}` as never)
      : null;
  const profLabel = `${isGroup ? t.group : t.scrProfile} →`;
  const ink = color("ink");

  if (spec.id === "magazine") {
    return (
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 16, paddingTop: 26, paddingHorizontal: 30, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: color("ink", "postRule") }}>
        <View style={{ gap: 8, flexShrink: 1 }}>
          {sub ? <Text style={[sans(700), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: color("ink", "inkDim") }]}>{sub}</Text> : null}
          <Text numberOfLines={1} style={[serif(), { fontSize: 52, lineHeight: 48, letterSpacing: -1.04, color: ink }]}>
            {name}
          </Text>
        </View>
        {goProfile ? (
          <Pressable accessibilityRole="link" onPress={goProfile}>
            <Text style={[serif(), { fontSize: 19, lineHeight: 24, color: ink, textDecorationLine: "underline" }]}>{profLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  if (spec.id === "modern") {
    return (
      <View style={{ borderRadius: RASTER.tileRadius, paddingVertical: 14, paddingRight: 14, paddingLeft: 16, flexDirection: "row", alignItems: "center", gap: 16, backgroundColor: pageTint(fc.fill, scheme, { light: 0.22, dark: 0.2 }) }}>
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: fc.fill, alignItems: "center", justifyContent: "center" }}>
          <Text style={[sans(700), { fontSize: 17, lineHeight: 20, color: fc.ink }]}>{name.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
          <Text numberOfLines={1} style={[sans(500), { fontSize: 26, lineHeight: 28, letterSpacing: -0.8, color: ink }]}>
            {name}
          </Text>
          {sub ? <Text style={[mono(500), { fontSize: 8.5, lineHeight: 11, letterSpacing: 1.36, textTransform: "uppercase", color: color("ink", "inkDim") }]}>{sub}</Text> : null}
        </View>
        {goProfile ? (
          <Pressable accessibilityRole="link" onPress={goProfile} style={{ height: 44, paddingHorizontal: 18, borderRadius: 999, justifyContent: "center", backgroundColor: "rgba(255,255,255,.8)" }}>
            <Text style={[mono(500), { fontSize: 9.5, lineHeight: 12, letterSpacing: 1.14, textTransform: "uppercase", color: "#17170F" }]}>{profLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ height: 84, flexDirection: "row", alignItems: "center", gap: 16, paddingHorizontal: 24, backgroundColor: fc.fill, borderBottomWidth: spec.border, borderBottomColor: ink }}>
      <View style={{ width: 48, height: 48, borderWidth: spec.border, borderColor: ink, backgroundColor: color("paper"), alignItems: "center", justifyContent: "center" }}>
        <Text style={[head(), { fontSize: 24, lineHeight: 26, color: ink }]}>{name.slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
        <Text numberOfLines={1} style={[head(), { fontSize: 30, lineHeight: 28, color: fc.ink }]}>
          {name}
        </Text>
        {sub ? <Text style={[mono(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: fc.ink }]}>{sub}</Text> : null}
      </View>
      {goProfile ? (
        <Pressable accessibilityRole="link" onPress={goProfile} style={{ height: 40, paddingHorizontal: 16, justifyContent: "center", backgroundColor: color("paper"), borderWidth: spec.border, borderColor: ink }}>
          <Text style={[mono(600), { fontSize: 11, lineHeight: 14, letterSpacing: 0.88, textTransform: "uppercase", color: ink }]}>{profLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
