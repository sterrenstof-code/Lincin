import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { QueryError } from "@/components/QueryError";
import { feed, feedType, flameDeep, space } from "@/lib/design/type";

/**
 * Wat een detailpagina toont zolang er geen inhoud is.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT ER IS
 * ---------------------------------------------------------------
 * `QueryError` en `useToast()` haalden de vijf tabbladen uit de val die
 * DESIGN.md §4b beschrijft — stilte en leegte horen niet hetzelfde te
 * lezen. Op de detailpagina's bleef die val staan, en daar was hij erger.
 *
 * Ze schreven allemaal dezelfde regel:
 *
 *     if (event.isLoading || !event.data) return <Text>Event laden…</Text>
 *
 * Dat is één tak voor drie verschillende situaties. Laadt hij nog? Is de
 * query mislukt? Of bestaat het ding niet meer — verwijderd, of van
 * iemand die je uit je lincs gooide? Alle drie kwamen ze uit op hetzelfde
 * woord, en bij de laatste twee blijft dat woord er voor altijd staan,
 * want `data` wordt nooit meer gevuld.
 *
 * En dan het echte probleem: die tak tekende een kále `SafeAreaView` met
 * één regel tekst erin. Geen kop, geen balk, dus **geen terug-knop**. Open
 * de link naar een verwijderd event en je staat op een pagina die "Event
 * laden…" zegt tot je de app afsluit. Op web is dat de browserknop, in de
 * PWA op je homescherm is er geen browserknop.
 *
 * Vandaar dat dit onderdeel de hele schil meebrengt: dezelfde `PageScroll`
 * met dezelfde `backLabel`/`onBack` als het scherm zelf, zodat de kop
 * blijft staan en de weg terug er altijd is — juist in de stand waarin er
 * verder niets is.
 *
 * ---------------------------------------------------------------
 * DE DRIE STANDEN
 * ---------------------------------------------------------------
 * `loading`  — de wachtstand. Een regel, geen spinner: die pagina's tonen
 *              hun eigen skeletons zodra er vorm te tonen is.
 * `error`    — de query faalde. Dit is `QueryError`, ongewijzigd: het
 *              enige blok in de app met een rode omlijning (§4b), nu ook
 *              op de detailpagina's in plaats van alleen op de lijsten.
 * `missing`  — het ding bestaat niet (meer). Géén rode omlijning, want er
 *              is niets kapot; dit is een feit, geen storing. Een kicker,
 *              een zin, en de terugweg staat in de balk erboven.
 */
export function DetailState({
  kind,
  /** Waarover het ging: "Dit event", "Deze vondst", "Deze lijst". */
  subject,
  error,
  onRetry,
  backLabel,
  onBack,
}: {
  kind: "loading" | "error" | "missing";
  subject: string;
  error?: unknown;
  onRetry?: () => void;
  backLabel: string;
  onBack: () => void;
}) {
  const wide = useWide();
  const chrome = useChromeScroll();

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        backLabel={backLabel}
        onBack={onBack}
        contentStyle={{ paddingVertical: space.section }}
      >
        {kind === "error" ? (
          <QueryError
            title={`${subject} kon niet geladen worden`}
            error={error}
            onRetry={onRetry}
          />
        ) : kind === "missing" ? (
          <View style={{ maxWidth: 440 }}>
            <Text
              style={[
                feedType.kicker,
                { color: flameDeep, letterSpacing: 0.55, marginBottom: space.md },
              ]}
            >
              NIET GEVONDEN
            </Text>
            <Text
              style={[feedType.heroSmall, { color: feed.ink, marginBottom: space.md }]}
            >
              {subject} bestaat niet meer
            </Text>
            <Text style={[feedType.body, { color: feed.inkDim }]}>
              Hij is verwijderd, of je hebt er geen toegang (meer) toe. De
              link klopt misschien nog wel, maar er staat niets meer achter.
            </Text>
          </View>
        ) : (
          <Text style={[feedType.label, { color: feed.inkDim }]}>
            {subject} laden…
          </Text>
        )}
      </PageScroll>
    </SafeAreaView>
  );
}
