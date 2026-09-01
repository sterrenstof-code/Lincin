import { Ionicons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { useEffect } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { openUrl } from "@/components/FindBody";
import { coverUrlFor } from "@/components/PostGrid";
import { RichText } from "@/components/RichText";
import { SafeImage } from "@/components/SafeImage";
import { KIND_LABELS, type PostWithAuthor } from "@/lib/api/posts";
import {
  CONTROL_H,
  creamOnDark,
  FEED_BORDER,
  feedType,
  shell,
  space,
} from "@/lib/design/type";

/**
 * Een ding van het bord, groot, zonder het bord te verlaten.
 *
 * ---------------------------------------------------------------
 * WAAROM NIET GEWOON NAAR DE DETAILPAGINA
 * ---------------------------------------------------------------
 * Dat deed het raster: tikken navigeerde naar `/post/[id]`. Voor de feed
 * klopt dat — daar is een vondst een onderwerp met een gesprek eronder, en
 * daar wil je naartoe.
 *
 * Op een bord is het de verkeerde beweging. Je bent aan het kíjken, en je
 * kijkt naar de samenstelling; elke tik gooit die samenstelling weg, en de
 * terugweg zet je bovenaan in plaats van waar je was. Twaalf dingen bekijken
 * kost dan vierentwintig navigaties.
 *
 * Een lichtbak houdt je op het bord. Hij ligt eróver, je bladert door met
 * pijltjes, en als je hem sluit sta je nog precies waar je stond.
 *
 * De weg naar de volledige pagina blijft: die staat als knop onderaan, want
 * daar zit het gesprek en dat past niet in een lichtbak.
 *
 * ---------------------------------------------------------------
 * HET TOETSENBORD
 * ---------------------------------------------------------------
 * Escape sluit — dat doet `Modal` van react-native-web zelf via
 * `onRequestClose`. De pijltjes bladeren, en die moeten we zelf opvangen:
 * op web is dit een gewoon `keydown`-abonnement, op native bestaat het niet
 * en doet die tak niets.
 */
export function Lightbox({
  posts,
  index,
  onClose,
  onIndexChange,
}: {
  posts: PostWithAuthor[];
  /** `null` is dicht. */
  index: number | null;
  onClose: () => void;
  onIndexChange: (next: number) => void;
}) {
  const insets = useSafeAreaInsets();
  const open = index !== null && index >= 0 && index < posts.length;
  const post = open ? posts[index] : null;

  const hasPrev = open && index > 0;
  const hasNext = open && index < posts.length - 1;

  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < posts.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, posts.length, onIndexChange]);

  if (!open || !post) return null;

  const cover = coverUrlFor(post);
  const caption = post.caption?.trim() || "";
  const body = post.body_text?.trim() || "";

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      {/* Het blad eronder is in béide standen zwart: je kijkt hier naar
          beeld, en beeld hoort op een neutrale ondergrond. Dat is dezelfde
          keuze als bij de kopbalk en de toast (§2). */}
      <View style={{ flex: 1, backgroundColor: shell }}>
        {/* Wegtikken naast het beeld sluit. Ligt achter alles, zodat de
            knoppen erboven hun eigen tik houden. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
          onPress={onClose}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />

        <View
          style={{
            flex: 1,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
          pointerEvents="box-none"
        >
          {/* Kop: welke, en de uitgang */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: space.lg,
              height: CONTROL_H + space.sm,
            }}
          >
            <Text style={[feedType.label, { color: creamOnDark.muted, flex: 1 }]}>
              {`${(index ?? 0) + 1} / ${posts.length}  ·  ${
                KIND_LABELS[post.kind ?? "note"] ?? "Vondst"
              }`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sluiten"
              onPress={onClose}
              style={{
                width: CONTROL_H,
                height: CONTROL_H,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={22} color={creamOnDark.DEFAULT} />
            </Pressable>
          </View>

          {/* Het ding zelf, met de bladerknoppen ernaast */}
          <View
            style={{ flex: 1, flexDirection: "row", alignItems: "center" }}
            pointerEvents="box-none"
          >
            <Arrow
              side="left"
              disabled={!hasPrev}
              onPress={() => onIndexChange((index ?? 0) - 1)}
            />
            <View style={{ flex: 1, height: "100%" }} pointerEvents="box-none">
              {post.video_url ? (
                <Video
                  source={{ uri: post.video_url }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode={ResizeMode.CONTAIN}
                  useNativeControls
                  isLooping
                  shouldPlay
                />
              ) : cover ? (
                <SafeImage
                  uri={cover}
                  cacheKey={post.image_path ?? post.meta?.image_url ?? post.id}
                  style={{ width: "100%", height: "100%" }}
                  // `contain` en niet `cover`: dit is de plek waar het ding
                  // hélemaal te zien hoort te zijn. Bijsnijden hoort bij een
                  // tegel, niet bij het bekijken ervan.
                  contentFit="contain"
                  skeleton={false}
                  fallbackBg="bg-shell"
                  fallbackColor={creamOnDark.muted}
                />
              ) : (
                <ScrollView contentContainerStyle={{ padding: space.xxxl }}>
                  <Text
                    style={[
                      feedType.tagline,
                      { color: creamOnDark.DEFAULT, marginBottom: space.lg },
                    ]}
                  >
                    {post.source_title?.trim() || caption || "Notitie"}
                  </Text>
                  {body ? (
                    <RichText
                      text={body}
                      style={feedType.body}
                      color={creamOnDark.DEFAULT}
                      dimColor={creamOnDark.muted}
                      ruleColor={creamOnDark.rule}
                    />
                  ) : null}
                </ScrollView>
              )}
            </View>
            <Arrow
              side="right"
              disabled={!hasNext}
              onPress={() => onIndexChange((index ?? 0) + 1)}
            />
          </View>

          {/* Voet: het onderschrift, en de weg naar het gesprek */}
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
            {caption ? (
              <Text
                style={[feedType.body, { color: creamOnDark.DEFAULT, maxWidth: 720 }]}
                numberOfLines={3}
              >
                {caption}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", gap: space.md, marginTop: space.md }}>
              {post.link_url ? (
                <FootButton
                  label="Openen"
                  icon="open-outline"
                  onPress={() => void openUrl(post.link_url!)}
                />
              ) : null}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Een bladerknop.
 *
 * Blijft staan als hij niet kan — uitgeschakeld en niet weg. Een knop die
 * verdwijnt aan het einde van de reeks laat de rest verspringen, en dan
 * verschuift het beeld waar je naar keek terwijl je bladert.
 */
function Arrow({
  side,
  disabled,
  onPress,
}: {
  side: "left" | "right";
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={side === "left" ? "Vorige" : "Volgende"}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{
        width: CONTROL_H + space.md,
        height: CONTROL_H + space.md,
        alignItems: "center",
        justifyContent: "center",
        opacity: disabled ? 0.2 : 1,
      }}
    >
      <Ionicons
        name={side === "left" ? "chevron-back" : "chevron-forward"}
        size={26}
        color={creamOnDark.DEFAULT}
      />
    </Pressable>
  );
}

function FootButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: space.xs,
        height: CONTROL_H,
        paddingHorizontal: space.lg,
        borderWidth: FEED_BORDER,
        borderColor: creamOnDark.rule,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Ionicons name={icon} size={14} color={creamOnDark.DEFAULT} />
      <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>{label}</Text>
    </Pressable>
  );
}
