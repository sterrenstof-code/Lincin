/**
 * useMentions — herbruikbare @mention autocomplete voor elk tekstinvoerveld.
 *
 * Gebruik:
 *   const { mentionList, onChangeText, applyMention } = useMentions({ draft, setDraft, friends });
 *
 * Detecteert "@query" aan het einde van de invoer en zoekt in de opgegeven
 * `candidates` (naam + gebruikersnaam). Geeft maximaal 6 suggesties terug.
 *
 * De lijst `candidates` is meestal je vriendenlijst — dat is wie je het
 * vaakst noemt, dus die staat vooraan en verschijnt zonder wachten. Maar
 * je kunt iedereen noemen, ook wie nog niet in die lijst staat, dus wordt
 * er daarnaast op de server gezocht en komt dat resultaat erachteraan.
 * Meteen na de `@`, zonder dat je al iets getypt hebt, staat er dus al
 * iets: je hoeft niet te weten hoe iemands handle begint.
 */

import { useRef, useState } from "react";

import { searchProfilesForMention } from "./api/profiles";

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
  const remoteSeq = useRef(0);

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

    // `includes` en niet `startsWith`: je typt zelden de eerste letters
    // van een handle, je typt het stuk dat je je herinnert.
    const local = candidates
      .filter(
        (c) =>
          !query ||
          c.username.toLowerCase().includes(query) ||
          c.display.toLowerCase().includes(query)
      )
      .slice(0, 6);
    setMentionList(local.length > 0 ? local : null);

    // En daarnaast de rest van de mensen. Het antwoord komt later binnen;
    // een teller zorgt dat een traag antwoord op een oudere query de
    // lijst niet meer overschrijft.
    const mine = ++remoteSeq.current;
    searchProfilesForMention(query).then((profiles) => {
      if (mine !== remoteSeq.current) return;
      const merged = [...local];
      for (const prof of profiles) {
        if (merged.some((c) => c.id === prof.id)) continue;
        merged.push({
          id: prof.id,
          display: prof.display_name ?? prof.username,
          username: prof.username,
          avatarUrl: prof.avatar_url,
        });
      }
      setMentionList(merged.length > 0 ? merged.slice(0, 6) : null);
    });
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
