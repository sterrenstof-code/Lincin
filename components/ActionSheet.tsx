import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { ModalShell } from "@/components/ModalShell";
import { feed, FEED_BORDER, feedType, flameDeep, space } from "@/lib/design/type";

export type ActionSheetAction = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  /** Async / sync handler. Sheet closes automatically afterwards. */
  onPress: () => void | Promise<void>;
};

/**
 * Een lijstje met wat je kunt doen, in het midden van het scherm.
 *
 * Stond eerder onderaan, als blad dat omhoog schoof. Dat is een patroon van
 * een telefoon-app; op een breed scherm is de onderrand juist de plek waar
 * je níet kijkt, en een blad dat vanaf daar komt zetten trekt de aandacht
 * naar de verkeerde hoek. Zie ModalShell voor de vorm en de beweging.
 */
export function ActionSheet({
  visible,
  onClose,
  title,
  subtitle,
  actions,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  /**
   * Eén zin onder de kop, voor wanneer de regels zelf niet het hele
   * verhaal vertellen — bijvoorbeeld dat een keuze ook video's aankan.
   * Staat boven de eerste regel en is geen knop.
   */
  subtitle?: string;
  actions: ActionSheetAction[];
  /**
   * Iets dat onder de rij acties staat en het venster níet sluit — een
   * schakelaar in plaats van een opdracht. Krijgt zijn eigen lijn erboven,
   * want het is een ander soort ding dan de regels erboven.
   */
  footer?: ReactNode;
}) {
  /**
   * Een bevestiging heeft twee antwoorden, en er stond er maar één.
   *
   * De bevestigingssheets van de chatlijst bestaan uit precies één regel:
   * "Verwijder definitief", of "Verlaat groep". Je krijgt de vraag "verwijder
   * dit gesprek voor iedereen?" en er is geen "nee" — alleen wegtikken naast
   * het venster, wat tot deze commit niet eens zichtbaar was. Dat is een val:
   * de énige knop in beeld is degene die iets kapotmaakt.
   *
   * De uitweg staat er nu automatisch bij zodra er iets destructiefs in de
   * lijst zit, en niet als losse regel per aanroeper — anders staat hij op de
   * ene sheet wel en op de andere niet, en dat is precies het soort verschil
   * dat vanzelf blijft bestaan (§8).
   *
   * Bij een gewoon menu ("Verberg gesprek", "Poll", "Videocall plannen")
   * blijft hij weg: daar is elke regel een keuze en niet een laatste kans, en
   * een "Annuleer" onder een keuzelijst is ruis.
   */
  const needsCancel = actions.some((a) => a.destructive);

  return (
    <ModalShell visible={visible} onClose={onClose} title={title}>
      <View>
        {subtitle ? (
          <View
            style={{
              paddingHorizontal: space.lg,
              paddingBottom: space.lg,
              borderBottomWidth: FEED_BORDER,
              borderBottomColor: feed.ink,
            }}
          >
            <Text style={[feedType.body, { fontSize: 14, color: feed.inkDim }]}>
              {subtitle}
            </Text>
          </View>
        ) : null}
        {actions.map((action, i) => (
          <Pressable
            key={action.label}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            onPress={async () => {
              onClose();
              // Kleine vertraging zodat de overgang klaar is voor een
              // volgend venster (bijvoorbeeld een bevestiging) opengaat.
              setTimeout(() => {
                Promise.resolve(action.onPress()).catch(() => {});
              }, 60);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.lg,
              ...(i === actions.length - 1 && !footer && !needsCancel
                ? null
                : { borderBottomWidth: FEED_BORDER, borderBottomColor: feed.ink }),
            }}
          >
            {action.icon && (
              <Ionicons
                name={action.icon}
                size={20}
                // Was `#B23A1C`: een negende rood, ingebakken in het
                // onderdeel dat élke destructieve actie in de app tekent —
                // en een hexwaarde die niet meekantelt met de stand (§7).
                // `flameDeep` is het rood voor tekst onder ~16px (§2).
                color={action.destructive ? flameDeep : feed.ink}
              />
            )}
            <Text
              style={[
                feedType.tile,
                {
                  fontSize: 15,
                  fontWeight: "700",
                  color: action.destructive ? flameDeep : feed.ink,
                },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}

        {needsCancel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Annuleer"
            onPress={onClose}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.lg,
              ...(footer
                ? { borderBottomWidth: FEED_BORDER, borderBottomColor: feed.ink }
                : null),
            }}
          >
            <Ionicons name="close" size={20} color={feed.inkDim} />
            <Text
              style={[
                feedType.tile,
                { fontSize: 15, fontWeight: "700", color: feed.inkDim },
              ]}
            >
              Annuleer
            </Text>
          </Pressable>
        ) : null}
      </View>
      {footer ? (
        <View style={{ borderTopWidth: FEED_BORDER, borderTopColor: feed.ink }}>
          {footer}
        </View>
      ) : null}
    </ModalShell>
  );
}
