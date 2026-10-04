import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { createNotification } from "@/lib/api/notifications";
import {
  getPollWithDetails,
  proposePollOption,
  removePollOption,
  votePollOption,
  type PollWithDetails,
} from "@/lib/api/polls";
import { uniqueTopic } from "@/lib/supabase/channel";
import { supabase } from "@/lib/supabase/client";

import { tick } from "./likes";

// ---------------------------------------------------------------
// De poll op zijn eigen bladzijde (Poll-spec, okt 2026)
// ---------------------------------------------------------------

/**
 * Eén poll, live: wie stemt verandert de percentages meteen, ook bij een
 * ander. Een tik is optimistisch (meteen zichtbaar, terug bij een fout):
 *   - een andere keuze = stem wijzigen (bij één keuze)
 *   - je eigen keuze nog eens = stem intrekken
 *   - meerdere keuzes: elke keuze los aan of uit
 * Een eigen voorstel voegt een keuze toe en telt meteen als jouw stem.
 */
export function usePoll(pollId: string | undefined, myUserId: string) {
  const qc = useQueryClient();
  const key = ["poll", pollId];
  const q = useQuery({
    queryKey: key,
    queryFn: () => getPollWithDetails(pollId!, myUserId),
    enabled: !!pollId && !!myUserId,
  });
  const poll = q.data ?? null;

  useEffect(() => {
    if (!pollId) return;
    const refetch = () => qc.invalidateQueries({ queryKey: ["poll", pollId] });
    const ch = supabase
      .channel(uniqueTopic(`poll:${pollId}`))
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_options", filter: `poll_id=eq.${pollId}` }, refetch)
      // Een stem draagt geen poll_id: kijk of de keuze van deze poll is.
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes" }, (p) => {
        const row = (p.new && Object.keys(p.new).length ? p.new : p.old) as { poll_option_id?: string };
        const ids = (qc.getQueryData<PollWithDetails | null>(["poll", pollId])?.options ?? []).map((o) => o.id);
        if (!row?.poll_option_id || ids.includes(row.poll_option_id)) refetch();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [pollId, qc]);

  // Optimistisch: jouw stemmen zoals je ze net zette, tot de server antwoordt.
  const [mineOverride, setMineOverride] = useState<Set<string> | null>(null);
  useEffect(() => setMineOverride(null), [q.data]);
  const serverMine = useMemo(() => new Set(poll?.my_vote_option_ids ?? []), [poll]);
  const mine = mineOverride ?? serverMine;

  const closed = !!poll?.ends_at && new Date(poll.ends_at).getTime() <= Date.now();

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of poll?.options ?? []) {
      let n = o.vote_count;
      if (serverMine.has(o.id)) n -= 1;
      if (mine.has(o.id)) n += 1;
      m.set(o.id, Math.max(0, n));
    }
    return m;
  }, [poll, serverMine, mine]);

  const totalVotes = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  // Mensen die stemden: van de server, bijgesteld voor wat jij net deed.
  const voters = Math.max(0, (poll?.voter_count ?? 0) - (serverMine.size ? 1 : 0) + (mine.size ? 1 : 0));

  const vote = useCallback(
    async (optionId: string) => {
      if (!poll || closed) return;
      const before = mine;
      const next = new Set(poll.allow_multiple ? mine : []);
      if (mine.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      setMineOverride(next);
      tick();
      try {
        const res = await votePollOption(optionId);
        if (res === "closed") setMineOverride(before);
        // De maker hoort het — behalve bij een anonieme poll: dan zou de
        // melding verklappen wie stemde.
        if (res === "voted" && !poll.anonymous && poll.user_id !== myUserId) {
          createNotification({ userId: poll.user_id, actorId: myUserId, type: "vote_on_poll", pollId: poll.id });
        }
        qc.invalidateQueries({ queryKey: ["poll", poll.id] });
        qc.invalidateQueries({ queryKey: ["unified-feed"] });
      } catch {
        setMineOverride(before);
      }
    },
    [poll, closed, mine, myUserId, qc],
  );

  const propose = useCallback(
    async (label: string) => {
      if (!poll) return;
      await proposePollOption(poll.id, label);
      tick();
      await qc.invalidateQueries({ queryKey: ["poll", poll.id] });
      qc.invalidateQueries({ queryKey: ["unified-feed"] });
    },
    [poll, qc],
  );

  const removeOption = useCallback(
    async (optionId: string) => {
      if (!poll) return false;
      const ok = await removePollOption(optionId);
      await qc.invalidateQueries({ queryKey: ["poll", poll.id] });
      return ok;
    },
    [poll, qc],
  );

  return { poll, isLoading: q.isLoading, mine, counts, totalVotes, voters, closed, vote, propose, removeOption };
}

export type PollModel = ReturnType<typeof usePoll>;
