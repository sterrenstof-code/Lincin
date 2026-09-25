import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { Platform } from "react-native";

import type { GroupedPostReaction } from "@/lib/api/post-reactions";
import { getProfiles } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { useT, type Dict } from "@/lib/i18n";
import { displayName } from "@/lib/lincin/model";
import { useToast } from "@/lib/toast";

/**
 * Wie er reageerde, in woorden.
 *
 * Een emoji-chip toont alleen een telling. Hier komen de namen bij: op
 * web als tooltip bij hover (`hoverTitle`), op de telefoon bij lang
 * drukken, en overal als voorvertoning onder de reacties — zoals bij
 * Facebook: "❤️😂 Jij, Johanna en 2 anderen".
 */

/** Namen bij user-ids; jijzelf heet "Jij". Eén vraag per set ids, vijf minuten onthouden. */
function useReactorNames(reactions: GroupedPostReaction[]): (id: string) => string {
  const t = useT();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";
  const ids = Array.from(new Set(reactions.flatMap((r) => r.userIds))).filter((id) => id !== myUserId).sort();
  const q = useQuery({
    queryKey: ["reactor-names", ids.join(",")],
    queryFn: () => getProfiles(ids),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });
  const data = q.data;
  return useCallback(
    (id: string) => {
      if (id === myUserId) return t.me;
      const p = data?.find((x) => x.id === id);
      return p ? displayName(p) : "…";
    },
    [data, myUserId, t],
  );
}

/** "Johanna", "Johanna en Tom", "Jij, Johanna en 3 anderen". */
function joinNames(names: string[], t: Dict, max = 2): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length <= max + 1) return `${names.slice(0, -1).join(", ")} ${t.andWord} ${names[names.length - 1]}`;
  const rest = names.length - max;
  return `${names.slice(0, max).join(", ")} ${t.andWord} ${rest} ${rest === 1 ? t.otherWord : t.othersWord}`;
}

/** Wie deze ene emoji gaf, voluit en jij eerst: "❤️ Jij, Johanna, Tom". */
function chipWho(r: GroupedPostReaction, nameOf: (id: string) => string, myUserId: string): string {
  return `${r.emoji} ${selfFirst(r.userIds, myUserId).map(nameOf).join(", ")}`;
}

function selfFirst(ids: string[], myUserId: string): string[] {
  return [...ids].sort((a, b) => Number(b === myUserId) - Number(a === myUserId));
}

/**
 * De voorvertoning onder de reacties: de emoji, en wie — ieder één keer,
 * jij eerst. Leeg als er niets is.
 */
function whoLine(reactions: GroupedPostReaction[], nameOf: (id: string) => string, t: Dict, myUserId: string): string {
  if (reactions.length === 0) return "";
  return `${reactions.map((r) => r.emoji).join("")} ${whoNames(reactions, nameOf, t, myUserId)}`;
}

/** Alleen de namen, voor naast chips die de emoji al tonen: "Jij, Johanna en 2 anderen". */
function whoNames(reactions: GroupedPostReaction[], nameOf: (id: string) => string, t: Dict, myUserId: string): string {
  const ids: string[] = [];
  for (const r of reactions) for (const id of r.userIds) if (!ids.includes(id)) ids.push(id);
  return joinNames(selfFirst(ids, myUserId).map(nameOf), t);
}

/**
 * Een tooltip bij hover, op web: de browser zet hem zelf, dus hij valt
 * nooit weg achter een kader met `overflow: hidden`. Geef dit als `ref`.
 */
function hoverTitle(text: string) {
  return (node: unknown) => {
    if (Platform.OS !== "web" || !node) return;
    (node as { title?: string }).title = text;
  };
}

/**
 * Alles voor één rij reacties: `line` is de voorvertoning, en `chip(r)`
 * geef je aan de Pressable van een emoji — tooltip bij hover (web), de
 * namen in een melding bij lang drukken (overal), en een label dat ze
 * voorleest.
 */
export function useReactionWho(reactions: GroupedPostReaction[]) {
  const t = useT();
  const toast = useToast();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";
  const nameOf = useReactorNames(reactions);
  return {
    line: whoLine(reactions, nameOf, t, myUserId),
    /** De namen zonder emoji: voor naast de chips, waar geen ruimte is voor een regel eronder. */
    names: whoNames(reactions, nameOf, t, myUserId),
    /**
     * Wie, in de chip zelf in plaats van een telling (Telegram): "Jij",
     * "Noor, Sem", "Jij +3". Zo staat het er één keer, naast de emoji,
     * en hoeft er geen regel "👍 Jij" meer onder.
     */
    chipLabel: (r: GroupedPostReaction) => {
      const names = selfFirst(r.userIds, myUserId).map(nameOf);
      if (names.length <= 2) return names.join(", ");
      return `${names[0]} +${names.length - 1}`;
    },
    chip: (r: GroupedPostReaction) => {
      const who = chipWho(r, nameOf, myUserId);
      return {
        ref: hoverTitle(who),
        accessibilityLabel: who,
        onLongPress: () => toast.show(who),
        delayLongPress: 350,
      };
    },
  };
}
