import { Pressable, Text, View } from "react-native";

import {
  announce,
  announceDeep,
  CONTROL_H,
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  space,
} from "@/lib/design/type";

/**
 * Een lijst die leeg is, en wat je eraan kunt doen.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN ONDERDEEL IS
 * ---------------------------------------------------------------
 * `QueryError` scheidde de mislukte query van de lege lijst (§4b), maar de
 * lege lijst zelf stond daarna nog steeds vier keer uitgeschreven, en op
 * elk van die vier plekken nét anders: de feed zonder kader op tachtig
 * punten witruimte, de chatlijst met een kader en `space.xxxl`, de
 * meldingen met een kader én een vulling, en het profielraster met een
 * vulling zónder kader — die laatste is bovendien verboden door §4, want
 * een gevuld vlak is de primaire actie en verder niets.
 *
 * Vier vormen voor één zin. Precies het soort verschil waar §8 over gaat:
 * het blijft bestaan zolang niemand het opschrijft.
 *
 * ---------------------------------------------------------------
 * EN WAAROM ER EEN KNOP IN KAN
 * ---------------------------------------------------------------
 * Het echte gebrek zat niet in de vorm maar in het doodlopen. Elk van die
 * vier teksten noemde een handeling — "voeg vrienden toe", "ga naar Lincs",
 * "plaats je eerste vondst vanaf de feed" — en bood er geen enkele ingang
 * bij. Op een nieuw account is dat geen ongemak maar een muur: je hebt geen
 * lincs, dus de feed kán niet vullen, en het scherm dat dat zegt laat je
 * er niet naartoe.
 *
 * De knop is daarom optioneel en er is er hóógstens één. §4 laat één gevuld
 * vlak per scherm toe en dat is de primaire actie; staat die er al (de
 * zwevende oranje plus op de feed), dan hoort de lege stand alleen te
 * vertellen. Dat is dezelfde afweging die de agenda eerder maakte, waar
 * twee gevulde knoppen naar dezelfde route wezen.
 */
export function EmptyState({
  title,
  body,
  action,
  style,
}: {
  title: string;
  body: string;
  /** Hóógstens één, en alleen als het scherm er nog geen gevulde heeft. */
  action?: { label: string; onPress: () => void };
  style?: object;
}) {
  return (
    <View
      style={[
        {
          borderWidth: FEED_BORDER,
          borderColor: feed.ink,
          padding: space.xxxl,
        },
        style,
      ]}
    >
      <Text
        style={[
          feedType.tile,
          { fontSize: 20, color: feed.ink, marginBottom: space.sm },
        ]}
      >
        {title}
      </Text>
      <Text style={[feedType.body, { color: feed.inkDim, maxWidth: 440 }]}>
        {body}
      </Text>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={action.label}
          onPress={action.onPress}
          style={({ pressed }) => ({
            marginTop: space.xl,
            alignSelf: "flex-start",
            backgroundColor: pressed ? announceDeep : announce,
            paddingHorizontal: space.xl,
            // De hoogte van élk besturingselement (§4b). Eén maat, anders
            // staat een rij met een knop van 36 en een van 44 nergens op
            // één lijn.
            height: CONTROL_H,
            justifyContent: "center",
          })}
        >
          {/* Crème op oranje en niet `feed.text`: dit vlak kantelt niet mee
              met de stand, dus zijn tekst mag dat ook niet (§2). */}
          <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
