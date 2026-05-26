import { useRouter } from "expo-router";
import { Fragment } from "react";
import { Text, type TextProps } from "react-native";

const MENTION_REGEX = /@([a-z0-9._]{3,32})/gi;

/**
 * Rendert tekst en maakt elke @handle een tappable link naar /user/{handle}.
 * Tappen werkt zowel op web als native; op web is het ook clickable als URL.
 */
export function MentionsText({
  text,
  className,
  mineClass,
  otherClass,
  isMine,
  ...rest
}: {
  text: string;
  className?: string;
  mineClass?: string;
  otherClass?: string;
  isMine?: boolean;
} & TextProps) {
  const router = useRouter();
  const parts: Array<{ type: "text" | "mention"; value: string }> = [];

  let lastIndex = 0;
  for (const match of text.matchAll(MENTION_REGEX)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, idx) });
    }
    parts.push({ type: "mention", value: match[1] });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }

  return (
    <Text {...rest} className={className} selectable>
      {parts.map((part, i) =>
        part.type === "mention" ? (
          <Text
            key={i}
            onPress={() => router.push(`/user/${part.value}`)}
            className={isMine ? "text-cream font-bold underline" : "text-brand font-bold underline"}
          >
            @{part.value}
          </Text>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        )
      )}
    </Text>
  );
}
