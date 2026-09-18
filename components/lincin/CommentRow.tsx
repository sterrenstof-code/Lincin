import { Platform, Pressable, View } from "react-native";

import { openCommentImage } from "@/components/lincin/Lightbox";
import { BORDER, Body, Initial, Mono, line } from "@/components/lincin/ui";
import { SafeImage } from "@/components/SafeImage";
import type { EntityComment } from "@/lib/api/entity-comments";
import { color, friendColor, hueFor, useHueChoices, useScheme } from "@/lib/design/theme";
import { useLang, useT } from "@/lib/i18n";
import { openProfile as openProfileAnywhere } from "@/lib/lincin/desktop";
import { displayName, timeLabel } from "@/lib/lincin/model";

/**
 * Eén comment op de telefoonbladzijde van een bijdrage of een poll: de
 * initiaal in de kleur van de schrijver, naam en tijd, een gif of foto
 * (een tik opent de lichtbak), de tekst, en de reacties eronder.
 */
export function CommentRow({
  comment: c,
  myUserId,
  reactions,
}: {
  comment: EntityComment;
  myUserId: string;
  /** De chips en de ☺ onder de comment (HANDOFF 2.1). */
  reactions?: React.ReactNode;
}) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const own = c.user_id === myUserId;
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const fc = own ? { fill: color("ink"), ink: color("paper") } : friendColor(hueFor(c.user_id), scheme);
  const name = own ? t.me : displayName(c.author);
  // Een naam opent een profiel — ook "Jij" het jouwe.
  const toProfile = c.author?.username ? () => openProfileAnywhere(c.author!.username) : undefined;
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <Pressable accessibilityRole="link" accessibilityLabel={name} onPress={toProfile} disabled={!toProfile}>
        <Initial letter={name.slice(0, 1).toUpperCase()} size={26} bg={fc.fill} fg={fc.ink} border={false} fontSize={11} />
      </Pressable>
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Mono variant="monoBody" onPress={toProfile}>
            {name}
          </Mono>
          <Mono variant="micro" tone="dim" style={{ textTransform: "none" }}>
            {timeLabel(c.created_at, t, lang)}
          </Mono>
        </View>
        {c.image_url ? (
          <Pressable
            accessibilityRole="imagebutton"
            accessibilityLabel={`${t.gifNote}, ${name}`}
            onPress={() => openCommentImage(c, name)}
            style={[
              { width: 160, height: 110, borderWidth: BORDER, borderColor: line(), backgroundColor: color("paper2") },
              Platform.OS === "web" ? ({ cursor: "zoom-in" } as object) : null,
            ]}
          >
            <SafeImage uri={c.image_url} cacheKey={c.image_path ?? undefined} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            <View style={{ position: "absolute", left: 6, bottom: 6, backgroundColor: color("ink"), paddingHorizontal: 5, paddingVertical: 2 }}>
              <Mono variant="tiny" tone="paper">
                {t.gifNote}
              </Mono>
            </View>
          </Pressable>
        ) : null}
        {c.body ? (
          <Body small style={{ fontSize: 14, lineHeight: 19 }}>
            {c.body}
          </Body>
        ) : null}
        {reactions}
      </View>
    </View>
  );
}
