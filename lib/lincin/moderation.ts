import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { blockUser } from "../api/friends";
import { confirm } from "../confirm";
import { supabase } from "../supabase/client";
import { useToast } from "../toast";

/**
 * Melden en blokkeren (App Store-richtlijn 1.2, nov 2026). Een melding komt
 * in `content_reports` (0084), bij de beheerders, niet bij de schrijver.
 * Blokkeren: zie 0106.
 */
export function useModeration() {
  const toast = useToast();
  const qc = useQueryClient();

  const reportPost = useCallback(
    async (postId: string) => {
      const ok = await confirm("Bijdrage melden?", "We bekijken hem zo snel mogelijk. De schrijver ziet niet wie meldde.", {
        affirmativeLabel: "Meld",
        destructive: true,
      });
      if (!ok) return;
      const { error } = await supabase.from("content_reports").insert({ post_id: postId, reason: null });
      if (error) toast.error("Melden lukte niet. Probeer het opnieuw.");
      else toast.show("Gemeld. Dank je.");
    },
    [toast],
  );

  /** `true` als er geblokkeerd is. */
  const block = useCallback(
    async (userId: string, name: string): Promise<boolean> => {
      const ok = await confirm(
        `${name} blokkeren?`,
        "Jullie zijn dan geen lincs meer en zien elkaars bijdragen niet. Je verlaat jullie gesprek, en er kunnen geen verzoeken meer komen. Opheffen kan in Instellingen.",
        { affirmativeLabel: "Blokkeer", destructive: true },
      );
      if (!ok) return false;
      try {
        await blockUser(userId);
      } catch {
        toast.error("Blokkeren lukte niet. Probeer het opnieuw.");
        return false;
      }
      toast.show(`${name} is geblokkeerd.`);
      await qc.invalidateQueries();
      return true;
    },
    [toast, qc],
  );

  return { reportPost, block };
}
