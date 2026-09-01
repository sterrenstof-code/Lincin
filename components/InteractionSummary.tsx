import { Pressable, Text, View } from "react-native";

import { QueryError } from "@/components/QueryError";
import { Skeleton } from "@/components/Skeleton";
import type { InteractionSummary as Summary } from "@/lib/api/interactions";
import type { PostWithAuthor } from "@/lib/api/posts";
import {
  feed,
  FEED_BORDER,
  feedType,
  flameDeep,
  rule,
  space,
} from "@/lib/design/type";

/**
 * Wat je de laatste maand gedaan hebt, in vijf getallen.
 *
 * ---------------------------------------------------------------
 * WAAROM GETALLEN EN GEEN GRAFIEK
 * ---------------------------------------------------------------
 * Vijf waarden over één periode. Daar is een grafiek geen weergave van
 * maar een versiering: er is geen verloop om te volgen en geen vergelijking
 * om te maken, dus een balkje voegt niets toe aan het cijfer waar het naast
 * staat. Een getal ís hier de kortste weergave.
 *
 * Ze staan als indexcijfers — groot, in flame, met het woord eronder in
 * klein. Dat is de vorm die de rasterlaag al kent (§4c, `DateStamp`), en
 * hij past hier om dezelfde reden: het getal is het onderwerp en het woord
 * is het bijschrift, niet andersom.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT NIET NAAST DE ACTIVITEITENLIJST DUBBELT
 * ---------------------------------------------------------------
 * `ActivityHistory` toont wát je deed, op volgorde. Dit toont hoevéél, in
 * totaal. Wie op zijn profiel kijkt wil meestal het tweede weten en krijgt
 * daarvoor nu geen lijst meer te tellen.
 *
 * Een nul wordt niet weggelaten. "Nul reacties deze maand" is informatie —
 * misschien wel de enige die je aan het denken zet — en een rij die
 * verdwijnt zodra hij nul is, is een rij die je nooit ziet wanneer het
 * ertoe doet.
 */
export function InteractionSummaryCard({
  data,
  loading,
  error,
  onRetry,
}: {
  data: Summary | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
}) {
  if (error) {
    return (
      <QueryError
        title="Je overzicht kon niet geladen worden"
        error={error}
        onRetry={onRetry}
        compact
      />
    );
  }

  return (
    <View
      style={{
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        padding: space.xl,
      }}
    >
      <Text
        style={[
          feedType.kicker,
          { color: flameDeep, letterSpacing: 0.55, marginBottom: space.xs },
        ]}
      >
        JOUW MAAND
      </Text>
      <Text style={[feedType.caption, { color: feed.inkDim, marginBottom: space.xl }]}>
        {data
          ? `${data.total === 0 ? "Niets" : data.total} in de laatste ${data.days} dagen`
          : "De laatste 30 dagen"}
      </Text>

      {loading || !data ? (
        <View style={{ gap: space.md }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} style={{ height: 34, borderRadius: 0 }} />
          ))}
        </View>
      ) : (
        <View>
          <Row label="Vondsten gedeeld" value={data.posts} first />
          <Row label="Reacties geplaatst" value={data.comments} />
          <Row label="Emoji gegeven" value={data.reactions} />
          <Row label="Duwtjes gegeven" value={data.boosts} />
          <Row label="Foto's aan events" value={data.photos} />
        </View>
      )}
    </View>
  );
}

/**
 * Eén regel: het getal links, het woord rechts.
 *
 * Het getal staat vóór het label en niet erachter, zodat de cijferkolom
 * één rechterlijn houdt — daarom ook `fontVariant: tabular-nums`. Zonder
 * dat springt een 1 smaller dan een 8 en staat de kolom te wiebelen.
 */
function Row({
  label,
  value,
  first,
}: {
  label: string;
  value: number;
  first?: boolean;
}) {
  const none = value === 0;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "baseline",
        gap: space.md,
        paddingVertical: space.md,
        ...(first
          ? null
          : { borderTopWidth: FEED_BORDER, borderTopColor: rule.soft }),
      }}
    >
      <Text
        style={[
          feedType.numeral,
          {
            fontSize: 26,
            lineHeight: 30,
            fontWeight: "800",
            // Een nul is geen prestatie om uit te lichten, maar ook geen
            // fout om te verbergen: hij staat er in de gedempte inkt in
            // plaats van in het accent.
            color: none ? feed.inkDim : flameDeep,
            minWidth: 46,
            fontVariant: ["tabular-nums"],
          },
        ]}
      >
        {value}
      </Text>
      <Text style={[feedType.body, { color: feed.ink, flex: 1 }]}>{label}</Text>
    </View>
  );
}


/**
 * De woorden die je bord het vaakst gebruikt.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT NAAST DE GETALLEN STAAT
 * ---------------------------------------------------------------
 * De getallen erboven zeggen hoevéél je deed. Ze zeggen niets over wát het
 * was, en dat is op een moodboard juist de helft die telt — je verzamelt
 * niet om te tellen, je verzamelt omdat het ergens over gaat.
 *
 * Samen vormen ze één colofon: links het bord zelf, rechts wat het bord
 * over zichzelf zegt. Wat je deed, en waar het over ging.
 *
 * De tags komen uit de vondsten die er al zijn — geen extra query. Dat is
 * niet alleen goedkoop maar ook eerlijker: dit gaat over wat er op je bord
 * staat, en dat is precies de lijst die het bord tekent.
 */
export function BoardVocabulary({
  posts,
  onSelect,
}: {
  posts: PostWithAuthor[] | undefined;
  onSelect?: (tag: string) => void;
}) {
  const counted = new Map<string, number>();
  for (const post of posts ?? []) {
    for (const tag of post.tags ?? []) {
      const t = tag.trim().toLowerCase();
      if (t) counted.set(t, (counted.get(t) ?? 0) + 1);
    }
  }
  const top = Array.from(counted.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    // Acht is genoeg om een vorm te zien en weinig genoeg om geen wolk te
    // worden: een tagwolk van veertig woorden zegt net zo weinig als geen.
    .slice(0, 8);

  if (top.length === 0) return null;

  return (
    <View
      style={{
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        borderTopWidth: 0,
        padding: space.xl,
      }}
    >
      <Text
        style={[
          feedType.kicker,
          { color: flameDeep, letterSpacing: 0.55, marginBottom: space.xs },
        ]}
      >
        WAAR HET OVER GAAT
      </Text>
      <Text style={[feedType.caption, { color: feed.inkDim, marginBottom: space.lg }]}>
        De woorden van je bord
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>
        {top.map(([tag, count]) => (
          <Pressable
            key={tag}
            accessibilityRole={onSelect ? "button" : "text"}
            accessibilityLabel={`${tag}, ${count} keer`}
            onPress={onSelect ? () => onSelect(tag) : undefined}
            disabled={!onSelect}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.xs,
              // Vierkant, zoals alles (§4). Geen pil.
              borderWidth: FEED_BORDER,
              borderColor: rule.soft,
              paddingHorizontal: space.md,
              minHeight: 30,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={[feedType.label, { color: feed.ink }]}>{tag}</Text>
            <Text
              style={[
                feedType.label,
                { color: feed.inkDim, fontVariant: ["tabular-nums"] },
              ]}
            >
              {count}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
