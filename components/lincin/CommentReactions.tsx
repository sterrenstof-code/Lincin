import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { COMMENT_REACTIONS } from "@/lib/api/comment-reactions";
import type { GroupedPostReaction } from "@/lib/api/post-reactions";
import { ON_LIGHT, color, useThemeSpec } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import { useReactionWho } from "@/lib/lincin/reactors";

import { WhoReacted } from "./WhoReacted";

/**
 * Reacties onder één comment (HANDOFF 2.1 §Comment reactions).
 *
 * Een rij chips van 34px, zo hoog als de andere knoppen op de bladzijde
 * (de 24px van het ontwerp was te klein om te zien) — 1.5px inktkader, emoji en een mono-telling;
 * de mijne zuur gevuld — en een gestreepte ☺. Een tik op ☺ opent eronder
 * een omlijnd vak met zes emoji (❤️ 😂 🔥 😮 👏 🥹, cellen van 32px);
 * kiezen zet mijn reactie aan of uit en sluit het vak.
 *
 * Eén vak tegelijk open: wie de lijst tekent houdt bij welk (`open`).
 */
export function CommentReactions({
  reactions,
  onToggle,
  open,
  onOpenChange,
}: {
  reactions: GroupedPostReaction[];
  onToggle: (emoji: string) => void;
  /** Staat de kiezer van déze comment open? Weggelaten: de rij houdt het zelf bij. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const isOpen = open ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const ink = color("ink");
  // Modern: rond en met een haarlijn, zoals de rest van modern. Kleur houdt
  // zijn inktkaders en de gestippelde "☺ +". Magazine (de omslag): vierkant,
  // een lijn van 1, en wat van jou is een inktvlak — zoals de reacties op de
  // bijdrage zelf.
  const th = useThemeSpec().id;
  const modern = th === "modern";
  const mag = th === "magazine";
  const edge = modern
    ? { borderWidth: 1, borderColor: color("ink", "postRule"), borderRadius: 999 }
    : mag
      ? { borderWidth: 1, borderColor: color("ink", "postDim") }
      : { borderWidth: 1.5, borderColor: ink };
  const mineBg = mag ? ink : color("acid");
  const countFont = mag ? sans(600) : mono(600);
  const mine = new Set(reactions.filter((r) => r.mine).map((r) => r.emoji));
  const who = useReactionWho(reactions);

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {reactions.map((r) => (
          <Pressable
            key={r.emoji}
            accessibilityRole="button"
            {...who.chip(r)}
            accessibilityState={{ selected: r.mine }}
            onPress={() => onToggle(r.emoji)}
            style={{
              height: 34,
              paddingHorizontal: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              ...edge,
              backgroundColor: r.mine ? mineBg : "transparent",
            }}
          >
            <Text style={{ fontSize: 15, lineHeight: 18 }}>{r.emoji}</Text>
            <Text style={{ ...countFont, fontSize: 12, lineHeight: 15, color: r.mine ? (mag ? color("paper") : ON_LIGHT) : ink }}>{r.count}</Text>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reageer"
          accessibilityState={{ expanded: isOpen }}
          onPress={() => setOpen(!isOpen)}
          style={{
            height: 34,
            paddingHorizontal: 12,
            ...edge,
            borderStyle: modern || mag ? "solid" : "dashed",
            backgroundColor: isOpen ? ink : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* In inkt en zo groot als de andere knoppen: goed te zien. */}
          <Text style={{ ...countFont, fontSize: 15, lineHeight: 18, color: isOpen ? color("paper") : ink }}>☺ +</Text>
        </Pressable>
      </View>
      <WhoReacted line={who.line} style={{ marginTop: 4 }} />
      {isOpen ? (
        <View
          style={{
            flexDirection: "row",
            gap: 4,
            marginTop: 6,
            ...edge,
            padding: 4,
            alignSelf: "flex-start",
            backgroundColor: color("paper"),
          }}
        >
          {COMMENT_REACTIONS.map((emoji) => (
            <Pressable
              key={emoji}
              accessibilityRole="button"
              accessibilityLabel={emoji}
              accessibilityState={{ selected: mine.has(emoji) }}
              onPress={() => {
                onToggle(emoji);
                setOpen(false);
              }}
              style={{
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: mine.has(emoji) ? (mag ? color("ink", "postRule") : color("acid")) : color("paper"),
              }}
            >
              <Text style={{ fontSize: 17, lineHeight: 21 }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
