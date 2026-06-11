import { useRouter } from "expo-router";
import { Fragment } from "react";
import { Linking, Text, type TextProps } from "react-native";

const MENTION_REGEX = /@([a-z0-9._]{3,32})/gi;
const URL_REGEX = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
// Leestekens die vaak direct na een URL staan en er niet bij horen
const TRAILING_PUNCT = /[.,;:!?)\]}>'"]+$/;

type Part =
  | { type: "text"; value: string }
  | { type: "mention"; value: string }
  | { type: "url"; value: string };

function tokenize(text: string): Part[] {
  const parts: Part[] = [];
  let lastIndex = 0;

  // Eerst URLs, daarna mentions binnen de overgebleven tekst
  for (const match of text.matchAll(URL_REGEX)) {
    const idx = match.index ?? 0;
    let url = match[0];
    const trailing = url.match(TRAILING_PUNCT)?.[0] ?? "";
    url = url.slice(0, url.length - trailing.length);

    if (idx > lastIndex) {
      pushTextWithMentions(parts, text.slice(lastIndex, idx));
    }
    parts.push({ type: "url", value: url });
    if (trailing) parts.push({ type: "text", value: trailing });
    lastIndex = idx + match[0].length;
  }
  if (lastIndex < text.length) {
    pushTextWithMentions(parts, text.slice(lastIndex));
  }
  return parts;
}

function pushTextWithMentions(parts: Part[], text: string) {
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
}

function openUrl(url: string) {
  const full = url.startsWith("http") ? url : `https://${url}`;
  Linking.openURL(full).catch(() => {});
}

/**
 * Rendert tekst en maakt @handles tappable (naar /user/{handle})
 * en URLs (https://… of www.…) klikbaar — opent in de browser.
 * Werkt zowel op web als native.
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
  const parts = tokenize(text);
  const linkClass = isMine
    ? "text-cream font-bold underline"
    : "text-brand font-bold underline";

  return (
    <Text {...rest} className={className} selectable>
      {parts.map((part, i) =>
        part.type === "mention" ? (
          <Text key={i} onPress={() => router.push(`/user/${part.value}`)} className={linkClass}>
            @{part.value}
          </Text>
        ) : part.type === "url" ? (
          <Text key={i} onPress={() => openUrl(part.value)} className={`${linkClass} font-normal`}>
            {part.value}
          </Text>
        ) : (
          <Fragment key={i}>{part.value}</Fragment>
        )
      )}
    </Text>
  );
}
