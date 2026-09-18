import * as ImagePicker from "expo-image-picker";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { color, line } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
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
  return (
    <View style={{ borderTopWidth: BORDER, borderTopColor: line(), backgroundColor: color("paper") }}>
      {above}
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
          onChangeText={onChange}
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
