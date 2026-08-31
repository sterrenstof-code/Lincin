import { useCallback, useRef, useState, type ReactNode } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";

import { ModalShell } from "@/components/ModalShell";
import {
  CONTROL_H,
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  flameDeep,
  space,
} from "@/lib/design/type";

/**
 * De vraag "weet je het zeker", en waar hij getekend wordt.
 *
 * ---------------------------------------------------------------
 * WAT ER MIS WAS
 * ---------------------------------------------------------------
 * Dit was één functie van vijftien regels, en op web viel hij terug op
 * `window.confirm(title + message)`. Die dialoog heeft twee knoppen en die
 * heten "OK" en "Annuleren" — de browser bepaalt dat, en er is geen manier
 * om het te veranderen. `affirmativeLabel` werd dus stilzwijgend weggegooid.
 *
 * Dat is niet cosmetisch. De aanroepers gebruiken dat label om te zeggen
 * wát er gaat gebeuren: "Weggaan", "Verwijder definitief", "Verlaat groep",
 * en — de scherpste — "Reset" op het herstellen van je toestelsleutels. Dat
 * is de enige onomkeerbare handeling in een end-to-end versleutelde app:
 * daarna kun je oude berichten op andere toestellen nooit meer lezen. En de
 * vraag ernaar eindigde op web in een grijs venster met "OK".
 *
 * Er zat ook geen enkel verschil in tussen een gewone en een destructieve
 * bevestiging. `destructive: true` deed op web niets. Je zag aan niets dat
 * de ene knop een lijst opent en de andere iets weggooit.
 *
 * ---------------------------------------------------------------
 * WAAROM ALLEEN WEB EEN EIGEN VENSTER KRIJGT
 * ---------------------------------------------------------------
 * Op native is `Alert.alert` niet stuk: die tóónt het label, kent
 * `style: "destructive"` (rood, van het besturingssysteem zelf), en is de
 * dialoog die iemand daar van elke andere app kent. Hem vervangen door een
 * eigen venster zou een werkend ding inruilen voor een nagebouwd ding.
 *
 * Web is het hoofdplatform en heeft die dialoog niet. Daar tekent
 * `ModalShell` hem — dezelfde vorm en dezelfde beweging als élk ander
 * venster in de app (DESIGN.md §5), met het echte label erop en de
 * destructieve knop in `flameDeep`.
 *
 * ---------------------------------------------------------------
 * WAAROM EEN PROVIDER EN GEEN HOOK
 * ---------------------------------------------------------------
 * `confirm()` wordt aangeroepen vanuit gewone async-functies — een
 * verwijderhandler, een navigatiebewaking — en niet vanuit een render. Een
 * hook kan daar niet bij. De provider laat daarom één opener achter op
 * moduleniveau; `confirm()` gebruikt die als hij er is en valt anders terug
 * op wat er was. Dat terugvallen is geen dode tak: een los gerenderd
 * onderdeel buiten de wortel heeft geen provider boven zich, en dan is een
 * lelijke vraag nog altijd beter dan een vraag die niet gesteld wordt.
 */

export type ConfirmOptions = {
  affirmativeLabel?: string;
  destructive?: boolean;
};

type ConfirmRequest = ConfirmOptions & {
  title: string;
  message: string;
  resolve: (ok: boolean) => void;
};

/** De opener van het venster in de wortel, als dat gemonteerd is. */
let openWebConfirm: ((req: Omit<ConfirmRequest, "resolve">) => Promise<boolean>) | null = null;

export function confirm(
  title: string,
  message: string,
  options: ConfirmOptions = {}
): Promise<boolean> {
  const affirmative = options.affirmativeLabel ?? "OK";

  if (Platform.OS === "web") {
    if (openWebConfirm) {
      return openWebConfirm({ title, message, ...options });
    }
    // Geen provider boven ons. Onmooi, maar de vraag wordt gesteld.
    return Promise.resolve(
      typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)
    );
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Annuleer", style: "cancel", onPress: () => resolve(false) },
      {
        text: affirmative,
        style: options.destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  // De belofte van het openstaande venster, zodat sluiten via de ✕ of de
  // achtergrond hetzelfde "nee" oplevert als de annuleerknop. Zonder dit
  // blijft de aanroeper hangen op een promise die nooit afloopt.
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const settle = useCallback((ok: boolean) => {
    pending.current?.(ok);
    pending.current = null;
    setRequest(null);
  }, []);

  const open = useCallback(
    (req: Omit<ConfirmRequest, "resolve">) =>
      new Promise<boolean>((resolve) => {
        // Een tweede vraag terwijl de eerste nog openstaat kan alleen door
        // een fout in de aanroeper ontstaan. De eerste beantwoorden we met
        // "nee" in plaats van hem te laten hangen.
        pending.current?.(false);
        pending.current = resolve;
        setRequest({ ...req, resolve });
      }),
    []
  );

  // Op moduleniveau achterlaten, niet in een effect: `confirm()` kan al
  // aangeroepen worden voordat effecten gelopen hebben.
  openWebConfirm = Platform.OS === "web" ? open : null;

  return (
    <>
      {children}
      <ModalShell
        visible={!!request}
        onClose={() => settle(false)}
        title={request?.title}
        maxWidth={420}
      >
        <View style={{ padding: space.lg }}>
          <Text style={[feedType.body, { color: feed.ink }]}>
            {request?.message}
          </Text>

          {/* Annuleren links en omlijnd, doorgaan rechts en gevuld. Eén
              gevulde knop per venster (§4), en dat is degene die iets doet. */}
          <View
            style={{
              flexDirection: "row",
              gap: space.md,
              marginTop: space.xl,
              justifyContent: "flex-end",
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Annuleer"
              onPress={() => settle(false)}
              style={({ pressed }) => ({
                height: CONTROL_H,
                paddingHorizontal: space.xl,
                justifyContent: "center",
                borderWidth: FEED_BORDER,
                borderColor: feed.ink,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text style={[feedType.label, { color: feed.ink }]}>Annuleer</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={request?.affirmativeLabel ?? "OK"}
              onPress={() => settle(true)}
              style={({ pressed }) => ({
                height: CONTROL_H,
                paddingHorizontal: space.xl,
                justifyContent: "center",
                // Rood alleen als er iets kapot gaat. `flameDeep` en niet
                // `flame`: dit label is klein, en §2 zegt dat de default
                // daaronder geen 4.5:1 haalt.
                backgroundColor: request?.destructive ? flameDeep : feed.ink,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>
                {request?.affirmativeLabel ?? "OK"}
              </Text>
            </Pressable>
          </View>
        </View>
      </ModalShell>
    </>
  );
}
