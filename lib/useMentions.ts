/**
 * useMentions — herbruikbare @mention autocomplete voor elk tekstinvoerveld.
 *
 * Gebruik:
 *   const { mentionList, onChangeText, applyMention } = useMentions({ draft, setDraft, friends });
 *
 * Detecteert "@query" aan het einde van de invoer en zoekt in de opgegeven
 * `candidates` (naam + gebruikersnaam). Geeft maximaal 6 suggesties terug.
 */

import { useState } from "react";

export type MentionCandidate = {
  id: string;
  display: string;    // weergavenaam of gebruikersnaam
  username: string;
  avatarUrl?: string | null;
};

export function useMentions({
  draft,
  setDraft,
  candidates,
}: {
  draft: string;
  setDraft: (text: string) => void;
  candidates: MentionCandidate[];
}) {
  const [mentionList, setMentionList] = useState<MentionCandidate[] | null>(null);

  function onChangeText(text: string) {
    setDraft(text);
    updateMentionState(text);
  }

  function updateMentionState(text: string) {
    const match = text.match(/(?:^|\s)@([a-z0-9._]*)$/i);
    if (!match) {
      setMentionList(null);
      return;
    }
    const query = match[1].toLowerCase();
    const results = candidates
      .filter((c) =>
        !query ||
        c.username.toLowerCase().startsWith(query) ||
        c.display.toLowerCase().startsWith(query)
      )
      .slice(0, 6);
    setMentionList(results.length > 0 ? results : null);
  }

  function applyMention(username: string) {
    const replaced = draft.replace(/(?:^|\s)@([a-z0-9._]*)$/i, (m) => {
      const leading = /^\s/.test(m) ? m[0] : "";
      return `${leading}@${username} `;
    });
    setDraft(replaced);
    setMentionList(null);
  }

  function dismissMentions() {
    setMentionList(null);
  }

  return { mentionList, onChangeText, applyMention, dismissMentions };
}
