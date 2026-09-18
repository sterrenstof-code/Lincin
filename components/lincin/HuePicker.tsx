import { Platform, Pressable, Text, View } from "react-native";

import { setFriendColor } from "@/lib/api/friend-colors";
import { useAuth } from "@/lib/auth/provider";
import { defaultHueFor, friendColor, hueFor, HUES, setHueChoice, useHueChoices, useScheme, type Hue } from "@/lib/design/theme";
import { mono } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

/**
 * Jouw kleur voor iemand: zes vlakjes, en "standaard" als je er een koos.
 * Staat in de gekleurde kop van een profiel, in de inkt van die kop.
 *
 * De keuze geldt meteen overal (hueFor in lib/design/theme.ts) en gaat
 * daarna naar `friend_colors`. Alleen jij ziet hem. Lukt het bewaren niet,
 * dan springt de kleur terug.
 */
export function HuePicker({ personId, ink }: { personId: string; ink: string }) {
  const t = useT();
  const toast = useToast();
  const scheme = useScheme();
  const { session } = useAuth();
  const choices = useHueChoices();
  const myUserId = session?.user.id;
  const current = hueFor(personId);
  const chosen = !!choices[personId];

  function pick(hue: Hue | null) {
    if (!myUserId) return;
    const before = choices[personId] ?? null;
    // Kiezen wat hij van zichzelf al heeft, is geen keuze: niets bewaren.
    const next = hue && hue === defaultHueFor(personId) ? null : hue;
    if (next === before) return;
    setHueChoice(personId, next);
    setFriendColor(myUserId, personId, next).catch(() => {
      setHueChoice(personId, before);
      toast.error(t.failed);
    });
  }

  const label = { ...mono(500), fontSize: 9, lineHeight: 12, letterSpacing: 1.08, textTransform: "uppercase" as const, color: ink };

  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
      <Text style={label}>
        {t.yourColor} <Text style={{ opacity: 0.7 }}>· {t.yourColorSub}</Text>
      </Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {HUES.map((h) => {
          const on = h === current;
          return (
            <Pressable
              key={h}
              accessibilityRole="radio"
              accessibilityLabel={h}
              accessibilityState={{ selected: on }}
              onPress={() => pick(h)}
              hitSlop={4}
              style={[
                {
                  width: 22,
                  height: 22,
                  backgroundColor: friendColor(h, scheme).fill,
                  borderWidth: on ? 2.5 : 1,
                  borderColor: ink,
                },
                Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null,
              ]}
            />
          );
        })}
      </View>
      {chosen ? (
        <Pressable accessibilityRole="button" onPress={() => pick(null)} hitSlop={6}>
          <Text style={[label, { textDecorationLine: "underline" }]}>{t.colorReset}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
