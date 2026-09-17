import { Platform, Pressable, Text, TextInput, View } from "react-native";

import type { Compose } from "@/app/post-compose";
import { POLL_MAX, POLL_MIN } from "@/lib/lincin/compose";
import { color, line } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";

import { BORDER } from "../ui";

/**
 * De keuze-editor van Nieuwe bijdrage (HANDOFF 2.1 §Poll composer).
 *
 * Staat rechts in de poster, naast het kleurpaneel, als de soort `poll`
 * is. Twee tot vier genummerde rijen (01–04) met een invoerveld, een ×
 * om weg te halen (pas boven de twee), een gestreepte `+ Keuze erbij`
 * zolang er minder dan vier zijn, en onderaan de schakelaar
 * `één stem per linc` ↔ `meerdere keuzes`. De vraag zelf is de titel.
 */
export function PollEditor({ c }: { c: Compose }) {
  const { t, pollOptions, setPollOption, addPollOption, removePollOption, pollMulti, setPollMulti } = c;
  const dim = color("ink", "inkDim");
  const label = { ...mono(500), fontSize: 10, lineHeight: 13, textTransform: "uppercase" as const };
  const canRemove = pollOptions.length > POLL_MIN;

  return (
    <View style={{ flex: 1, minWidth: 0, padding: 14, gap: 8 }}>
      <Text style={[label, { letterSpacing: 0.8, color: dim }]}>{t.pollOptions}</Text>

      {pollOptions.map((value, i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "stretch", borderWidth: BORDER, borderColor: line() }}>
          <View style={{ width: 26, alignItems: "center", justifyContent: "center", borderRightWidth: BORDER, borderRightColor: line() }}>
            <Text style={{ ...mono(600), fontSize: 11, lineHeight: 14, color: dim }}>{String(i + 1).padStart(2, "0")}</Text>
          </View>
          <TextInput
            value={value}
            onChangeText={(v) => setPollOption(i, v)}
            placeholder={i === 0 ? t.pollPh1 : i === 1 ? t.pollPh2 : t.pollPhN}
            placeholderTextColor={dim}
            maxLength={80}
            style={[
              { ...sans(400), flex: 1, minWidth: 0, height: 38, paddingHorizontal: 10, fontSize: 15, color: color("ink") },
              Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null,
            ]}
          />
          {canRemove ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Keuze ${i + 1} weg`}
              onPress={() => removePollOption(i)}
              style={{ width: 34, alignItems: "center", justifyContent: "center", borderLeftWidth: BORDER, borderLeftColor: line() }}
            >
              <Text style={{ fontSize: 15, lineHeight: 18, color: dim }}>×</Text>
            </Pressable>
          ) : null}
        </View>
      ))}

      {pollOptions.length < POLL_MAX ? (
        <Pressable
          accessibilityRole="button"
          onPress={addPollOption}
          style={{
            height: 38,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: line(),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ ...mono(600), fontSize: 11, lineHeight: 14, letterSpacing: 0.88, textTransform: "uppercase", color: dim }}>
            + {t.pollAdd}
          </Text>
        </Pressable>
      ) : null}

      <View
        style={{
          marginTop: "auto",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: color("ink", "postRule"),
        }}
      >
        <Text style={[label, { letterSpacing: 0.6, color: dim, flexShrink: 1 }]}>{t.pollOne}</Text>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: pollMulti }}
          accessibilityLabel={t.pollMulti}
          onPress={() => setPollMulti(!pollMulti)}
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 }}
        >
          <View
            style={{
              width: 26,
              height: 16,
              borderWidth: BORDER,
              borderColor: line(),
              padding: 1,
              flexDirection: "row",
              justifyContent: pollMulti ? "flex-end" : "flex-start",
            }}
          >
            <View style={{ width: 10, backgroundColor: color("ink") }} />
          </View>
          <Text style={[label, { letterSpacing: 0.6, color: color("ink") }]}>{t.pollMulti}</Text>
        </Pressable>
      </View>
    </View>
  );
}
