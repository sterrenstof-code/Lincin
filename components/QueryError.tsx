import { Pressable, Text, View } from "react-native";

import { feed, FEED_BORDER, feedType, flame, space } from "@/lib/design/type";

/**
 * Wat er staat als een query mislukt.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT EEN ONDERDEEL IS EN GEEN STUK PER SCHERM
 * ---------------------------------------------------------------
 * Een mislukte query zag er precies hetzelfde uit als een lege lijst. Toen
 * `bug_report_id` nog niet bestond stond er "nog geen meldingen" terwijl er
 * tientallen waren — en dan zoek je de fout overal behalve waar hij zit.
 *
 * Dat is één keer opgelost, op het meldingenscherm, en daar bleef het
 * staan: de feed ging bij een fout regelrecht van `isLoading` naar
 * `empty`, dus de hoofdpagina van de app zei "je hebt nog niets gedeeld"
 * als de server niet antwoordde. Vier schermen met dezelfde val, één
 * scherm met de oplossing.
 *
 * Vandaar dit bestand. Stilte en leegte horen niet hetzelfde te lezen, en
 * die regel hoort op één plek te staan in plaats van op de plek waar hij
 * toevallig het eerst pijn deed.
 *
 * De rand is `flame` en niet `feed.ink`: dit is het énige blok in de app
 * met een rode omlijning, dus je ziet aan de vorm al dat er iets mis is
 * voordat je leest.
 */
export function QueryError({
  title,
  error,
  onRetry,
  /**
   * Binnen een rubriek in plaats van als hele pagina. Zelfde opbouw,
   * minder lucht — een lijst van drie rubrieken waarvan er één faalt mag
   * niet lezen als een foutpagina met drie rubrieken eromheen.
   */
  compact = false,
}: {
  title: string;
  error?: unknown;
  onRetry?: () => void;
  compact?: boolean;
}) {
  const message =
    (error as Error | undefined)?.message ?? "Onbekende fout.";

  return (
    <View
      accessibilityRole="alert"
      style={{
        borderWidth: FEED_BORDER,
        borderColor: flame,
        backgroundColor: feed.post,
        padding: compact ? space.xl : space.xxxl,
      }}
    >
      <Text
        style={[
          feedType.tile,
          { fontSize: compact ? 16 : 20, color: feed.text, marginBottom: space.sm },
        ]}
      >
        {title}
      </Text>
      <Text style={[feedType.body, { color: feed.textDim, maxWidth: 440 }]}>
        {message}
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel="Opnieuw proberen"
          style={{
            marginTop: space.xl,
            alignSelf: "flex-start",
            paddingHorizontal: space.xl,
            // Eén besturingshoogte voor de hele app; zie CONTROL_H.
            height: 44,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: FEED_BORDER,
            borderColor: feed.ink,
          }}
        >
          <Text style={[feedType.label, { color: feed.ink }]}>
            Opnieuw proberen
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
