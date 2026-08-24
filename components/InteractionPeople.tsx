import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ActionSheet } from "@/components/ActionSheet";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth/provider";
import { feed, feedType, space } from "@/lib/design/type";
import { listReactionsForPost } from "@/lib/api/post-reactions";
import { getPostSignals } from "@/lib/api/post-signals";
import { getProfiles } from "@/lib/api/profiles";

/**
 * Wie iets met deze vondst gedaan heeft.
 *
 * De pillen eronder tellen hoevéél mensen iets deden, niet wíe. Dat is
 * precies wat je wil weten: een hartje van je zus is iets anders dan een
 * hartje van iemand die je vaag kent. Hier staan de gezichten, en een tik
 * geeft de hele lijst met wat ieder deed — een naam aantikken brengt je
 * naar het profiel.
 */
export function InteractionPeople({ postId }: { postId: string }) {
  const router = useRouter();
  const { session } = useAuth();
  const myUserId = session?.user.id;
  const [open, setOpen] = useState(false);

  const people = useQuery({
    queryKey: ["post-people", postId, myUserId],
    queryFn: async () => {
      const [reactions, signals] = await Promise.all([
        listReactionsForPost(postId),
        getPostSignals(postId, myUserId),
      ]);

      /** Per persoon: wat deed die precies. Emoji's eerst, dan de duw. */
      const byUser = new Map<string, string[]>();
      for (const r of reactions) {
        byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.emoji]);
      }
      for (const uid of signals.boosterIds) {
        byUser.set(uid, [...(byUser.get(uid) ?? []), "omhoog geduwd"]);
      }
      if (byUser.size === 0) return [];

      const profiles = await getProfiles(Array.from(byUser.keys()));
      const byId = new Map(profiles.map((prof) => [prof.id, prof]));
      return Array.from(byUser.entries()).map(([userId, what]) => ({
        userId,
        what,
        profile: byId.get(userId) ?? null,
      }));
    },
    enabled: !!postId,
  });

  const rows = people.data ?? [];
  if (rows.length === 0) return null;

  const nameOf = (i: number) => {
    const prof = rows[i]?.profile;
    if (!prof) return "Iemand";
    if (prof.id === myUserId) return "Jij";
    return prof.display_name ?? prof.username;
  };

  // "Jij, Mie en 3 anderen" — twee namen en dan een aantal. Vijf namen op
  // een rij leest niemand meer als namen.
  const summary =
    rows.length === 1
      ? nameOf(0)
      : rows.length === 2
      ? `${nameOf(0)} en ${nameOf(1)}`
      : `${nameOf(0)}, ${nameOf(1)} en ${rows.length - 2} ${
          rows.length - 2 === 1 ? "ander" : "anderen"
        }`;

  return (
    <View>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}
      >
        <View style={{ flexDirection: "row" }}>
          {rows.slice(0, 4).map((row, i) => (
            <View key={row.userId} style={{ marginLeft: i === 0 ? 0 : -space.sm }}>
              <Avatar
                name={row.profile?.display_name ?? row.profile?.username}
                avatarUrl={row.profile?.avatar_url}
                size="xs"
              />
            </View>
          ))}
        </View>
        <Text style={[feedType.label, { color: feed.inkDim, flex: 1 }]} numberOfLines={1}>
          {summary}
        </Text>
      </Pressable>

      <ActionSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Wie hier iets mee deed"
        actions={rows.map((row, i) => ({
          label: `${nameOf(i)} · ${row.what.join(" ")}`,
          icon: "person-outline",
          onPress: () => {
            const handle = row.profile?.username;
            if (handle) router.push(`/user/${handle}`);
          },
        }))}
      />
    </View>
  );
}
