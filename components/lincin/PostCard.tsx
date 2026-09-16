import { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import type { GroupedPostReaction } from "@/lib/api/post-reactions";
import { color, friendColor, line, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { timeLabel, type CardPost } from "@/lib/lincin/model";

import { Media } from "./Media";
import { BORDER, Head, Initial, Mono, RADIUS, Serif } from "./ui";

/**
 * De post-kaart, variant "7h" (README §Post card).
 *
 *   [ media 150 | meta 40 ]
 *   [ titelstrook in vriendkleur      ]
 *   [ bijschrift, serif, gedempt      ]
 *   [ reacties | COMMENT · n | PRIVAAT BERICHT ]
 *
 * Alles binnen één kader van 1.5px. De metakolom rechts is het tweede
 * vlak met de avatar boven en "NAAM · SOORT · TIJD" gedraaid onderaan.
 * Een tik op de kaart opent de bladzijde.
 *
 * Gedeeld door de drie thema's (HANDOFF §Themes). Wat verschilt: in kleur
 * is de titelstrook gevuld met de vriendkleur en de titel Archivo 22; in
 * magazine en modern is de strook papier met een kleurbalk van 6px links
 * en de titel serif 24. Het kader is 1px en (modern) afgerond op 10.
 */

export const CARD_W = 340;
const MEDIA_H = 150;
const TITLE_H = 66;
const CAPTION_H = 57;
const META_W = 40;
const BAR_H = 42;

export const PostCard = memo(function PostCard({
  post,
  hue,
  width,
  myUserId,
  reactions,
  onReact,
  onOpen,
  onPrivate,
  onProfile,
}: {
  post: CardPost;
  hue: Hue;
  /** Vast (340 in een rij) of ongezet (de volle breedte). */
  width?: number;
  myUserId: string;
  reactions: GroupedPostReaction[];
  onReact: (emoji: string) => void;
  onOpen: () => void;
  onPrivate: () => void;
  onProfile: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const spec = useThemeSpec();
  const fc = friendColor(hue, scheme);
  const ink = color("ink");
  const edge = line();
  const canOpen = !!post.href;
  const strip = spec.stripFilled
    ? { backgroundColor: fc.fill, borderLeftWidth: 0, borderLeftColor: fc.fill }
    : { backgroundColor: color("paper"), borderLeftWidth: 6, borderLeftColor: fc.fill };
  const stripInk = spec.stripFilled ? fc.ink : ink;

  return (
    // Bewust géén `accessibilityRole="button"`: op web wordt dat een
    // <button>, en daar mogen de reacties, COMMENT, PRIVAAT en de avatar
    // (zelf knoppen) niet in.
    <Pressable
      accessibilityLabel={`${post.title}, ${post.authorName}`}
      onPress={canOpen ? onOpen : undefined}
      style={{
        width: width ?? "100%",
        borderWidth: BORDER,
        borderColor: edge,
        borderRadius: RADIUS,
        overflow: "hidden",
        backgroundColor: color("paper"),
      }}
    >
      <View style={{ flexDirection: "row" }}>
        {/* hoofdkolom */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Media media={post.media} height={MEDIA_H} hue={hue} postId={post.id} myUserId={myUserId} />
          <View style={{ ...strip, paddingVertical: 10, paddingHorizontal: 12, borderTopWidth: BORDER, borderTopColor: edge, overflow: "hidden" }}>
            <Head variant="cardTitle" color={stripInk} numberOfLines={3} style={{ height: TITLE_H }}>
              {post.title}
            </Head>
          </View>
          <View style={{ paddingVertical: 10, paddingHorizontal: 12, flex: 1 }}>
            <Serif variant="caption" tone="dim" numberOfLines={3} style={{ height: CAPTION_H }}>
              {post.caption}
            </Serif>
          </View>
        </View>
        {/* metakolom */}
        <MetaColumn
          initial={post.initial}
          fill={fc.fill}
          ink={fc.ink}
          text={`${post.authorName} · ${post.kind} · ${timeLabel(post.createdAt, t, lang)}`}
          onProfile={onProfile}
        />
      </View>

      {/* actiebalk */}
      <View style={{ flexDirection: "row", height: BAR_H + BORDER, borderTopWidth: BORDER, borderTopColor: edge }}>
        <View
          style={{
            flex: 1,
            minWidth: 0,
            flexDirection: "row",
            alignItems: "center",
            gap: 2,
            paddingHorizontal: 6,
            borderRightWidth: BORDER,
            borderRightColor: edge,
            overflow: "hidden",
          }}
        >
          {post.reactable
            ? reactions.map((r) => (
                <Pressable
                  key={r.emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`${r.emoji} ${r.count}`}
                  accessibilityState={{ selected: r.mine }}
                  onPress={() => onReact(r.emoji)}
                  hitSlop={4}
                  style={{
                    height: 28,
                    paddingHorizontal: 5,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    backgroundColor: r.mine ? ink : "transparent",
                  }}
                >
                  <Text style={{ fontSize: 12, lineHeight: 15, color: r.mine ? color("paper") : ink }}>{r.emoji}</Text>
                  <Text style={[lincinType.action, { color: r.mine ? color("paper") : ink, letterSpacing: 0 }]}>{r.count}</Text>
                </Pressable>
              ))
            : null}
        </View>
        {canOpen ? (
          <Pressable
            accessibilityRole="button"
            onPress={onOpen}
            style={{ paddingHorizontal: 10, justifyContent: "center", borderRightWidth: BORDER, borderRightColor: edge }}
          >
            <Mono variant="action" numberOfLines={1}>
              {t.comment}
              {post.commentCount ? ` · ${post.commentCount}` : ""}
            </Mono>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={onPrivate}
          style={{ paddingHorizontal: 10, justifyContent: "center", backgroundColor: ink }}
        >
          <Mono variant="action" tone="paper" numberOfLines={1}>
            {t.privateMsg}
          </Mono>
        </Pressable>
      </View>
    </Pressable>
  );
});

/**
 * De smalle kolom rechts: avatar boven, gedraaide regel onder.
 *
 * RN kent geen `writing-mode`; de regel is een gewone Text die 90° gedraaid
 * wordt. Daarvoor moet hij weten hoe hoog de kolom is (onLayout) — zijn
 * breedte vóór het draaien is die hoogte min de ruimte voor de avatar.
 */
function MetaColumn({
  initial,
  fill,
  ink,
  text,
  onProfile,
}: {
  initial: string;
  fill: string;
  ink: string;
  text: string;
  onProfile: () => void;
}) {
  const [h, setH] = useState(0);
  const avatarZone = 46; // 10 + 26 + 10
  const w = Math.max(0, h - avatarZone - 8);
  const cy = avatarZone + (h - avatarZone) / 2;
  return (
    <View
      onLayout={(e) => setH(e.nativeEvent.layout.height)}
      style={{
        width: META_W,
        borderLeftWidth: BORDER,
        borderLeftColor: line(),
        backgroundColor: color("paper2"),
        paddingTop: 10,
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel="Profiel" onPress={onProfile} hitSlop={6}>
        <Initial letter={initial} size={26} bg={fill} fg={ink} border={false} fontSize={11} />
      </Pressable>
      {h > 0 ? (
        // Een View draait, de Text erin knipt af: react-native-web zet op een
        // Text met numberOfLines een maxWidth van 100%, en dat is hier de
        // kolombreedte — 40px — in plaats van de regel die we draaien.
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: w,
            height: 14,
            left: META_W / 2 - w / 2 - BORDER,
            top: cy - 7,
            transform: [{ rotate: "-90deg" }],
          }}
        >
          <Text
            numberOfLines={1}
            style={[lincinType.micro, { lineHeight: 14, letterSpacing: 0.6, color: color("ink"), textAlign: "left" }]}
          >
            {text}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
