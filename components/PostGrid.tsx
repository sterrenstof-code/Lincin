import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { SafeImage } from "@/components/SafeImage";
import { Scrim } from "@/components/Scrim";
import { Skeleton } from "@/components/Skeleton";
import {
  brand,
  creamOnDark,
  feed,
  feedType,
  flameDeep,
  rule,
  SERIF_FAMILY,
  space,
} from "@/lib/design/type";
import { useHeroTag, withHeroTransition } from "@/lib/hero-transition";
import { stripMarkdown } from "@/lib/richtext";
import { KIND_LABELS, type PostWithAuthor } from "@/lib/api/posts";

/**
 * Alle vondsten van één persoon als raster.
 *
 * ---------------------------------------------------------------
 * WAAROM ÉÉN COMPONENT VOOR TWEE PAGINA'S
 * ---------------------------------------------------------------
 * Je eigen profiel en dat van iemand anders toonden hetzelfde raster op
 * twee manieren: één met afgeronde hoeken en losse hexwaarden, één dat er
 * helemaal niet was. Nu is het één ding, dus ook één maatvoering, en
 * groeit een tegel op beide plekken uit tot de volledige plaat — dezelfde
 * beweging als vanuit de feed.
 *
 * ---------------------------------------------------------------
 * HET RASTER IS HET BEELD
 * ---------------------------------------------------------------
 * De tegels stonden op een zestiende marge met een eigen omlijning
 * eromheen — zestien punten lucht en een lijn tussen elke twee foto's.
 * Op een profiel is dat de verkeerde nadruk: daar kijk je naar een reeks,
 * en een reeks ontstaat pas als de beelden elkaar raken. Zodra er lucht
 * tussen zit lees je losse kaartjes en niet één blad.
 *
 * Nu een naad van twee punten. Genoeg om te zien dát het aparte tegels
 * zijn, te weinig om ze uit elkaar te trekken — en de omlijning kan weg,
 * want de naad zelf is de lijn. Dat is dezelfde redenering als §4c: een
 * cel tussen twee lijnen ís de pagina, een kaart met een kader ligt erop.
 *
 * ---------------------------------------------------------------
 * HET STIPJE
 * ---------------------------------------------------------------
 * Zonder tekst op de tegel is er niets dat verklapt of er méér achter zit
 * dan de foto — een toelichting, een reeks, een link. Het stipje
 * linksboven zegt dat, en verder niets. Het staat er dus ook níet als er
 * niets achter zit: een markering die altijd brandt is geen markering
 * maar decoratie, en dan is de tegel zonder toelichting de enige die
 * liegt.
 */

/** De naad tussen twee tegels. Zie de kop van dit bestand. */
const SEAM = 2;
export function PostGrid({
  posts,
  loading,
  emptyTitle = "Nog niets gedeeld",
  emptyLabel,
  emptyAction,
}: {
  posts: PostWithAuthor[] | undefined;
  loading?: boolean;
  emptyTitle?: string;
  emptyLabel: string;
  /**
   * De weg naar buiten als het raster leeg is. Optioneel, want op andermans
   * profiel is er niets dat jíj kunt doen — zie components/EmptyState.tsx.
   */
  emptyAction?: { label: string; onPress: () => void };
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  // Een tegel mag nooit smaller dan ongeveer 150px worden: daaronder is een
  // foto geen foto meer maar een kleurvlak. Drie is de maat waarop een
  // reeks nog als reeks leest; vier pas als er echt breedte is.
  const columns = width < 560 ? 2 : width < 1100 ? 3 : 4;

  if (loading) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -SEAM / 2 }}>
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <View key={i} style={{ width: `${100 / columns}%`, padding: SEAM / 2 }}>
            <Skeleton style={{ width: "100%", aspectRatio: 1, borderRadius: 0 }} />
          </View>
        ))}
      </View>
    );
  }

  if (!posts || posts.length === 0) {
    // Stond op `feed.panel` — een gevulde doos, en §4 houdt het gevulde vlak
    // voor de primaire actie. `EmptyState` draagt de vorm nu voor alle vier
    // de lege lijsten in de app, en brengt de uitweg mee.
    return (
      <EmptyState title={emptyTitle} body={emptyLabel} action={emptyAction} />
    );
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -SEAM / 2 }}>
      {posts.map((post) => (
        <View key={post.id} style={{ width: `${100 / columns}%`, padding: SEAM / 2 }}>
          <GridCell post={post} onPress={() => router.push(`/post/${post.id}`)} />
        </View>
      ))}
    </View>
  );
}

/**
 * Eén cel.
 *
 * Een eigen component en geen stuk in de lus, omdat `useHeroTag` een hook
 * is — en die moet hier per tegel gelden. Dat "per tegel" is geen
 * netheid: de naam mag alleen op het scherm staan dat je aankijkt. Een
 * navigator houdt de profielpagina gemount terwijl de vondst opengaat, en
 * twee elementen met dezelfde naam laat de browser de hele overgang
 * overslaan. Zie lib/hero-transition.web.ts.
 */
function GridCell({ post, onPress }: { post: PostWithAuthor; onPress: () => void }) {
  const tag = useHeroTag(post.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={gridCellLabel(post)}
      onPress={() => withHeroTransition(onPress)}
      style={{
        width: "100%",
        aspectRatio: 1,
        // Geen vulling en geen omlijning meer. De omlijning zat hier omdat
        // de tegels op een marge stonden en zonder lijn in de lucht
        // hingen; nu ze elkaar raken ís de naad de lijn, en een kader
        // daarbovenop leest als een dubbele rand (§4). Een tegel zonder
        // foto houdt zijn vlak, want daar staat tekst op.
        backgroundColor: feed.post,
        overflow: "hidden",
        // Ankerpunt van de morph: deze tegel groeit uit tot de plaat op de
        // detailpagina.
        ...tag,
      }}
    >
      <Cell post={post} />
      {hasMoreThanImage(post) ? <MoreDot /> : null}
    </Pressable>
  );
}

/**
 * Zit er meer achter deze tegel dan wat je ziet?
 *
 * Een foto met een toelichting, een reeks van meer dan één, een link, een
 * stuk tekst. Alle vier zijn ze een reden om erop te drukken, en geen van
 * vieren is te zien aan het beeld.
 *
 * Een tegel zónder foto valt hier buiten: die tóónt zijn tekst al, dus
 * daar zou het stipje herhalen wat er letterlijk staat.
 */
function hasMoreThanImage(post: PostWithAuthor): boolean {
  if (!coverUrlFor(post)) return false;
  return (
    !!post.caption?.trim() ||
    !!post.body_text?.trim() ||
    !!post.link_url ||
    (post.album_urls?.length ?? 0) > 1
  );
}

/** Wat een schermlezer van een tegel hoort. */
function gridCellLabel(post: PostWithAuthor): string {
  const what =
    post.caption?.trim() ||
    post.source_title?.trim() ||
    stripMarkdown(post.body_text).slice(0, 60) ||
    "Vondst";
  return hasMoreThanImage(post) ? `${what} — meer info` : what;
}

/**
 * Het stipje linksboven.
 *
 * Het enige ronde ding in een raster van rechte hoeken, en daarom leest
 * het als een teken en niet als nóg een vlak — dezelfde reden waarom
 * `Disc` in de rasterlaag rond is (§4c). Geen `Pressable`: de hele tegel
 * is al de knop, en een aanraakvlak van tien punten bovenop een knop van
 * driehonderd is een val, geen extra.
 *
 * De witte ring eromheen is er omdat het stipje op élke foto moet landen —
 * op een lichte lucht verdwijnt blauw zonder rand net zo hard als op een
 * donkere.
 */
function MoreDot() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: space.sm,
        left: space.sm,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: brand,
        borderWidth: 1.5,
        borderColor: creamOnDark.DEFAULT,
      }}
    />
  );
}

/**
 * Het voorblad van een tegel.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT NIET GEWOON `post.image_url` IS
 * ---------------------------------------------------------------
 * `image_url` wordt in `hydrate` alleen gevuld uit `image_path` — het
 * bestand dat jíj uploadde. Een artikel, een YouTube-link of een
 * Spotify-album heeft dat niet: daar zit het beeld in `meta.image_url`,
 * de momentopname van de unfurl.
 *
 * In de feed ging dat goed, want `partsOf` in FindBody leest
 * `meta.image_url ?? post.image_url`. Dit raster las alleen het tweede, en
 * dus viel élke link, video en plaat hier in de tekst-tak: een grijs
 * colofon op je profiel voor precies de dingen die in de feed hun
 * omslagbeeld lieten zien. Op een moodboard is dat fataal — links zíjn het
 * grootste deel van wat je verzamelt.
 */
export function coverUrlFor(post: PostWithAuthor): string | null {
  return post.meta?.image_url ?? post.image_url ?? null;
}

function Cell({ post }: { post: PostWithAuthor }) {
  const album = post.album_urls ?? [];
  const cover = coverUrlFor(post);

  if (cover) {
    return (
      <>
        <SafeImage
          uri={cover}
          cacheKey={post.image_path ?? post.meta?.image_url ?? post.id}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={150}
          fallbackBg="bg-feed-fill"
          fallbackColor={feed.textDim}
        />
        {/* Hier staat erbij van wie het is en waar het over gaat: dit
            raster toont wat verschillénde mensen deelden, en dan is een
            naam het verschil tussen bladeren en herkennen. Op een profiel
            ligt dat andersom — daar is elke tegel van dezelfde persoon —
            en dat is precies waarom het bord een eigen tegel heeft
            (components/MoodTile.tsx) in plaats van een schakelaar hier. */}
        <Scrim height={104} strength={0.68} steps={10} />
        <View
          style={{
            position: "absolute",
            left: space.sm,
            right: space.sm,
            bottom: space.sm,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: space.xs }}>
            <Text
              style={[feedType.label, { color: creamOnDark.DEFAULT, opacity: 0.75, flex: 1 }]}
              numberOfLines={1}
            >
              {post.author?.display_name ?? post.author?.username ?? "Onbekend"}
            </Text>
            {album.length > 1 ? (
              <>
                <Ionicons name="copy-outline" size={12} color={creamOnDark.DEFAULT} />
                <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>{album.length}</Text>
              </>
            ) : null}
            {/* Het aantal duwen, niet het gewogen totaal: een getal op een
                tegel moet iets zijn dat je kunt narekenen. */}
            {post.boost_count > 0 ? (
              <>
                <Ionicons name="arrow-up-circle" size={12} color={creamOnDark.DEFAULT} />
                <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>
                  {post.boost_count}
                </Text>
              </>
            ) : null}
          </View>
          {post.caption?.trim() ? (
            <Text
              style={{
                fontFamily: feedType.tile.fontFamily,
                fontSize: 13,
                lineHeight: 16,
                fontWeight: "800",
                color: creamOnDark.DEFAULT,
                marginTop: 2,
              }}
              numberOfLines={2}
            >
              {post.caption.trim()}
            </Text>
          ) : null}
        </View>
      </>
    );
  }

  /**
   * Geen foto: dan is de tekst het beeld.
   *
   * Stond als sans-tekst onderaan tegen de rand, met een icoontje in de
   * bovenhoek en een grijze vulling eronder. Drie dingen die er los bij
   * hingen. Nu de opbouw van een colofon: waar het over gaat, een lijn, en
   * dan het stuk zelf in de serif — dezelfde stem als een fragment op zijn
   * eigen pagina. Het icoontje kan weg omdat het woord "Artikel" of
   * "Notitie" preciezer is dan een pictogram van een paperclip.
   *
   * Vijf regels in een tegel: geen plek voor opmaak, dus de markering eraf.
   */
  const kicker = KIND_LABELS[post.kind ?? "note"] ?? "Notitie";
  const title = post.source_title?.trim() || null;
  /**
   * De aanhef van het stuk.
   *
   * Met alleen de titel bleef een tegel voor driekwart leeg — "Observaties
   * Zweden" en dan niets, terwijl er twintig regels onder zaten. Een kop
   * zonder aanzet vertelt je niet of je hem open wilt doen. Dus de eerste
   * regels erbij, en die worden hier afgekapt en niet in de tekst zelf:
   * `numberOfLines` weet hoe breed de tegel echt is, een tekenlimiet niet.
   */
  const lead =
    stripMarkdown(post.body_text) ||
    post.caption?.trim() ||
    post.link_url ||
    "";
  const body = title && lead === title ? "" : lead;

  return (
    <View style={{ flex: 1, padding: space.md }}>
      <Text
        style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}
        numberOfLines={1}
      >
        {kicker.toUpperCase()}
      </Text>
      <View
        style={{
          height: StyleSheet.hairlineWidth,
          backgroundColor: rule.soft,
          marginTop: 5,
          marginBottom: 9,
        }}
      />
      {title ? (
        <Text
          style={{
            fontFamily: SERIF_FAMILY,
            fontSize: 15,
            lineHeight: 20,
            letterSpacing: -0.1,
            color: feed.text,
            marginBottom: body ? 6 : 0,
          }}
          numberOfLines={2}
        >
          {title}
        </Text>
      ) : null}
      {body ? (
        <Text
          style={{
            fontFamily: SERIF_FAMILY,
            fontSize: title ? 13 : 15,
            lineHeight: title ? 18 : 21,
            letterSpacing: -0.1,
            color: title ? feed.textDim : feed.text,
            flex: 1,
          }}
          numberOfLines={title ? 3 : 5}
        >
          {body}
        </Text>
      ) : null}
    </View>
  );
}
