import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Platform, Pressable, Text, TextInput, View, type ViewStyle } from "react-native";

import type { EmojiGroup } from "@/lib/emoji-data";
import { color, useThemeSpec } from "@/lib/design/theme";
import { sans } from "@/lib/design/type";

/**
 * De volledige emojikiezer achter "Meer" (HANDOFF §Likes: "+ Meer (volledige
 * picker)"). Zoeken op naam, een rij groepen om naartoe te springen, en
 * bovenaan wat je laatst koos.
 *
 * De lijst (≈1850 emoji, lib/emoji-data.ts) komt pas binnen als de kiezer
 * opent, en staat in een FlatList per rij van acht: alleen wat in beeld is
 * wordt getekend.
 */

const COLS = 8;
const ROW_H = 44;
const HEAD_H = 30;
const RECENT_KEY = "lincin.emoji.recent";
const isWeb = Platform.OS === "web";
const pointer = isWeb ? ({ cursor: "pointer" } as ViewStyle) : null;

type Item = { e: string; name: string };
type Row = { kind: "head"; key: string; title: string; slug: string } | { kind: "row"; key: string; items: Item[] };

let groupsCache: EmojiGroup[] | null = null;
function loadGroups(): Promise<EmojiGroup[]> {
  if (groupsCache) return Promise.resolve(groupsCache);
  return import("@/lib/emoji-data").then((m) => (groupsCache = m.EMOJI_GROUPS));
}

function parse(list: string): Item[] {
  return list.split("\n").map((line) => {
    const i = line.indexOf(" ");
    return { e: line.slice(0, i), name: line.slice(i + 1) };
  });
}

function rowsOf(prefix: string, items: Item[]): Row[] {
  const out: Row[] = [];
  for (let i = 0; i < items.length; i += COLS) out.push({ kind: "row", key: `${prefix}-${i}`, items: items.slice(i, i + COLS) });
  return out;
}

export async function rememberEmoji(e: string) {
  try {
    const raw = await AsyncStorage.getItem(RECENT_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify([e, ...list.filter((x) => x !== e)].slice(0, COLS * 2)));
  } catch {
    // niet bewaard: geen ramp
  }
}

export function EmojiPicker({
  onPick,
  selected,
  height = 300,
}: {
  onPick: (emoji: string) => void;
  /** Wat jij al gaf: getint, zodat je ziet dat nogmaals tikken weghaalt. */
  selected?: ReadonlySet<string>;
  height?: number;
}) {
  const modern = useThemeSpec().id === "modern";
  const [groups, setGroups] = useState<EmojiGroup[] | null>(groupsCache);
  const [recent, setRecent] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const list = useRef<FlatList<Row>>(null);

  useEffect(() => {
    let alive = true;
    loadGroups().then((g) => alive && setGroups(g));
    AsyncStorage.getItem(RECENT_KEY)
      .then((raw) => alive && setRecent(raw ? JSON.parse(raw) : []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const parsed = useMemo(() => (groups ?? []).map((g) => ({ ...g, items: parse(g.list) })), [groups]);

  const rows = useMemo<Row[]>(() => {
    const query = q.trim().toLowerCase();
    if (query) {
      // Vanaf het begin van een woord: "cat" vindt de kat, niet "application".
      const hits = parsed.flatMap((g) => g.items.filter((it) => it.name === query || it.name.startsWith(query) || it.name.includes(` ${query}`)));
      return rowsOf("q", hits.slice(0, COLS * 12));
    }
    const out: Row[] = [];
    if (recent.length) {
      out.push({ kind: "head", key: "h-recent", title: "Recent", slug: "recent" });
      out.push(...rowsOf("recent", recent.map((e) => ({ e, name: e }))));
    }
    for (const g of parsed) {
      out.push({ kind: "head", key: `h-${g.slug}`, title: g.title, slug: g.slug });
      out.push(...rowsOf(g.slug, g.items));
    }
    return out;
  }, [parsed, recent, q]);

  // Vaste hoogtes: springen naar een groep zonder te meten.
  const offsets = useMemo(() => {
    const o: number[] = [];
    let y = 0;
    for (const r of rows) {
      o.push(y);
      y += r.kind === "head" ? HEAD_H : ROW_H;
    }
    return o;
  }, [rows]);

  function pick(e: string) {
    onPick(e);
    void rememberEmoji(e);
  }

  function jump(slug: string) {
    const i = rows.findIndex((r) => r.kind === "head" && r.slug === slug);
    if (i >= 0) list.current?.scrollToOffset({ offset: offsets[i], animated: true });
  }

  const rule = color("ink", "postRule");
  const dim = color("ink", "inkDim");
  return (
    <View style={{ borderWidth: 1, borderColor: rule, borderRadius: modern ? 14 : 0, overflow: "hidden" }}>
      <View style={{ flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: rule, paddingHorizontal: 12, height: 44 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Zoek emoji (Engels: heart, cat…)"
          placeholderTextColor={dim}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Zoek emoji"
          style={[sans(400), { flex: 1, fontSize: 15, color: color("ink"), paddingVertical: 8 }, isWeb ? ({ outlineWidth: 0 } as object) : null]}
        />
        {q ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Wis" onPress={() => setQ("")} hitSlop={10} style={pointer}>
            <Text style={{ fontSize: 16, color: dim }}>×</Text>
          </Pressable>
        ) : null}
      </View>
      {!q && groups ? (
        <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: rule }}>
          {(recent.length ? [{ slug: "recent", icon: "🕘", title: "Recent" }] : []).concat(groups.map((g) => ({ slug: g.slug, icon: g.icon, title: g.title }))).map((g) => (
            <Pressable
              key={g.slug}
              accessibilityRole="button"
              accessibilityLabel={g.title}
              onPress={() => jump(g.slug)}
              style={[{ flex: 1, height: 36, alignItems: "center", justifyContent: "center" }, pointer]}
            >
              <Text style={{ fontSize: 16, lineHeight: 20 }}>{g.icon}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {!groups ? (
        <View style={{ height, alignItems: "center", justifyContent: "center" }}>
          <Text style={[sans(500), { fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: dim }]}>Laden…</Text>
        </View>
      ) : rows.length === 0 ? (
        <View style={{ height: 88, alignItems: "center", justifyContent: "center" }}>
          <Text style={[sans(500), { fontSize: 10, letterSpacing: 1.2, textTransform: "uppercase", color: dim }]}>Geen emoji gevonden</Text>
        </View>
      ) : (
        <FlatList
          ref={list}
          data={rows}
          keyExtractor={(r) => r.key}
          style={{ height }}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          windowSize={5}
          getItemLayout={(_, i) => ({ length: rows[i].kind === "head" ? HEAD_H : ROW_H, offset: offsets[i], index: i })}
          renderItem={({ item: r }) =>
            r.kind === "head" ? (
              <View style={{ height: HEAD_H, justifyContent: "flex-end", paddingHorizontal: 12, paddingBottom: 4 }}>
                <Text style={[sans(700), { fontSize: 9, lineHeight: 12, letterSpacing: 1.4, textTransform: "uppercase", color: dim }]}>{r.title}</Text>
              </View>
            ) : (
              <View style={{ height: ROW_H, flexDirection: "row" }}>
                {r.items.map((it) => (
                  <Pressable
                    key={it.e}
                    accessibilityRole="button"
                    accessibilityLabel={it.name}
                    onPress={() => pick(it.e)}
                    style={({ pressed }) => [
                      { width: `${100 / COLS}%`, height: ROW_H, alignItems: "center", justifyContent: "center", backgroundColor: selected?.has(it.e) || pressed ? color("tint") : "transparent" },
                      pointer,
                    ]}
                  >
                    <Text style={{ fontSize: 24, lineHeight: 30 }}>{it.e}</Text>
                  </Pressable>
                ))}
              </View>
            )
          }
        />
      )}
    </View>
  );
}
