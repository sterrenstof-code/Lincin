import { Redirect } from "expo-router";
import { useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth/provider";
import { desk } from "@/lib/design/type";
import { takePendingInvite } from "@/lib/pending-invite";

export default function Index() {
  const { session, loading } = useAuth();

  /**
   * Een openstaande uitnodiging gaat vóór de feed.
   *
   * `/e/{code}` is de enige link die deze app naar buiten stuurt, en juist
   * de ontvanger daarvan heeft meestal nog geen sessie. Die werd doorgestuurd
   * naar het inlogscherm en kwam daarna uit op een lege feed: het event
   * waarvoor iemand hem uitnodigde was nergens meer te vinden, en de link was
   * eenmalig doorgestuurd. Zie lib/pending-invite.ts.
   *
   * `useMemo` en niet zomaar in de render: `takePendingInvite` verbruikt de
   * code, en dit onderdeel rendert twee keer (laden, dan de sessie). Zonder
   * dat zou de eerste render hem opeten terwijl `loading` nog waar is, en
   * dan is hij weg vóórdat er iets mee gedaan kan worden.
   */
  const invite = useMemo(
    () => (loading ? null : takePendingInvite()),
    [loading]
  );

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-desk">
        <ActivityIndicator color={desk.ink} />
      </View>
    );
  }

  if (!session) return <Redirect href="/(auth)/login" />;
  // Terug naar het uitnodigingsscherm zelf: dat kent de RPC, de drie
  // uitkomsten (open, gesloten, mislukt) en de weg terug. Die logica hier
  // nog eens uitschrijven zou een tweede versie ervan zijn.
  if (invite) return <Redirect href={`/e/${encodeURIComponent(invite)}`} />;
  return <Redirect href="/(app)/feed" />;
}
