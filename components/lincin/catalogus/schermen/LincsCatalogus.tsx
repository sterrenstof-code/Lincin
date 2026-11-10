import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo } from "react";

import { listUnifiedFeed } from "@/lib/api/posts";
import type { FriendshipWithProfile } from "@/lib/api/friends";
import { useAuth } from "@/lib/auth/provider";
import { displayName } from "@/lib/lincin/model";
import { useSeenPosts } from "@/lib/read-state";

import { useTerug } from "../nav";
import { lincKleur } from "../stijl";
import { LincsView } from "./LijstViews";

/**
 * Mijn lincs (ontwerp 12) op echte gegevens: elke linc als voorwerp met het
 * aantal bijdragen dat je van hem nog niet zag. "+" en het laatste vak
 * openen het toevoegen (QR, je link, een naam zoeken) van het gewone scherm.
 */
/** Per linc: hoeveel bijdragen je van hem nog niet zag; telefoon en desktop. */
export function useLincsRijen(lincs: FriendshipWithProfile[]) {
  const router = useRouter();
  const { session } = useAuth();
  const me = session?.user.id ?? "";
  const feed = useQuery({ queryKey: ["unified-feed", me], queryFn: () => listUnifiedFeed(me), enabled: !!me, staleTime: 30_000 });
  const { isSeen } = useSeenPosts();
  const nieuw = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of feed.data ?? []) {
      if (i.type !== "post" && i.type !== "poll") continue;
      const auteur = i.data.user_id;
      if (auteur === me || isSeen(i.id, i.created_at)) continue;
      m.set(auteur, (m.get(auteur) ?? 0) + 1);
    }
    return m;
  }, [feed.data, isSeen, me]);
  const totaal = [...nieuw.values()].reduce((a, b) => a + b, 0);
  const rijen = lincs.map((f) => {
    const naam = displayName(f.other);
    const n = nieuw.get(f.other.id) ?? 0;
    return {
      id: f.id,
      naam,
      gebruiker: f.other.username,
      nieuw: n ? String(n) : "—",
      linc: { beeld: f.other.avatar_url, kleur: lincKleur(f.other.id), initiaal: naam.slice(0, 1).toUpperCase() },
      open: () => (f.other.username ? router.push(`/user/${f.other.username}` as never) : undefined),
    };
  });
  return { rijen, totaal };
}

export function LincsCatalogus({ lincs, toevoegen }: { lincs: FriendshipWithProfile[]; toevoegen: () => void }) {
  const terug = useTerug("/profile");
  const { rijen, totaal } = useLincsRijen(lincs);
  return (
    <LincsView
      regels={[
        { label: "Lincin", waarde: "Mijn lincs" },
        { label: "Aantal", waarde: String(lincs.length) },
        { label: "Nieuw", waarde: `${totaal} ${totaal === 1 ? "bijdrage" : "bijdragen"}` },
      ]}
      terug={terug}
      toevoegen={toevoegen}
      lincs={rijen}
    />
  );
}
