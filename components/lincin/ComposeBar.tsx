import * as ImagePicker from "expo-image-picker";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { color, line, useThemeSpec } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { emojiSuggestionsFor, replaceEmoticons } from "@/lib/emoji";
import { useT } from "@/lib/i18n";

import { BORDER, Btn, CONTROL, GUTTER, Mono, SquareBtn } from "./ui";

/**
 * De balk onderaan een bladzijde en een gesprek (README §02, §05):
 * `☺` 44 · invoer 44 · `↑` 44, één doorlopende rij zonder kieren.
 *
 * `☺` opent het reactievak erboven: Emoji | GIF | Sticker | ×. Wat een
 * emoji dóet bepaalt de aanroeper — op een bladzijde is het een reactie
 * op de bijdrage, in een gesprek gaat hij in het bericht.
 */

const EMOJI = ["🔥", "❤️", "😂", "😮", "🥹", "👏", "🌊", "🌅", "☕", "🛶", "🎧", "✨"];

/** `:naam` aan het eind van wat je typt: dat is een emoji die je zoekt. */
const EMOJI_QUERY = /:([a-z0-9_+\-]{2,})$/i;

/**
 * Emoji-suggesties bij het typen, zoals in een gesprek.
 *
 * Het gesprek had ze al (`app/chat/[id].tsx`): `:monk` toont 🐒 erboven,
 * Tab neemt de eerste, en `:)` wordt 🙂. Deze balk — reacties op een
 * bijdrage of poll — had er niets van, dus werkte hetzelfde gebaar op de
 * ene plek wel en een scherm verder niet. De lijst wordt afgeleid van de
 * tekst, niet bewaard: wat je typt ís de toestand.
 */
export function useEmojiSuggest(value: string, onChange: (v: string) => void) {
  const match = value.match(EMOJI_QUERY);
  const list = match ? emojiSuggestionsFor(match[1]) : [];
  const apply = (emoji: string) => onChange(value.replace(EMOJI_QUERY, emoji + " "));
  const onChangeText = (text: string) => onChange(replaceEmoticons(text));
  // Op web: Tab neemt de eerste suggestie, zoals in een gesprek.
  const onKeyPress = (e: { nativeEvent: { key: string }; preventDefault?: () => void }) => {
    if (Platform.OS !== "web" || e.nativeEvent.key !== "Tab" || list.length === 0) return;
    e.preventDefault?.();
    apply(list[0].emoji);
  };
  return { list, apply, onChangeText, onKeyPress };
}

export function EmojiSuggestions({
  list,
  onPick,
  round,
  pad = GUTTER,
}: {
  list: { name: string; emoji: string }[];
  onPick: (emoji: string) => void;
  /** Modern: pillen. Kleur en magazine: vakjes met een rand. */
  round: boolean;
  /** De zijmarge van de rij; het desktoppaneel gebruikt 20. */
  pad?: number;
}) {
  if (list.length === 0) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="always"
      contentContainerStyle={{ gap: 6, paddingHorizontal: pad, paddingTop: 8 }}
    >
      {list.map(({ name, emoji }) => (
        <Pressable
          key={name}
          accessibilityRole="button"
          accessibilityLabel={`${emoji} :${name}`}
          onPress={() => onPick(emoji)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            height: 34,
            paddingHorizontal: 10,
            backgroundColor: round ? color("paper", "glass") : color("paper"),
            ...(round
              ? { borderRadius: 999, borderWidth: 1, borderColor: color("ink", "postRule") }
              : { borderWidth: BORDER, borderColor: line() }),
          }}
        >
          <Text style={{ fontSize: 18, lineHeight: 22 }}>{emoji}</Text>
          <Text style={[lincinType.meta, { textTransform: "none", color: color("ink", "inkDim") }]}>:{name}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export function ComposeBar({
  value,
  onChange,
  onSend,
  placeholder,
  boxOpen,
  onToggleBox,
  sending = false,
  above,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  boxOpen: boolean;
  onToggleBox: () => void;
  sending?: boolean;
  /** De antwoordregel of het reactievak, bóven de rij. */
  above?: ReactNode;
}) {
  const spec = useThemeSpec();
  const emoji = useEmojiSuggest(value, onChange);
  if (spec.id === "modern") {
    return (
      <ModernBar
        value={value}
        onChange={onChange}
        onSend={onSend}
        placeholder={placeholder}
        boxOpen={boxOpen}
        onToggleBox={onToggleBox}
        sending={sending}
        above={above}
        emoji={emoji}
      />
    );
  }
  return (
    <View style={{ borderTopWidth: BORDER, borderTopColor: line(), backgroundColor: color("paper") }}>
      {above}
      <EmojiSuggestions list={emoji.list} onPick={emoji.apply} round={false} />
      <View style={{ flexDirection: "row", paddingHorizontal: GUTTER, paddingTop: 8, paddingBottom: 10 }}>
        <SquareBtn
          glyph="☺"
          size={CONTROL}
          fontSize={18}
          fill={boxOpen}
          onPress={onToggleBox}
          accessibilityLabel="Emoji en gifs"
          style={{ borderRightWidth: 0 }}
        />
        <TextInput
          value={value}
          onChangeText={emoji.onChangeText}
          onKeyPress={emoji.onKeyPress}
          placeholder={placeholder}
          placeholderTextColor={color("ink", "inkDim")}
          onSubmitEditing={onSend}
          blurOnSubmit={false}
          returnKeyType="send"
          editable={!sending}
          style={[
            lincinType.body,
            {
              flex: 1,
              minWidth: 0,
              height: CONTROL,
              borderWidth: BORDER,
              borderColor: line(),
              paddingHorizontal: 12,
              color: color("ink"),
              backgroundColor: "transparent",
              ...(Platform.OS === "web" ? { outlineWidth: 0 } : null),
            } as object,
          ]}
        />
        <SquareBtn glyph="↑" size={CONTROL} fontSize={18} fill onPress={onSend} accessibilityLabel="Verstuur" />
      </View>
    </View>
  );
}

/**
 * Dezelfde balk in modern: één pil van glas in plaats van drie vakken met
 * een inktrand. ☺ en ↑ zijn ronde knoppen erin, zoals de rest van modern
 * rond is; kleur en magazine houden hun rechte rij.
 */
function ModernBar({
  value,
  onChange,
  onSend,
  placeholder,
  boxOpen,
  onToggleBox,
  sending,
  above,
  emoji,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  placeholder: string;
  boxOpen: boolean;
  onToggleBox: () => void;
  sending: boolean;
  above?: ReactNode;
  emoji: ReturnType<typeof useEmojiSuggest>;
}) {
  const ink = color("ink");
  const round = (fill: boolean) => ({
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    backgroundColor: fill ? ink : "transparent",
  });
  return (
    <View style={{ paddingTop: 8, paddingBottom: 12 }}>
      {above}
      <EmojiSuggestions list={emoji.list} onPick={emoji.apply} round />
      <View
        // De pil zelf houdt de zijmarge; de suggesties erboven schuiven van
        // rand tot rand.
        style={{ marginHorizontal: GUTTER, marginTop: emoji.list.length ? 8 : 0 }}
      >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          padding: 4,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: color("ink", "postRule"),
          backgroundColor: color("paper", "glass"),
          ...(Platform.OS === "web"
            ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as object)
            : null),
        }}
      >
        <Pressable accessibilityRole="button" accessibilityLabel="Emoji en gifs" onPress={onToggleBox} style={round(boxOpen)}>
          <Text style={{ fontSize: 18, lineHeight: 22, color: boxOpen ? color("paper") : ink }}>☺</Text>
        </Pressable>
        <TextInput
          value={value}
          onChangeText={emoji.onChangeText}
          onKeyPress={emoji.onKeyPress}
          placeholder={placeholder}
          placeholderTextColor={color("ink", "inkDim")}
          onSubmitEditing={onSend}
          blurOnSubmit={false}
          returnKeyType="send"
          editable={!sending}
          style={[
            lincinType.body,
            {
              flex: 1,
              minWidth: 0,
              height: 38,
              paddingHorizontal: 6,
              color: ink,
              backgroundColor: "transparent",
              ...(Platform.OS === "web" ? { outlineWidth: 0 } : null),
            } as object,
          ]}
        />
        <Pressable accessibilityRole="button" accessibilityLabel="Verstuur" onPress={onSend} style={round(true)}>
          <Text style={{ fontSize: 17, lineHeight: 20, color: color("paper") }}>↑</Text>
        </Pressable>
      </View>
      </View>
    </View>
  );
}

/**
 * Het reactievak: Emoji | GIF | Sticker | ×.
 *
 * De GIF-tab kent geen zoekdienst; hij opent de beeldkiezer van het
 * toestel (een gif uit je eigen rol is ook een gif). Sticker is
 * uitgeschakeld, zoals in het ontwerp.
 */
export function ReactBox({
  onClose,
  onEmoji,
  onImage,
  active,
}: {
  onClose: () => void;
  onEmoji: (emoji: string) => void;
  onImage?: (uri: string) => void;
  /** Emoji die nu aan staan (een bladzijde kleurt ze zuur). */
  active?: Set<string>;
}) {
  const t = useT();
  const [tab, setTab] = useState<"emoji" | "gif">("emoji");
  const ink = color("ink");

  async function pick() {
    if (!onImage) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 1,
      allowsEditing: false,
      selectionLimit: 1,
    });
    const uri = result.canceled ? null : result.assets?.[0]?.uri ?? null;
    if (uri) onImage(uri);
  }

  return (
    <View style={{ paddingHorizontal: GUTTER, paddingTop: 8 }}>
      <View style={{ borderWidth: BORDER, borderBottomWidth: 0, borderColor: ink, backgroundColor: color("paper") }}>
        <View style={{ flexDirection: "row", borderBottomWidth: BORDER, borderBottomColor: ink }}>
          <Tab label="Emoji" on={tab === "emoji"} onPress={() => setTab("emoji")} />
          <Tab label="GIF" on={tab === "gif"} onPress={() => setTab("gif")} border />
          <Tab label="Sticker" disabled border />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.cancel}
            onPress={onClose}
            style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center", borderLeftWidth: BORDER, borderLeftColor: ink }}
          >
            <Text style={{ fontSize: 14, color: ink }}>×</Text>
          </Pressable>
        </View>
        {tab === "emoji" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", backgroundColor: ink, gap: BORDER }}>
            {EMOJI.map((e) => {
              const on = active?.has(e);
              return (
                <Pressable
                  key={e}
                  accessibilityRole="button"
                  accessibilityLabel={e}
                  accessibilityState={{ selected: !!on }}
                  onPress={() => onEmoji(e)}
                  style={{
                    width: `${100 / 6}%`,
                    flexGrow: 1,
                    flexBasis: `${100 / 6 - 1}%`,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? color("acid") : color("paper"),
                  }}
                >
                  <Text style={{ fontSize: 24, lineHeight: 30 }}>{e}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <ScrollView horizontal={false} style={{ maxHeight: 160 }} contentContainerStyle={{ padding: 10, gap: 8 }}>
            <Mono variant="tiny" tone="dim" style={{ textTransform: "none" }}>
              {t.searchGif}
            </Mono>
            <Btn label="Kies een gif of beeld" fill height={36} onPress={pick} disabled={!onImage} />
          </ScrollView>
        )}
      </View>
    </View>
  );
}

function Tab({
  label,
  on = false,
  onPress,
  disabled = false,
  border = false,
}: {
  label: string;
  on?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  border?: boolean;
}) {
  const ink = color("ink");
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on, disabled }}
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        height: 34,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: on ? ink : "transparent",
        borderLeftWidth: border ? BORDER : 0,
        borderLeftColor: ink,
      }}
    >
      <Text style={[lincinType.action, { letterSpacing: 0.6, color: on ? color("paper") : disabled ? color("ink", "inkDim") : ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}
