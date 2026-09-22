import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDeferredValue, useState } from "react";

import {
  acceptFriendRequest,
  deleteFriendship,
  listMyFriendships,
  sendFriendRequest,
} from "@/lib/api/friends";
import { getProfile, searchProfilesByUsername } from "@/lib/api/profiles";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { buildAddFriendUrl, shareText } from "@/lib/share";
import { useToast } from "@/lib/toast";

/**
 * Alles wat het Lincs-scherm weet en doet, los van hoe het eruitziet.
 *
 * Dit stond in `app/(app)/friends.tsx`, en dat was prima zolang er één vorm
 * was. Nu tekent het brede scherm Lincs in de Lincin-rail (`DesktopFriends`)
 * en de telefoon in zijn eigen kop, en die twee mogen niet uit elkaar
 * groeien in wat ze dóén: één bevestiging voor verbreken, één foutmelding
 * per soort, één zoekrem. Vandaar één bron.
 */
export function useFriendsModel() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const qc = useQueryClient();
  const toast = useToast();

  const [query, setQuery] = useState("");

  const profile = useQuery({
    queryKey: ["profile", myUserId],
    queryFn: () => getProfile(myUserId),
  });

  async function onShareLink() {
    const username = profile.data?.username;
    if (!username) return;
    await shareText({
      title: "Voeg me toe op Lincin",
      message: `Linc met mij op Lincin: ${buildAddFriendUrl(username)}`,
    });
  }
  const trimmed = query.trim();

  const friendships = useQuery({
    queryKey: ["friendships", myUserId],
    queryFn: () => listMyFriendships(myUserId),
  });

  /**
   * Zoeken zonder per toetsaanslag te flikkeren.
   *
   * Twee dingen ontbraken. Er was geen rem, dus "tomcoysman" waren elf
   * queries naar de server voor tien antwoorden die je nooit gezien hebt. En
   * er was geen `placeholderData`, dus bij élke aanslag ging `data` naar
   * `undefined` en verving een skeleton de lijst die er stond — de resultaten
   * knipperden weg en terug terwijl je typte, wat het lezen ervan onmogelijk
   * maakt.
   *
   * `useDeferredValue` en geen `setTimeout`: React stelt de zoekterm zelf uit
   * zolang er getypt wordt, en dat is nauwkeuriger dan een vast aantal
   * milliseconden raden. `keepPreviousData` laat de vorige lijst staan tot de
   * volgende er is; dat hij dan even één letter achterloopt is minder erg dan
   * dat hij verdwijnt.
   */
  const deferredQuery = useDeferredValue(trimmed);
  const search = useQuery({
    queryKey: ["search-profiles", deferredQuery, myUserId],
    queryFn: () => searchProfilesByUsername(deferredQuery, myUserId),
    enabled: deferredQuery.length >= 2,
    placeholderData: keepPreviousData,
  });

  const pendingIncoming = (friendships.data ?? []).filter(
    (f) => f.status === "pending" && f.addressee_id === myUserId
  );
  const pendingOutgoing = (friendships.data ?? []).filter(
    (f) => f.status === "pending" && f.requester_id === myUserId
  );
  const accepted = (friendships.data ?? []).filter((f) => f.status === "accepted");

  const friendIds = new Set([
    ...accepted.flatMap((f) => [f.requester_id, f.addressee_id]),
    ...pendingIncoming.map((f) => f.requester_id),
    ...pendingOutgoing.map((f) => f.addressee_id),
  ]);

  const searchResults = (search.data ?? []).filter((p) => !friendIds.has(p.id));

  async function onSendRequest(targetId: string) {
    try {
      await sendFriendRequest(myUserId, targetId);
      await qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
      setQuery("");
      toast.show("Linc-verzoek verstuurd.");
    } catch {
      toast.error("Het verzoek kon niet verstuurd worden.", {
        action: { label: "Opnieuw", onPress: () => onSendRequest(targetId) },
      });
    }
  }

  async function onAccept(friendshipId: string, requesterId: string) {
    try {
      await acceptFriendRequest(friendshipId, myUserId, requesterId);
      await qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
    } catch {
      // Stond hier zonder `try`: een mislukte accept werd een onafgevangen
      // rejection, dus de rij bleef staan en er stond nergens waarom.
      toast.error("Het verzoek kon niet aanvaard worden.", {
        action: {
          label: "Opnieuw",
          onPress: () => onAccept(friendshipId, requesterId),
        },
      });
    }
  }

  /**
   * Eén verzoek intrekken, weigeren of een linc verbreken.
   *
   * Alle drie de knoppen riepen dit rechtstreeks aan: één tik op
   * "Verwijder" en de linc was weg — geen bevestiging, geen weg terug, en
   * bij een fout een onafgevangen rejection. De chatlijst ernaast vraagt
   * voor precies dezelfde zwaarte wél om bevestiging, in twee stappen.
   *
   * Nu bepaalt `kind` wat er hoort te gebeuren:
   *   remove  — een bestaande linc. Verbreken raakt iemand anders en is
   *             niet ongedaan te maken: bevestigen.
   *   reject  — een verzoek dat iemand jou stuurde. Weiger je het, dan moet
   *             hij opnieuw beginnen: bevestigen.
   *   cancel  — je eigen verzoek intrekken. Kost jou één tik om opnieuw te
   *             sturen, dus daar staat een venster alleen maar in de weg.
   */
  async function onDelete(
    friendshipId: string,
    kind: "remove" | "reject" | "cancel",
    name: string,
    /**
     * Overslaan van het bevestigingsvenster bij een tweede poging — je hebt
     * net al ja gezegd. Dit stond eerder als `kind: "cancel"` meegegeven, en
     * daardoor koos de fóutmelding erna ook de cancel-tekst: "het verzoek kon
     * niet ingetrokken worden" voor een linc die je probeerde te verbreken.
     */
    alreadyConfirmed = false
  ) {
    if (kind !== "cancel" && !alreadyConfirmed) {
      const ok = await confirm(
        kind === "remove" ? `Linc met ${name} verbreken?` : `Verzoek van ${name} weigeren?`,
        kind === "remove"
          ? "Jullie verdwijnen uit elkaars lijst. Je kunt daarna opnieuw een verzoek sturen."
          : "Het verzoek verdwijnt. Wil je later toch, dan moet die persoon opnieuw een verzoek sturen.",
        {
          affirmativeLabel: kind === "remove" ? "Verbreken" : "Weigeren",
          destructive: true,
        }
      );
      if (!ok) return;
    }

    try {
      await deleteFriendship(friendshipId);
      await qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
    } catch {
      toast.error(
        kind === "remove"
          ? "De linc kon niet verbroken worden."
          : kind === "reject"
          ? "Het verzoek kon niet geweigerd worden."
          : "Het verzoek kon niet ingetrokken worden.",
        {
          action: {
            label: "Opnieuw",
            onPress: () => onDelete(friendshipId, kind, name, true),
          },
        }
      );
    }
  }


  return {
    myUserId,
    profile,
    friendships,
    query,
    setQuery,
    trimmed,
    search,
    searchResults,
    pendingIncoming,
    pendingOutgoing,
    accepted,
    onShareLink,
    onSendRequest,
    onAccept,
    onDelete,
  };
}
