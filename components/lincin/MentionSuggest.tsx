import { useQuery } from "@tanstack/react-query";
import { Platform, Pressable, ScrollView, Text, View } from "react-native";

import { listMyFriendships } from "@/lib/api/friends";
import { useAuth } from "@/lib/auth/provider";
import { color, line } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";

import { AvatarPhoto } from "./AvatarPhoto";
import { BORDER, GUTTER } from "./ui";

/** `@naam` aan het eind van wat je typt: dat is iemand die je wil noemen. */
const MENTION_QUERY = /(?:^|\s)@([a-z0-9._]*)$/i;

export type MentionCandidate = { username: string; display: string; avatarUrl: string | null };

/**
 * @-suggesties bij het typen van een comment, zoals in een gesprek.
 *
 * Het gesprek had ze al (`app/chat/[id].tsx`), de comments niet: wie onder
 * een bijdrage `@mie` typte kreeg niets en moest de handle uit het hoofd
 * kennen. Nu toont `@` je vrienden erboven, de eerste staat voorgekozen en
 * Tab neemt hem. Net als bij de emoji is de lijst afgeleid van de tekst.
 */
export function useMentionSuggest(value: string, onChange: (v: string) => void) {
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";
  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
    enabled: !!myUserId,
    staleTime: 60_000,
  });

  const match = value.match(MENTION_QUERY);
  let list: MentionCandidate[] = [];
  if (match) {
    const q = match[1].toLowerCase();
    list = (friendships.data ?? [])
      .filter((f) => f.status === "accepted" && f.other?.username)
      .map((f) => ({
        username: f.other.username,
        display: f.other.display_name ?? f.other.username,
        avatarUrl: f.other.avatar_url ?? null,
      }))
      .filter((c) => !q || c.username.toLowerCase().startsWith(q) || c.display.toLowerCase().startsWith(q))
      .slice(0, 6);
  }

  const apply = (username: string) =>
    onChange(
      value.replace(MENTION_QUERY, (m) => {
        const lead = /^\s/.test(m) ? m[0] : "";
        return `${lead}@${username} `;
      })
    );

  /** Op web: Tab neemt de voorgekozen (eerste) suggestie. Geeft true als hij iets deed. */
  const onKeyPress = (e: { nativeEvent: { key: string }; preventDefault?: () => void }) => {
    if (Platform.OS !== "web" || e.nativeEvent.key !== "Tab" || list.length === 0) return false;
    e.preventDefault?.();
    apply(list[0].username);
    return true;
  };

  return { list, apply, onKeyPress };
}

export function MentionSuggestions({
  list,
  onPick,
  round,
  pad = GUTTER,
}: {
  list: MentionCandidate[];
  onPick: (username: string) => void;
  /** Modern: pillen. Kleur en magazine: vakjes met een rand. */
  round: boolean;
  /** De zijmarge van de rij; het desktoppaneel gebruikt 20. */
  pad?: number;
}) {
  if (list.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={{ gap: 6, paddingHorizontal: pad, paddingTop: 8, alignItems: "center" }}
    >
      {list.map((c, i) => {
        // De eerste is voorgekozen: die neemt Tab. Hij staat in inkt.
        const first = i === 0;
        return (
          <Pressable
            key={c.username}
            accessibilityRole="button"
            accessibilityLabel={`${c.display} @${c.username}`}
            onPress={() => onPick(c.username)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              height: 34,
              paddingLeft: 4,
              paddingRight: 10,
              backgroundColor: first ? color("ink") : round ? color("paper", "glass") : color("paper"),
              ...(round
                ? { borderRadius: 999, borderWidth: 1, borderColor: first ? color("ink") : color("ink", "postRule") }
                : { borderWidth: BORDER, borderColor: line() }),
            }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: round ? 13 : 0,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: first ? color("paper") : color("paper2"),
              }}
            >
              <Text style={[lincinType.meta, { color: color("ink") }]}>{c.display.slice(0, 1).toUpperCase()}</Text>
              <AvatarPhoto url={c.avatarUrl} size={26} />
            </View>
            <Text style={[lincinType.meta, { textTransform: "none", color: first ? color("paper") : color("ink") }]}>
              @{c.username}
            </Text>
            {first && Platform.OS === "web" ? (
              <Text style={[lincinType.meta, { textTransform: "none", color: color("paper"), opacity: 0.6 }]}>tab</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
