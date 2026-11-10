import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";

import { EditPost } from "@/components/lincin/EditPost";
import { PrivateSheet } from "@/components/lincin/PrivateSheet";
import { LIKE } from "@/lib/lincin/likes";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";

import { CardVoorwerp, datumVan } from "../kaart";
import { ExtraRegel, Stand } from "./Lijsten";
import { BijdrageView } from "./BijdrageView";
import { useBijdrage } from "./useBijdrage";

/**
 * De bijdrage in catalogus op echte gegevens (`useBijdrage`: dezelfde haken
 * als app/post/[id].tsx), in de vorm van ontwerp 05 en 14–16.
 */
export function BijdrageCatalogus({ id }: { id: string }) {
  const { reageer } = useLocalSearchParams<{ reageer?: string }>();
  const router = useRouter();
  const b = useBijdrage(id);
  const { t, p, card } = b;
  const [actief, setActief] = useState(!!reageer);
  usePageTitle(card?.title ?? null);

  const wakker = () => setActief(true);
  const terug = () => safeBack(router, "/feed");
  // `?reageer=1`: het invoerveld meteen in focus.
  const focus = b.focus + (reageer ? 1 : 0);

  if (!p || !card) {
    return (
      <BijdrageView
        kop={[{ label: "Bijdrage", waarde: b.post.isError ? t.failed : t.loading }]}
        voorwerp={null}
        titelTekst=""
        regels={[]}
        actief={false}
        hartjes=""
        vindIkLeuk={false}
        aantalReacties=""
        berichtAan={null}
        leukDoor={null}
        reacties={[]}
        antwoordAan={null}
        invoer=""
        menu={null}
        meer={<Stand tekst={b.post.isError ? t.failed : t.loading} />}
        doe={{
          terug,
          meer: () => {},
          sluitMenu: () => {},
          leuk: () => {},
          reacties: () => {},
          wakker: () => {},
          leukReactie: () => {},
          antwoord: () => {},
          stopAntwoord: () => {},
          tekst: () => {},
          stuur: () => {},
        }}
      />
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <BijdrageView
        kop={[
          { label: "Bijdrage", waarde: datumVan(card) },
          { label: "Wie", waarde: b.naam },
          { label: "Soort", waarde: card.kind },
        ]}
        voorwerp={<CardVoorwerp card={card} plek={actief ? "bijdrageActief" : "bijdrage"} />}
        titelTekst={card.title}
        regels={[
          { label: "Wie", waarde: b.naam },
          { label: "Soort", waarde: card.kind },
          { label: "Datum", waarde: datumVan(card) },
          { label: "Reacties", waarde: String(b.comments.total) },
        ]}
        actief={actief}
        hartjes={b.likes.count}
        vindIkLeuk={b.likes.liked}
        aantalReacties={b.comments.total}
        berichtAan={b.own ? null : b.naam}
        leukDoor={b.leukDoor}
        reacties={b.reacties(true)}
        antwoordAan={b.antwoordNaam}
        invoer={b.draft}
        focus={focus}
        onder={b.onder || undefined}
        menu={b.menu ? { kop: `${datumVan(card)} · ${b.naam}`, regels: b.menuRegels } : null}
        meer={
          <>
            {b.comments.hasMore ? <ExtraRegel label="Meer reacties" rechts={`${b.comments.moreCount} →`} onPress={b.comments.loadMore} /> : null}
            {b.bewerk ? <EditPost post={p} onDone={() => b.setBewerk(false)} /> : null}
          </>
        }
        doe={{
          terug,
          meer: () => (wakker(), b.setMenu(true)),
          sluitMenu: () => b.setMenu(false),
          leuk: () => (wakker(), b.likes.toggle(LIKE)),
          reacties: () => (wakker(), b.setFocus((n) => n + 1)),
          bericht: () => b.praatOver(),
          wakker,
          leukReactie: (cid) => b.comments.toggleLike(cid),
          antwoord: b.antwoord,
          stopAntwoord: b.stopAntwoord,
          tekst: b.setDraft,
          stuur: b.stuur,
        }}
      />
      <PrivateSheet target={b.sheet} onClose={() => b.setSheet(null)} />
    </KeyboardAvoidingView>
  );
}
