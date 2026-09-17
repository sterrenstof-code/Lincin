import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { votePoll, type PollWithDetails } from "@/lib/api/polls";

/**
 * Stemmen op een poll in een kaart of tegel: meteen zichtbaar, daarna
 * naar de server, en terug als dat mislukt.
 *
 * Eén stem per linc: de nieuwe keuze vervangt de oude. Meerkeuze
 * (`allow_multiple`, HANDOFF 2.1): elke keuze gaat los aan of uit.
 */
export function usePollVote(poll: PollWithDetails, myUserId: string) {
  const qc = useQueryClient();
  const multiple = poll.allow_multiple;
  const [mine, setMine] = useState<Set<string>>(() => new Set(poll.my_vote_option_ids));

  const counts = poll.options.map((o) => {
    let n = o.vote_count;
    if (poll.my_vote_option_ids.includes(o.id)) n -= 1;
    if (mine.has(o.id)) n += 1;
    return n;
  });
  const total = counts.reduce((a, b) => a + b, 0);

  async function vote(optionId: string) {
    const wasOn = mine.has(optionId);
    if (!multiple && wasOn) return;
    const before = mine;
    const next = new Set(multiple ? mine : []);
    if (wasOn) next.delete(optionId);
    else next.add(optionId);
    setMine(next);
    try {
      await votePoll({ optionId, userId: myUserId, pollId: poll.id, multiple, wasOn });
      qc.invalidateQueries({ queryKey: ["unified-feed"] });
    } catch {
      setMine(before);
    }
  }

  return { mine, counts, total, vote };
}
