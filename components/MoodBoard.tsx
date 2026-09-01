import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { ActionSheet, type ActionSheetAction } from "@/components/ActionSheet";
import { EmptyState } from "@/components/EmptyState";
import { Lightbox } from "@/components/Lightbox";
import { MoodTile } from "@/components/MoodTile";
import { Skeleton } from "@/components/Skeleton";
import {
  setPostPinned,
  setPostTileSpan,
  setPostVisibility,
  spanCells,
  TILE_SPANS,
  type PostWithAuthor,
  type TileSpan,
} from "@/lib/api/posts";
import { brand, creamOnDark, feed, feedType, space } from "@/lib/design/type";
import { useToast } from "@/lib/toast";

/**
 * Het bord.
 *
 * ---------------------------------------------------------------
 * WAAROM DIT GEEN `PostGrid` MEER IS
 * ---------------------------------------------------------------
 * `PostGrid` is een raster: elke cel even groot, nieuwste eerst, en de
 * volgorde komt van de klok. Dat is precies goed voor "alles van deze
 * persoon" en precies verkeerd voor een moodboard, want een moodboard is
 * *samengesteld*. Wat er staat is een keuze, hoe groot het is een keuze,
 * en wat bovenaan hangt ook.
 *
 * De twee blijven dus naast elkaar bestaan. De feed houdt zijn raster; dit
 * draagt het profiel.
 *
 * ---------------------------------------------------------------
 * HOE HET PAKT
 * ---------------------------------------------------------------
 * Vierkante cellen, en een tegel beslaat er één, twee of vier. Flexbox kan
 * dat niet — een tegel die twee rijen hoog is bestaat in flexbox niet — dus
 * er wordt echt gepakt: een bezettingsraster, en elke tegel gaat op de
 * eerste plek waar hij past, van links naar rechts en dan naar beneden.
 *
 * Dat "eerste plek waar hij past" is bewust en niet het dichtstbijzijnde
 * gat: het houdt de leesrichting heel. Een tegel die achteruit springt om
 * een gaatje te vullen leest als een fout, ook al is hij netter gepakt.
 *
 * Blijft er onderaan een gat over, dan blijft dat gat. Een rooster dat
 * zichzelf dichttrekt door de volgorde te breken is geen rooster meer —
 * dezelfde regel als de korte laatste rij in `IndexGrid` (§4c).
 */

/** De naad tussen twee tegels; gelijk aan die van `PostGrid`. */
const SEAM = 2;

type Placed = {
  post: PostWithAuthor;
  col: number;
  row: number;
  w: number;
  h: number;
};

/**
 * Waar elke tegel terechtkomt, en hoeveel rijen dat kost.
 *
 * Puur rekenwerk, dus `useMemo` in de aanroeper: dit hoort niet opnieuw te
 * lopen omdat er ergens een venster bewoog.
 */
export function packTiles(posts: PostWithAuthor[], columns: number): {
  placed: Placed[];
  rows: number;
} {
  const cols = Math.max(1, columns);
  // Rij-index → welke kolommen bezet zijn. Groeit vanzelf mee.
  const taken: boolean[][] = [];
  const rowAt = (r: number) => (taken[r] ??= new Array(cols).fill(false));

  const fits = (r: number, c: number, w: number, h: number) => {
    for (let y = r; y < r + h; y++) {
      const row = rowAt(y);
      for (let x = c; x < c + w; x++) if (row[x]) return false;
    }
    return true;
  };

  const placed: Placed[] = [];
  let maxRow = 0;

  for (const post of posts) {
    const cells = spanCells(post.tile_span);
    // Een tegel kan nooit breder dan het bord. Op een telefoon met twee
    // kolommen wordt een 2x2 dus een volle-breedte blok, en dat is precies
    // wat je wil: hij blijft het grootste ding op de pagina.
    const w = Math.min(cells.w, cols);
    const h = cells.h;

    let r = 0;
    let done = false;
    while (!done) {
      for (let c = 0; c + w <= cols; c++) {
        if (fits(r, c, w, h)) {
          for (let y = r; y < r + h; y++) {
            const row = rowAt(y);
            for (let x = c; x < c + w; x++) row[x] = true;
          }
          placed.push({ post, col: c, row: r, w, h });
          maxRow = Math.max(maxRow, r + h);
          done = true;
          break;
        }
      }
      r++;
      // Vangnet: bij een leeg bord is de eerste rij altijd vrij, dus dit
      // kan niet oneindig lopen. Maar een oneindige lus in de opmaak is een
      // wit scherm, en daar wil je niet op vertrouwen.
      if (r > posts.length * 2 + 4) {
        placed.push({ post, col: 0, row: maxRow, w, h });
        maxRow += h;
        done = true;
      }
    }
  }

  return { placed, rows: maxRow };
}

export function MoodBoard({
  posts,
  loading,
  editable,
  myUserId,
  onChanged,
  emptyTitle = "Je bord is nog leeg",
  emptyLabel,
  emptyAction,
}: {
  posts: PostWithAuthor[] | undefined;
  loading?: boolean;
  /** Alleen op je eigen bord kun je maten en volgorde veranderen. */
  editable?: boolean;
  myUserId: string;
  onChanged: () => void;
  emptyTitle?: string;
  emptyLabel: string;
  emptyAction?: { label: string; onPress: () => void };
}) {
  const toast = useToast();
  const [width, setWidth] = useState(0);
  /** Welke tegel zijn opties open heeft staan. */
  const [optionsFor, setOptionsFor] = useState<PostWithAuthor | null>(null);
  /** Waar de lichtbak staat, als index in `posts`. */
  const [lightboxAt, setLightboxAt] = useState<number | null>(null);

  /**
   * Twee kolommen op een telefoon, drie op een tablet, vier op een breed
   * scherm. Onder de tweede grens is een 2x2 het hele bord breed, en dat
   * mag: op een telefoon is één ding tegelijk groot genoeg.
   */
  const columns = width === 0 ? 3 : width < 560 ? 2 : width < 1100 ? 3 : 4;
  const cell = width > 0 ? width / columns : 0;

  const { placed, rows } = useMemo(
    () => packTiles(posts ?? [], columns),
    [posts, columns]
  );

  async function apply(
    label: string,
    run: () => Promise<void>
  ) {
    try {
      await run();
      onChanged();
    } catch {
      // Zonder dit verandert er niets en zegt niets waarom — en dan lijkt
      // de knop stuk in plaats van de verbinding (§4b).
      toast.error(`${label} lukte niet.`, {
        action: { label: "Opnieuw", onPress: () => void apply(label, run) },
      });
    }
  }

  const optionActions: ActionSheetAction[] = optionsFor
    ? [
        ...TILE_SPANS.map((span) => ({
          label: `${SPAN_LABELS[span]}${optionsFor.tile_span === span ? "  ·  nu" : ""}`,
          icon: SPAN_ICONS[span],
          onPress: () =>
            apply("Maat wijzigen", () =>
              setPostTileSpan(optionsFor.id, myUserId, span)
            ),
        })),
        {
          label: optionsFor.pinned_at ? "Losmaken" : "Bovenaan vastprikken",
          icon: optionsFor.pinned_at ? "bookmark" : "bookmark-outline",
          onPress: () =>
            apply("Vastprikken", () =>
              setPostPinned(optionsFor.id, myUserId, !optionsFor.pinned_at)
            ),
        },
        {
          label:
            optionsFor.visibility === "feed"
              ? "Uit de feed halen"
              : "Ook in de feed zetten",
          icon: optionsFor.visibility === "feed" ? "eye-off-outline" : "eye-outline",
          onPress: () =>
            apply("Zichtbaarheid wijzigen", () =>
              setPostVisibility(
                optionsFor.id,
                myUserId,
                optionsFor.visibility === "feed" ? "profile" : "feed"
              )
            ),
        },
      ]
    : [];

  if (loading) {
    return (
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ flexDirection: "row", flexWrap: "wrap", margin: -SEAM / 2 }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <View key={i} style={{ width: `${100 / columns}%`, padding: SEAM / 2 }}>
            <Skeleton style={{ width: "100%", aspectRatio: 1, borderRadius: 0 }} />
          </View>
        ))}
      </View>
    );
  }

  if (!posts || posts.length === 0) {
    return <EmptyState title={emptyTitle} body={emptyLabel} action={emptyAction} />;
  }

  return (
    <>
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{ width: "100%", height: cell > 0 ? rows * cell : undefined }}
      >
        {cell > 0
          ? placed.map(({ post, col, row, w, h }) => (
              <View
                key={post.id}
                style={{
                  position: "absolute",
                  left: col * cell,
                  top: row * cell,
                  width: w * cell,
                  height: h * cell,
                  padding: SEAM / 2,
                }}
              >
                <MoodTile
                  post={post}
                  editable={!!editable}
                  onOpen={() =>
                    setLightboxAt(posts.findIndex((p) => p.id === post.id))
                  }
                  onOptions={() => setOptionsFor(post)}
                />
              </View>
            ))
          : null}
      </View>

      <ActionSheet
        visible={!!optionsFor}
        onClose={() => setOptionsFor(null)}
        title="Deze tegel"
        subtitle={
          optionsFor?.visibility === "profile"
            ? "Staat alleen op je bord — je lincs krijgen hem niet in de feed."
            : "Hoe groot hij staat, en waar hij hangt."
        }
        actions={optionActions}
      />

      <Lightbox
        posts={posts}
        index={lightboxAt}
        onClose={() => setLightboxAt(null)}
        onIndexChange={setLightboxAt}
      />
    </>
  );
}

/**
 * De maten in woorden.
 *
 * "1x1" is precies wat er in de database staat en zegt een lezer niets;
 * "Klein" zegt wat je krijgt. De kolomnamen horen in de kolom te blijven.
 */
const SPAN_LABELS: Record<TileSpan, string> = {
  "1x1": "Klein — één vakje",
  "2x1": "Breed — twee naast elkaar",
  "1x2": "Hoog — twee onder elkaar",
  "2x2": "Groot — vier vakjes",
};

const SPAN_ICONS: Record<TileSpan, keyof typeof Ionicons.glyphMap> = {
  "1x1": "square-outline",
  "2x1": "tablet-landscape-outline",
  "1x2": "tablet-portrait-outline",
  "2x2": "grid-outline",
};

/**
 * Het stipje, nu als knop.
 *
 * Geëxporteerd zodat `MoodTile` hem kan tekenen zonder dat de betekenis op
 * twee plekken staat: blauw is hier het voetnootteken van het bord — de
 * enige kleur in het palet die nergens anders iets betekent — en dat geldt
 * of hij nu alleen iets zegt of ook iets doet.
 *
 * Op je eigen bord opent hij de opties van die tegel; op andermans bord
 * zegt hij alleen dat er meer achter zit. Dezelfde vorm, twee rollen, en
 * het verschil is of je er wat aan kunt doen.
 *
 * §4c zegt dat `Disc` géén `Pressable` mag zijn omdat een aantikbare schijf
 * 44 punten nodig heeft en daarmee zijn karakter verliest. Dat klopt nog
 * steeds — en daarom is de dóós 44 punten en de schijf tien. Wat je ziet is
 * het teken; wat je raakt is de hoek van de tegel.
 */
export function MoreDot({
  onPress,
  label,
}: {
  onPress?: () => void;
  label: string;
}) {
  const dot = (
    <View
      style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: brand,
        borderWidth: 1.5,
        borderColor: creamOnDark.DEFAULT,
      }}
    />
  );

  if (!onPress) {
    return (
      <View
        pointerEvents="none"
        accessibilityRole="text"
        accessibilityLabel={label}
        style={{ position: "absolute", top: space.sm, left: space.sm }}
      >
        {dot}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        position: "absolute",
        top: 0,
        left: 0,
        width: 44,
        height: 44,
        alignItems: "flex-start",
        justifyContent: "flex-start",
        paddingTop: space.sm,
        paddingLeft: space.sm,
        opacity: pressed ? 0.5 : 1,
      })}
    >
      {dot}
    </Pressable>
  );
}

/** Het vlaggetje op een vastgeprikte tegel. */
export function PinMark() {
  return (
    <View
      pointerEvents="none"
      accessibilityRole="text"
      accessibilityLabel="Vastgeprikt"
      style={{
        position: "absolute",
        top: space.sm,
        right: space.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        backgroundColor: feed.ink,
        paddingHorizontal: 6,
        height: 20,
      }}
    >
      <Ionicons name="bookmark" size={10} color={creamOnDark.DEFAULT} />
      <Text style={[feedType.label, { fontSize: 9, color: creamOnDark.DEFAULT }]}>
        VAST
      </Text>
    </View>
  );
}
