/**
 * SmartTextInput — TextInput met @mention + emoji autocomplete.
 * Zelfde gedrag als de chat-input, herbruikbaar in alle compose-schermen.
 */
import { useEffect, useRef, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Avatar } from "./Avatar";
import { useAuth } from "@/lib/auth/provider";
import { listMyFriendships } from "@/lib/api/friends";
import { emojiSuggestionsFor, replaceEmoticons } from "@/lib/emoji";
import { useMentions, type MentionCandidate } from "@/lib/useMentions";

type Props = Omit<TextInputProps, "value" | "onChangeText"> & {
  value: string;
  onChangeText: (text: string) => void;
  /** Extra className op de TextInput zelf */
  inputClassName?: string;
};

export function SmartTextInput({ value, onChangeText, inputClassName, style, ...rest }: Props) {
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";

  const [friends, setFriends] = useState<MentionCandidate[]>([]);
  const [emojiList, setEmojiList] = useState<{ name: string; emoji: string }[] | null>(null);

  useEffect(() => {
    listMyFriendships(myUserId).then((fs) => {
      setFriends(
        fs.filter((f) => f.status === "accepted").map((f) => ({
          id: f.other.id,
          display: f.other.display_name ?? f.other.username,
          username: f.other.username,
          avatarUrl: f.other.avatar_url ?? null,
        }))
      );
    });
  }, [myUserId]);

  const { mentionList, onChangeText: mentionChangeText, applyMention } = useMentions({
    draft: value,
    setDraft: onChangeText,
    candidates: friends,
  });

  function handleChange(text: string) {
    const converted = replaceEmoticons(text);
    mentionChangeText(converted);

    // Emoji autocomplete: :naam
    const emojiMatch = converted.match(/:([a-z0-9_+\-]{2,})$/i);
    if (emojiMatch) {
      const results = emojiSuggestionsFor(emojiMatch[1]);
      setEmojiList(results.length > 0 ? results : null);
    } else {
      setEmojiList(null);
    }
  }

  function applyEmoji(name: string, emoji: string) {
    const replaced = value.replace(/:([a-z0-9_+\-]{2,})$/i, emoji + " ");
    onChangeText(replaced);
    setEmojiList(null);
  }

  return (
    <View>
      {/* Emoji suggesties */}
      {emojiList && emojiList.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ gap: 6, paddingVertical: 4, paddingHorizontal: 2, marginBottom: 6 }}
        >
          {emojiList.map(({ name, emoji }) => (
            <Pressable
              key={name}
              onPress={() => applyEmoji(name, emoji)}
              className="bg-paper rounded-2xl px-3 py-2 flex-row items-center gap-2"
            >
              <Text style={{ fontSize: 18 }}>{emoji}</Text>
              <Text className="text-ink-muted text-xs">:{name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* @mention suggesties */}
      {mentionList && mentionList.length > 0 && (
        <View className="bg-paper rounded-2xl overflow-hidden mb-2">
          {mentionList.map((m, i) => (
            <Pressable
              key={m.username}
              onPress={() => applyMention(m.username)}
              className={`flex-row items-center px-3 py-2.5 gap-2 ${i < mentionList.length - 1 ? "border-b border-line-paper/40" : ""}`}
            >
              <Avatar name={m.display} avatarUrl={m.avatarUrl} size="xs" />
              <View className="flex-1">
                <Text className="text-ink text-sm font-semibold">{m.display}</Text>
                <Text className="text-ink-muted text-xs">@{m.username}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      )}

      <TextInput
        value={value}
        onChangeText={handleChange}
        className={inputClassName}
        style={[Platform.OS === "web" ? { outlineWidth: 0 } as any : {}, style]}
        {...rest}
      />
    </View>
  );
}
