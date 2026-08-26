import { StyleSheet, Text, View, type TextStyle } from "react-native";

import { parseRich, type InlineSpan, type RichBlock } from "@/lib/richtext";
import { space } from "@/lib/design/type";

/**
 * Opgemaakte tekst, in de typografie van de plek waar hij staat.
 *
 * Dit onderdeel kiest geen lettertype en geen kleur. Het krijgt de stijl
 * mee van de pagina — het citaatblok van een fragment, de serif van een
 * weetje — en varieert daarbinnen alleen wat de schrijver bedoelde:
 * zwaarte voor nadruk, schuinte voor een titel, een inspringing voor een
 * citaat. Zo kan opmaak nooit uit de toon vallen tegen het stelsel in
 * `lib/design/type.ts`, hoe iemand ook typt.
 *
 * Alinea's krijgen ruimte van elkaar in plaats van een lege regel: een
 * witregel in de brontekst is een *scheiding*, en die druk je uit met
 * afstand, niet met een leeg tekstblok van volle regelhoogte.
 */
export function RichText({
  text,
  style,
  color,
  dimColor,
  ruleColor,
  numberOfLines,
}: {
  text: string;
  /** De basisstijl. Vet en cursief variëren híerop, ze vervangen hem niet. */
  style: TextStyle | TextStyle[];
  color: string;
  /** Voor het bronregeltje van een citaatblok en de bullets. Valt terug op `color`. */
  dimColor?: string;
  /** De scheidingslijn. Valt terug op `dimColor`. */
  ruleColor?: string;
  /**
   * Alleen zinvol als de tekst uit één alinea bestaat — bij meer blokken
   * kan React Native niet over de blokken heen afkappen. Voor krappe
   * plekken is `stripMarkdown()` de juiste keuze, niet dit.
   */
  numberOfLines?: number;
}) {
  const blocks = parseRich(text);
  const dim = dimColor ?? color;
  const rule = ruleColor ?? dim;

  if (blocks.length === 0) return null;

  return (
    <View>
      {blocks.map((block, i) => (
        <Block
          key={i}
          block={block}
          first={i === 0}
          style={style}
          color={color}
          dim={dim}
          rule={rule}
          numberOfLines={blocks.length === 1 ? numberOfLines : undefined}
        />
      ))}
    </View>
  );
}

function Block({
  block,
  first,
  style,
  color,
  dim,
  rule,
  numberOfLines,
}: {
  block: RichBlock;
  first: boolean;
  style: TextStyle | TextStyle[];
  color: string;
  dim: string;
  rule: string;
  numberOfLines?: number;
}) {
  const top = first ? 0 : space.md;

  if (block.kind === "rule") {
    return (
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: rule,
          opacity: 0.5,
          width: 48,
          marginTop: space.lg,
          marginBottom: space.sm,
        }}
      />
    );
  }

  if (block.kind === "quote") {
    // Een citaat binnen een citaat: geen aanhalingstekens erbij, maar een
    // haarlijn ernaast en een inspringing. Dat is dezelfde taal als de
    // rest van de app en het blijft leesbaar op elke achtergrond.
    return (
      <View style={{ flexDirection: "row", marginTop: top }}>
        <View
          style={{
            width: StyleSheet.hairlineWidth,
            backgroundColor: rule,
            opacity: 0.6,
            marginRight: space.md,
          }}
        />
        <Text style={[style, { color: dim, flex: 1, fontStyle: "italic" }]}>
          <Spans spans={block.spans} />
        </Text>
      </View>
    );
  }

  if (block.kind === "list") {
    // De kolom met de tekens krijgt een vaste breedte zodat de tekst
    // uitlijnt, ook als de lijst voorbij de negen loopt en "10." breder is
    // dan "9.". Een lijst die verspringt leest als een fout.
    const markerWidth = block.ordered ? 26 : 14;
    return (
      <View style={{ marginTop: top }}>
        {block.items.map((item, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              marginTop: i === 0 ? 0 : space.xs,
            }}
          >
            <Text
              style={[
                style,
                { color: dim, width: markerWidth, marginRight: space.sm },
              ]}
            >
              {block.ordered ? `${i + 1}.` : "·"}
            </Text>
            <Text style={[style, { color, flex: 1 }]}>
              <Spans spans={item} />
            </Text>
          </View>
        ))}
      </View>
    );
  }

  return (
    <Text
      style={[style, { color, marginTop: top }]}
      numberOfLines={numberOfLines}
    >
      <Spans spans={block.spans} />
    </Text>
  );
}

/**
 * De stukjes binnen één alinea.
 *
 * Genest in het bovenliggende Text, zodat regelhoogte en letterafstand van
 * de basisstijl blijven gelden — een los Text per stukje zou de regelval
 * breken zodra er midden in een zin een vet woord staat.
 */
function Spans({ spans }: { spans: InlineSpan[] }) {
  return (
    <>
      {spans.map((span, i) => (
        <Text
          key={i}
          style={{
            ...(span.bold ? { fontWeight: "700" as const } : null),
            ...(span.italic ? { fontStyle: "italic" as const } : null),
          }}
        >
          {span.text}
        </Text>
      ))}
    </>
  );
}
