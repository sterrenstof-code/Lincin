import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth/provider";
import { desk } from "@/lib/design/type";

/**
 * De poort voor schermen die buiten `(app)` staan.
 *
 * ---------------------------------------------------------------
 * WAAROM DIE POORT ONTBRAK
 * ---------------------------------------------------------------
 * `app/(app)/_layout.tsx` bewaakt de tabbladen, en `app/(auth)/_layout.tsx`
 * stuurt je wég als je al ingelogd bent. Daartussenin staat de wortelstack,
 * en die bewaakt niets — terwijl er schermen in geregistreerd staan die
 * meteen `session!.user.id` uitlezen: `device-receive`, `device-link`,
 * `qr-code`, `profile-edit`.
 *
 * `session!` is geen belofte maar een aanname. Klopt hij niet, dan is het
 * een `TypeError` op de eerste regel en zie je een wit scherm — geen
 * melding, geen weg terug.
 *
 * En dat is geen theoretisch geval. `device-receive` documenteert in zijn
 * eigen kop dat hij via een deep-link binnenkomt
 * (`lincin://device-receive?s=…&u=…`), en dat is precies het scherm waar je
 * het mínst waarschijnlijk al een sessie hebt: je opent het op een nieuw
 * toestel, want dat is waar het voor bedoeld is.
 *
 * ---------------------------------------------------------------
 * WAAROM HIER EN NIET IN DE WORTELLAYOUT
 * ---------------------------------------------------------------
 * Een bewaking rond de hele wortelstack zou ook `index`, `(auth)` en
 * `/e/[code]` afvangen, en die drie hóren juist zonder sessie te werken —
 * `/e/[code]` bewaart zijn uitnodiging en stuurt je zelf naar het
 * inlogscherm. Eén regel per scherm dat het nodig heeft is preciezer dan
 * een regel met drie uitzonderingen.
 */
export function RequireSession({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  // Zolang het onbekend is: niets beweren. Meteen naar het inlogscherm
  // sturen zou iedereen die de app opent één keer laten wippen.
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-desk">
        <ActivityIndicator color={desk.ink} />
      </View>
    );
  }

  // Via `/` en niet rechtstreeks naar het inlogscherm: daar wordt beslist
  // waar je heen moet zodra er wél een sessie is, inclusief een openstaande
  // uitnodiging. Zie app/index.tsx.
  if (!session) return <Redirect href="/" />;

  return <>{children}</>;
}
