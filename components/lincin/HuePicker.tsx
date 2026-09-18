import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { setFriendColor } from "@/lib/api/friend-colors";
import { useAuth } from "@/lib/auth/provider";
import { defaultHueFor, friendColor, hueFor, HUES, setHueChoice, useHueChoices, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { mono } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

/**
 * Jouw kleur voor iemand. Ingeklapt één stille regel — "jouw kleur ●" —
 * die openvouwt tot zes kleine stippen en "standaard" als je er een koos.
 * Staat in de gekleurde kop van een profiel, in de inkt van die kop.
 *
 * Alleen in het thema kleur: daar draagt iedereen zijn kleur. De keuze
 * geldt meteen overal (hueFor in lib/design/theme.ts) en gaat daarna naar
 * `friend_colors`. Alleen jij ziet hem. Lukt het bewaren niet, dan springt
 * de kleur terug.
 */
export function HuePicker({ personId, ink }: { personId: string; ink: string }) {
  const t = useT();
  const toast = useToast();
  const scheme = useScheme();
  const spec = useThemeSpec();
  const { session } = useAuth();
  const choices = useHueChoices();
  const [open, setOpen] = useState(false);
  const myUserId = session?.user.id;
  if (spec.id !== "kleur") return null;
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
  const web = Platform.OS === "web" ? ({ cursor: "pointer" } as object) : null;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, opacity: 0.8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${t.yourColor}, ${t.yourColorSub}`}
        onPress={() => setOpen((v) => !v)}
        hitSlop={6}
        style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, web]}
      >
        <Text style={label}>{t.yourColor}</Text>
        {/* De kleur van nu: een stip met een haarlijn, zodat hij ook op zijn eigen band te zien is. */}
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: friendColor(current, scheme).fill, borderWidth: 1, borderColor: ink }} />
      </Pressable>
      {open ? (
        <>
          <View style={{ flexDirection: "row", gap: 7 }}>
            {HUES.map((h) => {
              const on = h === current;
              return (
                <Pressable
                  key={h}
                  accessibilityRole="radio"
                  accessibilityLabel={h}
                  accessibilityState={{ selected: on }}
                  onPress={() => pick(h)}
                  hitSlop={6}
                  style={[
                    {
                      width: 12,
                      height: 12,
                      borderRadius: 6,
                      backgroundColor: friendColor(h, scheme).fill,
                      borderWidth: on ? 1.5 : 0.5,
                      borderColor: ink,
                      opacity: on ? 1 : 0.75,
                    },
                    web,
                  ]}
                />
              );
            })}
          </View>
          <Text style={[label, { opacity: 0.7, textTransform: "none", letterSpacing: 0 }]}>{t.yourColorSub}</Text>
          {chosen ? (
            <Pressable accessibilityRole="button" onPress={() => pick(null)} hitSlop={6} style={web}>
              <Text style={[label, { textDecorationLine: "underline" }]}>{t.colorReset}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
