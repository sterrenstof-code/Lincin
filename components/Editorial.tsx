import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View, type TextStyle } from "react-native";

import { cream, ink, line, type } from "@/lib/design/type";

/**
 * Editorial-primitieven.
 *
 * De feed is opgebouwd uit *banden* die van rand tot rand lopen, gescheiden
 * door haarlijnen — niet uit zwevende kaartjes met tussenruimte. Dat is het
 * hele verschil tussen een affiche en een tijdlijn. Deze bouwstenen leggen
 * dat vast zodat elk vondsttype er vanzelf hetzelfde ritme van krijgt.
 *
 * Alles komt in twee tonen: "shell" (donkere buitenschil, crème tekst) en
 * "paper" (warm papier, inkt tekst). Geen enkele component kiest zelf een
 * kleur buiten die twee.
 */

export type Tone = "shell" | "paper";

/** Echte 1px-lijn, ook op retina — hairlineWidth i.p.v. een border-class. */
export function Rule({
  tone = "shell",
  inset = 0,
  strong = false,
}: {
  tone?: Tone;
  /** Horizontale inspringing; 0 = volle breedte (standaard). */
  inset?: number;
  /** Zwaardere lijn voor rubrieksscheiding. */
  strong?: boolean;
}) {
  return (
    <View
      style={{
        height: strong ? 1.5 : StyleSheet.hairlineWidth,
        marginHorizontal: inset,
        backgroundColor: tone === "shell" ? line.shell : line.paper,
      }}
    />
  );
}

/** 9px kapitalen, wijd gespatieerd. De fluisterlaag. */
export function Meta({
  children,
  tone = "shell",
  dim = false,
  large = false,
  style,
  numberOfLines,
}: {
  children: string;
  tone?: Tone;
  dim?: boolean;
  large?: boolean;
  style?: TextStyle;
  numberOfLines?: number;
}) {
  const color =
    tone === "shell"
      ? dim ? cream.muted : cream.soft
      : dim ? ink.muted : ink.soft;
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[large ? type.metaLarge : type.meta, { color }, style]}
    >
      {children.toUpperCase()}
    </Text>
  );
}

/**
 * De regel boven elke vondst: SOORT · DELER · TIJD.
 * Losse spans met een dun scheidingsteken, niet één string — zo kan de
 * naam van de deler nadruk krijgen zonder de rest mee te trekken.
 */
export function Kicker({
  parts,
  tone = "shell",
  right,
}: {
  parts: (string | null | undefined)[];
  tone?: Tone;
  right?: ReactNode;
}) {
  const visible = parts.filter((p): p is string => !!p && p.length > 0);
  return (
    <View className="flex-row items-center">
      <View className="flex-1 flex-row items-center flex-wrap">
        {visible.map((part, i) => (
          <View key={`${part}-${i}`} className="flex-row items-center">
            {i > 0 && (
              <Meta tone={tone} dim style={{ marginHorizontal: 6 }}>
                ·
              </Meta>
            )}
            <Meta tone={tone} dim={i > 0}>
              {part}
            </Meta>
          </View>
        ))}
      </View>
      {right}
    </View>
  );
}

/**
 * Rubriekkop: label links, lijn eronder. Zoals "Events" / "Reservations"
 * op het affiche — het label draagt de hele kolom die erop volgt.
 */
export function SectionHead({
  label,
  right,
  tone = "shell",
}: {
  label: string;
  right?: string;
  tone?: Tone;
}) {
  return (
    <View>
      <View className="flex-row items-end justify-between px-5 pb-2 pt-7">
        <Meta tone={tone} large>
          {label}
        </Meta>
        {right ? (
          <Meta tone={tone} dim>
            {right}
          </Meta>
        ) : null}
      </View>
      <Rule tone={tone} strong />
    </View>
  );
}

/**
 * Label-links / inhoud-rechts. Het structurele hoofdmotief van het affiche.
 * Op smalle schermen blijft de labelkolom smal genoeg om te werken; de
 * inhoud krijgt de rest.
 */
export function LabelRow({
  label,
  children,
  tone = "shell",
  labelWidth = 76,
}: {
  label?: string;
  children: ReactNode;
  tone?: Tone;
  labelWidth?: number;
}) {
  return (
    <View className="flex-row px-5 py-4">
      <View style={{ width: labelWidth }} className="pr-3 pt-0.5">
        {label ? (
          <Meta tone={tone} dim>
            {label}
          </Meta>
        ) : null}
      </View>
      <View className="flex-1">{children}</View>
    </View>
  );
}

/** De diagonale pijl rechtsboven — "dit leidt ergens heen". */
export function Arrow({
  tone = "shell",
  size = 15,
  dim = false,
}: {
  tone?: Tone;
  size?: number;
  dim?: boolean;
}) {
  const color =
    tone === "shell"
      ? dim ? cream.muted : cream.soft
      : dim ? ink.muted : ink.soft;
  return (
    <View style={{ transform: [{ rotate: "-45deg" }] }}>
      <Ionicons name="arrow-forward" size={size} color={color} />
    </View>
  );
}

/**
 * Volle-breedte klikbare regel met pijl rechts en haarlijn eronder.
 * De bouwsteen van elke lijst op het affiche.
 */
export function ArrowRow({
  title,
  meta,
  onPress,
  tone = "shell",
  serif = true,
}: {
  title: string;
  meta?: string;
  onPress: () => void;
  tone?: Tone;
  serif?: boolean;
}) {
  return (
    <View>
      <Pressable
        onPress={onPress}
        className={`flex-row items-center px-5 py-4 ${
          tone === "shell" ? "active:bg-shell-soft" : "active:bg-paper-warm"
        }`}
      >
        <View className="flex-1 pr-4">
          <Text
            style={[
              serif ? type.headlineSmall : type.body,
              { color: tone === "shell" ? cream.DEFAULT : ink.DEFAULT },
            ]}
          >
            {title}
          </Text>
          {meta ? (
            <View className="mt-1">
              <Meta tone={tone} dim>
                {meta}
              </Meta>
            </View>
          ) : null}
        </View>
        <Arrow tone={tone} />
      </Pressable>
      <Rule tone={tone} />
    </View>
  );
}

/**
 * De masthead: vier micro-kolommen bovenaan, zoals de kop van het affiche.
 * Draagt geen functie — hij zet de toon. Dat is genoeg reden.
 */
export function Masthead({
  columns,
  tone = "shell",
}: {
  columns: { label: string; value?: string }[];
  tone?: Tone;
}) {
  return (
    <View>
      <View className="flex-row px-5 pt-3 pb-3.5">
        {columns.map((col, i) => (
          <View key={col.label} className={i === 0 ? "flex-[1.3] pr-2" : "flex-1 pr-2"}>
            <Meta tone={tone}>{col.label}</Meta>
            {col.value ? (
              <View className="mt-0.5">
                <Meta tone={tone} dim>
                  {col.value}
                </Meta>
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <Rule tone={tone} strong />
    </View>
  );
}

/** Klein rechthoekig knopje met dunne rand — géén pil. */
export function BoxButton({
  label,
  onPress,
  tone = "shell",
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: tone === "shell" ? cream.soft : ink.DEFAULT,
      }}
      className={`self-start px-3.5 py-2 ${
        tone === "shell" ? "active:bg-shell-soft" : "active:bg-paper-warm"
      }`}
    >
      <Meta tone={tone}>{label}</Meta>
    </Pressable>
  );
}

/** Tag-rij: kleine kapitalen met een schuine streep ertussen. */
export function TagRow({ tags, tone = "shell" }: { tags: string[]; tone?: Tone }) {
  if (!tags || tags.length === 0) return null;
  return (
    <View className="flex-row flex-wrap items-center mt-3">
      {tags.map((t, i) => (
        <View key={t} className="flex-row items-center">
          {i > 0 && (
            <Meta tone={tone} dim style={{ marginHorizontal: 5 }}>
              /
            </Meta>
          )}
          <Meta tone={tone} dim>
            {t}
          </Meta>
        </View>
      ))}
    </View>
  );
}
