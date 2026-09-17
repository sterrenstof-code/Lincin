import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { COMMENT_REACTIONS } from "@/lib/api/comment-reactions";
import type { GroupedPostReaction } from "@/lib/api/post-reactions";
import { color } from "@/lib/design/theme";
import { mono } from "@/lib/design/type";

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
  const mine = new Set(reactions.filter((r) => r.mine).map((r) => r.emoji));

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {reactions.map((r) => (
          <Pressable
            key={r.emoji}
            accessibilityRole="button"
            accessibilityLabel={`${r.emoji} ${r.count}`}
            accessibilityState={{ selected: r.mine }}
            onPress={() => onToggle(r.emoji)}
            style={{
              height: 34,
              paddingHorizontal: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              borderWidth: 1.5,
              borderColor: ink,
              backgroundColor: r.mine ? color("acid") : "transparent",
            }}
          >
            <Text style={{ fontSize: 15, lineHeight: 18 }}>{r.emoji}</Text>
            <Text style={{ ...mono(600), fontSize: 12, lineHeight: 15, color: r.mine ? "#141414" : ink }}>{r.count}</Text>
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
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: ink,
            backgroundColor: isOpen ? ink : "transparent",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {/* In inkt en zo groot als de andere knoppen: goed te zien. */}
          <Text style={{ ...mono(600), fontSize: 15, lineHeight: 18, color: isOpen ? color("paper") : ink }}>☺ +</Text>
        </Pressable>
      </View>
      {isOpen ? (
        <View
          style={{
            flexDirection: "row",
            gap: 4,
            marginTop: 6,
            borderWidth: 1.5,
            borderColor: ink,
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
                backgroundColor: mine.has(emoji) ? color("acid") : color("paper"),
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
