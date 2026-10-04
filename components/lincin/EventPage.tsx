import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useVideoPlayer, VideoView } from "expo-video";
import { useState, type ReactNode } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

import { Avatar } from "@/components/Avatar";
import type { ContributionWithAuthor } from "@/lib/api/events";
import { color, friendColor, ON_DARK, RASTER, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { mono, sans, serif } from "@/lib/design/type";
import { useT } from "@/lib/i18n";

import { Spread } from "./magazine/Spread";

/**
 * De bladzijde van één event, per thema (HANDOFF.md §Thema's).
 *
 * Het ontwerp heeft geen eigen eventpagina; deze leidt hem af van de
 * eventrij op Events (`DesktopEvents`, `EventsModern`, `EventsMagazine`)
 * en schaalt die op tot een hele pagina:
 *
 *   magazine  de kop als volvlaks kleurvlak van wie uitnodigt, zoals de
 *             spreads op de voorpagina; daaronder vlakken op het tweede
 *             papier met een naad van 6. De dag en de titel in serif, labels in Archivo 9–10 op .2em. Pillen;
 *             de andere acties onderstreept.
 *   modern    tegels van 18 op het halfdoorzichtige vlak, naad 6. Een
 *             kleurtegel met de dag groot, Archivo 400 en Plex Mono,
 *             pillen.
 *
 * Alleen vorm: wat er gebeurt (uploaden, toegang, verwijderen) staat in
 * `app/event/[id].tsx`.
 */

export type EventFacts = {
  title: string;
  description: string | null;
  day: string;
  month: string;
  /** "wo 19:00" of "vr — zo". */
  when: string;
  /** "woensdag 24 september". */
  date: string;
  host: string;
  place: string;
  status: string;
  live: boolean;
  guests: number;
  contributions: number;
  open: boolean;
  /** Wie "ik kom" zei, of anders hoeveel lincs. */
  whoGo: string;
  fill: { fill: string; ink: string };
};

export type Face = { id: string; name: string | null | undefined; avatarUrl: string | null | undefined };

export type EventAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
};

const SEAM = RASTER.seam;

function useTh() {
  return useThemeSpec().id;
}

/** Mono, kapitaal, gespatieerd: de labels van modern. */
function meta(size: number, c: string, spacing = size * 0.1): TextStyle {
  return { ...mono(500), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: spacing, textTransform: "uppercase", color: c };
}

/** Archivo 500 op .2em: de labels van magazine. */
function kicker(size: number, c: string): TextStyle {
  return { ...sans(500), fontSize: size, lineHeight: Math.round(size * 1.35), letterSpacing: size * 0.2, textTransform: "uppercase", color: c };
}

// ---------------------------------------------------------------
// De pagina: de naad en de marge van het thema
// ---------------------------------------------------------------

export function EventSheet({ wide, children }: { wide: boolean; children: ReactNode }) {
  return (
    <View
      style={{
        padding: SEAM,
        paddingTop: SEAM,
        gap: SEAM,
        width: "100%",
        maxWidth: wide ? 1250 : undefined,
        alignSelf: "center",
      }}
    >
      {children}
    </View>
  );
}

/** Het vlak van een blok: tweede papier (magazine) of tegel (modern). */
function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const spec = useThemeSpec();
  const th = spec.id;
  const base: ViewStyle =
    th === "magazine"
      ? { backgroundColor: color("paper2") }
      : {
          borderRadius: RASTER.tileRadius,
          overflow: "hidden",
          backgroundColor: color("tile", "tileFill"),
          ...(Platform.OS === "web" ? ({ backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)" } as object) : null),
        };
  return <View style={[base, style]}>{children}</View>;
}

// ---------------------------------------------------------------
// HERO
// ---------------------------------------------------------------

export function EventHero({
  f,
  wide,
  cover,
  faces,
  onGuests,
}: {
  f: EventFacts;
  wide: boolean;
  /** Het beeld, al met de gedeelde-element-stijl en de lichtbak eraan. */
  cover: ReactNode | null;
  faces: Face[];
  onGuests: () => void;
}) {
  const th = useTh();
  if (th === "magazine") return <HeroMagazine f={f} wide={wide} cover={cover} faces={faces} onGuests={onGuests} />;
  return <HeroModern f={f} wide={wide} cover={cover} faces={faces} onGuests={onGuests} />;
}

type HeroProps = { f: EventFacts; wide: boolean; cover: ReactNode | null; faces: Face[]; onGuests: () => void };

/** De gezichten van wie er komt, overlappend. Een tik opent de hele lijst. */
function Faces({ faces, onPress, ink, label }: { faces: Face[]; onPress: () => void; ink: string; label: string }) {
  if (!faces.length) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={{ flexDirection: "row", alignItems: "center", minHeight: 32 }}
    >
      {faces.slice(0, 6).map((m, i) => (
        <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar name={m.name} avatarUrl={m.avatarUrl} size="sm" tint="light" />
        </View>
      ))}
      {faces.length > 6 ? <Text style={[meta(10, ink), { marginLeft: 8 }]}>{`+${faces.length - 6}`}</Text> : null}
    </Pressable>
  );
}

function guestsLabel(f: EventFacts) {
  return `${f.guests} ${f.guests === 1 ? "gast" : "gasten"}`;
}
function contribLabel(f: EventFacts) {
  return `${f.contributions} ${f.contributions === 1 ? "bijdrage" : "bijdragen"}`;
}

// ---- MAGAZINE -------------------------------------------------

function HeroMagazine({ f, wide, cover, faces, onGuests }: HeroProps) {
  const t = useT();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  return (
    <>
      <Panel style={{ backgroundColor: f.fill.fill }}>
        <View style={{ flexDirection: wide ? "row" : "column" }}>
          <View
            style={{
              width: wide ? 240 : undefined,
              paddingVertical: wide ? 28 : 20,
              paddingHorizontal: wide ? 30 : 20,
              justifyContent: "space-between",
              gap: 8,
              ...(wide ? { borderRightWidth: 1, borderRightColor: f.fill.ink } : { borderBottomWidth: 1, borderBottomColor: f.fill.ink }),
            }}
          >
            <Text style={kicker(10, f.fill.ink)}>{f.month}</Text>
            <Text style={[serif(), { fontSize: wide ? 150 : 88, lineHeight: wide ? 120 : 74, letterSpacing: wide ? -6 : -3.5, color: f.fill.ink }]}>{f.day}</Text>
          </View>
          <View style={{ flex: wide ? 1 : undefined, minWidth: 0, paddingVertical: wide ? 28 : 20, paddingHorizontal: wide ? 36 : 20, gap: wide ? 18 : 12, justifyContent: "space-between" }}>
            <Text style={[kicker(wide ? 10 : 9, f.fill.ink), { opacity: 0.8 }]}>
              {f.host} {t.invites} · {f.when} · {f.status}
            </Text>
            <Text style={[serif(), { fontSize: wide ? 72 : 42, lineHeight: wide ? 68 : 40, letterSpacing: wide ? -1.5 : -0.8, color: f.fill.ink }]}>{f.title}</Text>
            <Text style={[serif(true), { fontSize: wide ? 22 : 17, lineHeight: wide ? 28 : 23, color: f.fill.ink, opacity: 0.86 }]}>
              {f.place ? `${f.place} — ` : ""}
              {f.whoGo}
            </Text>
          </View>
        </View>
      </Panel>

      {cover ? <View style={{ aspectRatio: wide ? 16 / 7 : 4 / 5, backgroundColor: color("paper2") }}>{cover}</View> : null}

      <Panel style={{ flexDirection: wide ? "row" : "column", paddingVertical: wide ? 26 : 20, paddingHorizontal: wide ? 36 : 20, gap: wide ? 40 : 16 }}>
        {f.description ? (
          <Text style={[serif(), { flex: wide ? 1 : undefined, fontSize: wide ? 22 : 19, lineHeight: wide ? 30 : 26, color: ink }]}>{f.description}</Text>
        ) : null}
        <View style={{ width: wide ? (f.description ? 320 : undefined) : undefined, flex: wide && !f.description ? 1 : undefined, gap: 10 }}>
          {[
            ["Wanneer", f.date],
            ["Gezelschap", `${guestsLabel(f)} · ${contribLabel(f)}`],
            ["Toegang", f.open ? "Open, met de link" : "Gesloten, op goedkeuring"],
          ].map(([label, value]) => (
            <View key={label} style={{ borderTopWidth: 1, borderTopColor: rule, paddingTop: 8, gap: 3 }}>
              <Text style={kicker(9, dim)}>{label}</Text>
              <Text style={[serif(true), { fontSize: 17, lineHeight: 22, color: ink }]}>{value}</Text>
            </View>
          ))}
          <Faces faces={faces} onPress={onGuests} ink={ink} label={guestsLabel(f)} />
        </View>
      </Panel>
    </>
  );
}

// ---- MODERN ---------------------------------------------------

function HeroModern({ f, wide, cover, faces, onGuests }: HeroProps) {
  const t = useT();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const colorTile = (
    <View
      style={{
        borderRadius: RASTER.tileRadius,
        backgroundColor: f.fill.fill,
        padding: 22,
        justifyContent: "space-between",
        gap: 12,
        ...(wide ? { width: 340, minHeight: 320 } : { height: 220 }),
      }}
    >
      <Text style={meta(9, f.fill.ink, 1.44)}>
        {f.month} · {f.when}
      </Text>
      <Text style={[sans(400), { fontSize: wide ? 150 : 110, lineHeight: wide ? 120 : 88, letterSpacing: wide ? -9 : -6.6, color: f.fill.ink }]}>{f.day}</Text>
    </View>
  );
  const text = (
    <Panel style={{ flex: wide ? 1 : undefined, padding: wide ? 28 : RASTER.tilePadLarge, gap: 14, justifyContent: "space-between" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Text style={meta(9, dim, 1.44)}>
          {f.host} {t.invites}
        </Text>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: f.live ? ink : "transparent", borderWidth: f.live ? 0 : 1, borderColor: color("ink", "dash") }}>
          <Text style={meta(8.5, f.live ? color("paper") : dim, 1.02)}>{f.status}</Text>
        </View>
      </View>
      <Text style={[sans(400), { fontSize: wide ? 52 : 32, lineHeight: wide ? 54 : 34, letterSpacing: wide ? -2 : -1.1, color: ink }]}>{f.title}</Text>
      {f.description ? <Text style={[sans(400), { fontSize: 15, lineHeight: 22, color: dim, maxWidth: 640 }]}>{f.description}</Text> : null}
      <View style={{ borderTopWidth: 1, borderStyle: "dashed", borderTopColor: color("ink", "dash"), paddingTop: 14, gap: 10 }}>
        <Text style={[sans(400), { fontSize: 15, lineHeight: 20, color: ink }]}>
          {f.date}
          {f.place ? ` · ${f.place}` : ""}
        </Text>
        <Text style={meta(9, dim, 1.3)}>
          {guestsLabel(f)} · {contribLabel(f)} · {f.open ? "open" : "gesloten"}
        </Text>
        <Faces faces={faces} onPress={onGuests} ink={ink} label={guestsLabel(f)} />
      </View>
    </Panel>
  );
  return (
    <>
      <View style={{ flexDirection: wide ? "row" : "column", gap: SEAM }}>
        {colorTile}
        {text}
      </View>
      {cover ? (
        <View style={{ borderRadius: RASTER.tileRadius, overflow: "hidden", aspectRatio: wide ? 16 / 7 : 4 / 3, backgroundColor: color("tile", "tileFill") }}>{cover}</View>
      ) : null}
    </>
  );
}

// ---------------------------------------------------------------
// ACTIES
// ---------------------------------------------------------------

/**
 * Wat je met het event kunt doen. Geen "ik kom" / "misschien": wie
 * uitgenodigd is, is erbij — er valt niets te antwoorden.
 */
export function EventActions({ wide, actions }: { wide: boolean; actions: EventAction[] }) {
  const th = useTh();
  if (th === "magazine") return <ActionsMagazine wide={wide} actions={actions} />;
  return <ActionsModern wide={wide} actions={actions} />;
}

type ActionsProps = Parameters<typeof EventActions>[0];

function ActionsMagazine({ wide, actions }: ActionsProps) {
  const ink = color("ink");
  const primary = actions.find((a) => a.primary);
  const rest = actions.filter((a) => !a.primary);
  return (
    <Panel style={{ flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "stretch", paddingVertical: wide ? 22 : 18, paddingHorizontal: wide ? 36 : 20, gap: wide ? 32 : 16 }}>
      <View style={{ flex: wide ? 1 : undefined, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 22 }}>
        {rest.map((a) => (
          <Pressable key={a.label} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} disabled={a.disabled} style={{ paddingVertical: 14, marginVertical: -8 }}>
            <Text style={[kicker(10, ink), { textDecorationLine: "underline", ...(Platform.OS === "web" ? ({ textUnderlineOffset: 4 } as object) : null) }]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      {primary ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={primary.label}
          onPress={primary.onPress}
          disabled={primary.disabled}
          style={({ pressed }) => ({ height: 44, borderRadius: 22, paddingHorizontal: 24, backgroundColor: ink, alignItems: "center", justifyContent: "center", opacity: primary.disabled ? 0.5 : pressed ? 0.8 : 1 })}
        >
          <Text style={kicker(10, color("paper"))}>{primary.label} +</Text>
        </Pressable>
      ) : null}
    </Panel>
  );
}

function ActionsModern({ wide, actions }: ActionsProps) {
  const ink = color("ink");
  const pill = (key: string, label: string, onPress: () => void, on: boolean, opts: { dim?: boolean; icon?: keyof typeof Ionicons.glyphMap; disabled?: boolean; grow?: boolean } = {}) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: on }}
      onPress={onPress}
      disabled={opts.disabled}
      style={({ pressed }) => ({
        flex: opts.grow ? 1 : undefined,
        height: 44,
        paddingHorizontal: 18,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: on ? ink : color("ink", "postRule"),
        backgroundColor: on ? ink : "transparent",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        opacity: opts.disabled ? 0.5 : pressed ? 0.75 : 1,
      })}
    >
      {opts.icon ? <Ionicons name={opts.icon} size={14} color={on ? color("paper") : ink} /> : null}
      <Text style={meta(9.5, on ? color("paper") : opts.dim ? color("ink", "inkDim") : ink, 1.14)}>{label}</Text>
    </Pressable>
  );
  return (
    <Panel style={{ padding: wide ? 22 : RASTER.tilePad, flexDirection: wide ? "row" : "column", alignItems: wide ? "center" : "stretch", gap: wide ? 24 : 14 }}>
      <View style={{ flex: wide ? 1 : undefined, flexDirection: "row", flexWrap: "wrap", gap: SEAM, justifyContent: wide ? "flex-end" : "flex-start" }}>
        {actions.map((a) => pill(a.label, a.label, a.onPress, !!a.primary, { icon: a.icon, disabled: a.disabled, grow: !wide }))}
      </View>
    </Panel>
  );
}

// ---------------------------------------------------------------
// MELDINGEN: gekopieerd, fout, en de privacyregel
// ---------------------------------------------------------------

export function EventNotice({ text, tone = "dim" }: { text: string; tone?: "dim" | "red" | "ink" }) {
  const th = useTh();
  const c = tone === "red" ? color("red") : tone === "ink" ? color("ink") : color("ink", "inkDim");
  if (th === "magazine") return <Text style={[serif(true), { fontSize: 15, lineHeight: 20, color: c, textAlign: "center", paddingVertical: 4 }]}>{text}</Text>;
  return <Text style={[meta(9.5, c, 0.9), { textAlign: "center", paddingVertical: 4 }]}>{text}</Text>;
}

// ---------------------------------------------------------------
// BIJDRAGEN
// ---------------------------------------------------------------

/** De kop boven de bijdragen: magazine een kicker met serif, modern mono. */
export function ContributionsHead({ count, wide }: { count: number; wide: boolean }) {
  const th = useTh();
  const ink = color("ink");
  if (th === "magazine") {
    return (
      <View style={{ paddingTop: wide ? 22 : 16, paddingBottom: 6, paddingHorizontal: wide ? 30 : 18, flexDirection: "row", alignItems: "baseline", gap: 14 }}>
        <Text style={[serif(), { fontSize: wide ? 44 : 32, lineHeight: wide ? 44 : 32, letterSpacing: -0.8, color: ink }]}>Bijdragen</Text>
        <Text style={kicker(9, color("ink", "inkDim"))}>{count}</Text>
      </View>
    );
  }
  return (
    <View style={{ paddingTop: 12, paddingBottom: 4, paddingHorizontal: 18, flexDirection: "row", justifyContent: "space-between" }}>
      <Text style={meta(9, color("ink", "inkDim"), 1.44)}>Bijdragen</Text>
      <Text style={meta(9, color("ink", "inkDim"), 1.44)}>{count}</Text>
    </View>
  );
}

/** Onthulling vergrendeld, of nog niets: één blok in de vorm van het thema. */
export function EventEmpty({ icon, title, body }: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }) {
  const th = useTh();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  return (
    <Panel style={{ paddingVertical: 34, paddingHorizontal: 22, alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={20} color={dim} />
      <Text style={th === "magazine" ? [serif(), { fontSize: 28, lineHeight: 30, color: ink, textAlign: "center" }] : [sans(400), { fontSize: 22, lineHeight: 26, letterSpacing: -0.6, color: ink, textAlign: "center" }]}>
        {title}
      </Text>
      <Text style={th === "magazine" ? [serif(true), { fontSize: 16, lineHeight: 22, color: dim, textAlign: "center", maxWidth: 460 }] : [sans(400), { fontSize: 13, lineHeight: 19, color: dim, textAlign: "center", maxWidth: 460 }]}>
        {body}
      </Text>
    </Panel>
  );
}

export function ContributionGrid({
  items,
  wide,
  canDelete,
  onDelete,
  onOpen,
}: {
  items: ContributionWithAuthor[];
  wide: boolean;
  canDelete: (c: ContributionWithAuthor) => boolean;
  onDelete: (c: ContributionWithAuthor) => void;
  onOpen: (c: ContributionWithAuthor) => void;
}) {
  const [w, setW] = useState(0);
  const cols = wide ? 4 : 2;
  const gap = SEAM;
  const size = w ? (w - gap * (cols - 1)) / cols : 0;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {size
        ? items.map((c) => (
            <ContributionTile key={c.id} c={c} size={size} canDelete={canDelete(c)} onDelete={() => onDelete(c)} onOpen={() => onOpen(c)} />
          ))
        : null}
    </View>
  );
}

function ContributionTile({
  c,
  size,
  canDelete,
  onDelete,
  onOpen,
}: {
  c: ContributionWithAuthor;
  size: number;
  canDelete: boolean;
  onDelete: () => void;
  onOpen: () => void;
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const ink = color("ink");
  const author = c.author?.display_name ?? c.author?.username ?? "Onbekend";
  const frame: ViewStyle =
    th === "magazine"
      ? { backgroundColor: color("paper2") }
      : { borderRadius: 14, overflow: "hidden", backgroundColor: color("tile", "tileFill") };
  const badge: ViewStyle = {
    position: "absolute",
    top: 8,
    backgroundColor: th === "modern" ? "rgba(11,10,12,.55)" : "rgba(11,10,12,.7)",
    borderRadius: th === "modern" ? 999 : 0,
    alignItems: "center",
    justifyContent: "center",
  };
  const media = (
    <View style={{ width: "100%", aspectRatio: 1, backgroundColor: color("ink", "postRule"), overflow: "hidden" }}>
      {c.media_type === "video" && c.image_url ? (
        <>
          <VideoTile uri={c.image_url} />
          <View pointerEvents="none" style={[badge, { left: 8, paddingHorizontal: 7, paddingVertical: 3 }]}>
            <Ionicons name="videocam" color={ON_DARK} size={11} />
          </View>
        </>
      ) : c.image_url ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={c.caption ?? "Foto"}
          onPress={onOpen}
          style={[{ width: "100%", height: "100%" }, Platform.OS === "web" ? ({ cursor: "zoom-in" } as object) : null]}
        >
          <Image source={{ uri: c.image_url }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
        </Pressable>
      ) : (
        <View style={{ flex: 1, padding: 14, justifyContent: "center", backgroundColor: "transparent" }}>
          <Text numberOfLines={5} style={th === "magazine" ? [serif(true), { fontSize: 17, lineHeight: 22, color: ink }] : [sans(400), { fontSize: 14, lineHeight: 19, color: ink }]}>
            {c.caption ?? c.link_url ?? ""}
          </Text>
        </View>
      )}
      {canDelete ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Bijdrage verwijderen" onPress={onDelete} hitSlop={8} style={[badge, { right: 8, width: 28, height: 28 }]}>
          <Ionicons name="trash-outline" color={ON_DARK} size={14} />
        </Pressable>
      ) : null}
    </View>
  );
  return (
    <View style={[{ width: size }, frame]}>
      {media}
      <View
        style={{
          paddingVertical: 8,
          paddingHorizontal: 10,
        }}
      >
        <Text numberOfLines={1} style={th === "magazine" ? [serif(true), { fontSize: 14, lineHeight: 18, color: color("ink", "inkDim") }] : meta(9, color("ink", "inkDim"), 0.9)}>
          {author}
        </Text>
      </View>
    </View>
  );
}

/** Een video op een tegel: stil, met de systeembediening om hem te starten. */
function VideoTile({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
  });
  return <VideoView player={player} style={{ width: "100%", height: "100%" }} contentFit="cover" nativeControls />;
}

// ---------------------------------------------------------------
// MENU: bijdrage toevoegen, de gastenlijst
// ---------------------------------------------------------------

export type EventMenuItem = {
  label: string;
  /** Een tweede regel: "gastheer", "@noor". */
  sub?: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  /** De kleur van het vlak in magazine: van de persoon, of anders per regel een andere. */
  hue?: Hue;
};

/**
 * Een keuzelijst in het midden van het scherm, in de vorm van het thema.
 * Hier stond `ActionSheet` — het blad van vóór de drie thema's, met zijn
 * eigen letter en lijnen, midden op een pagina die verder wél het thema
 * droeg.
 *
 *   magazine  zoals de voorpagina op de telefoon: elke keuze een eigen
 *             kleurvlak met een naad van 6, een verticale rail met het
 *             nummer, de keuze groot in serif en het icoon in een rondje.
 *   modern    een tegel van 18; de regels als eigen tegels met het icoon
 *             in een rondje.
 */
export function EventMenu({
  visible,
  onClose,
  title,
  subtitle,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: EventMenuItem[];
}) {
  const spec = useThemeSpec();
  const th = spec.id;
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const pick = (item: EventMenuItem) => {
    onClose();
    // Kleine vertraging zodat dit venster weg is voor er een volgend opent
    // (de camera, de bibliotheek, een profiel).
    setTimeout(item.onPress, 60);
  };
  if (th === "magazine") return <MenuMagazine visible={visible} onClose={onClose} title={title} subtitle={subtitle} items={items} pick={pick} />;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "center", padding: 18 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
          onPress={onClose}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(11,10,12,0.55)" }}
        />
        <View
          style={{
            width: "100%",
            maxWidth: 520,
            maxHeight: "86%",
            alignSelf: "center",
            backgroundColor: color("paper"),
            borderRadius: RASTER.tileRadius,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              paddingHorizontal: 22,
              paddingTop: 20,
              paddingBottom: 8,
            }}
          >
            <Text style={[{ ...sans(400), fontSize: 24, lineHeight: 28, letterSpacing: -0.7, color: ink }, { flex: 1 }]}>{title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sluiten"
              onPress={onClose}
              hitSlop={8}
              style={{
                width: 32,
                height: 32,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 16,
                borderWidth: 1,
                borderColor: color("ink", "postRule"),
              }}
            >
              <Ionicons name="close" color={ink} size={18} />
            </Pressable>
          </View>

          {subtitle ? (
            <Text
              style={[
                { ...sans(400), fontSize: 13.5, lineHeight: 19 },
                {
                  color: dim,
                  paddingHorizontal: 22,
                  paddingTop: 0,
                  paddingBottom: 14,
                },
              ]}
            >
              {subtitle}
            </Text>
          ) : null}

          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: SEAM, gap: SEAM }}>
            {items.map((item, i) => (
              <Pressable
                key={`${item.label}-${i}`}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                onPress={() => pick(item)}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                  minHeight: 56,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 14,
                  backgroundColor: pressed ? color("ink", "postRule") : color("tile", "tileFill"),
                })}
              >
                <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: color("ink", "postRule"), alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={item.icon} size={16} color={ink} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={1} style={{ ...sans(400), fontSize: 16, lineHeight: 20, letterSpacing: -0.3, color: ink }}>
                    {item.label}
                  </Text>
                  {item.sub ? (
                    <Text numberOfLines={1} style={meta(9, dim, 0.9)}>
                      {item.sub}
                    </Text>
                  ) : null}
                </View>
                <Text style={[meta(12, dim, 0), { textTransform: "none" }]}>→</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/** De kleuren van de keuzes, om beurten — dezelfde vier als de vrienden. */
const MENU_HUES: Hue[] = ["orange", "blue", "ochre", "green", "red"];

/**
 * Magazine: de keuzes als kleurvlakken, zoals de spreads op de voorpagina.
 * De rail wisselt van kant en elk vlak heeft zijn eigen kleur; de kop
 * staat groot in serif op het papier erboven.
 */
function MenuMagazine({
  visible,
  onClose,
  title,
  subtitle,
  items,
  pick,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  items: EventMenuItem[];
  pick: (item: EventMenuItem) => void;
}) {
  const scheme = useScheme();
  const ink = color("ink");
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "center", padding: 18 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
          onPress={onClose}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(11,10,12,0.55)" }}
        />
        <View style={{ width: "100%", maxWidth: 520, maxHeight: "88%", alignSelf: "center", backgroundColor: color("paper") }}>
          <View style={{ paddingTop: 22, paddingHorizontal: 22, paddingBottom: 18, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={kicker(9, color("ink", "inkDim"))}>{`${items.length} ${items.length === 1 ? "keuze" : "keuzes"}`}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Sluiten" onPress={onClose} hitSlop={10}>
                <Text style={[kicker(9.5, ink), { textDecorationLine: "underline" }]}>Sluit</Text>
              </Pressable>
            </View>
            <Text style={[serif(), { fontSize: 46, lineHeight: 42, letterSpacing: -1.4, color: ink }]}>{title}</Text>
            {subtitle ? <Text style={[serif(true), { fontSize: 18, lineHeight: 23, color: color("ink", "inkDim") }]}>{subtitle}</Text> : null}
          </View>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ padding: SEAM, paddingTop: 0, gap: SEAM }}>
            {items.map((item, i) => {
              const fc = friendColor(item.hue ?? MENU_HUES[i % MENU_HUES.length], scheme);
              const tall = items.length <= 4;
              return (
                <Spread
                  key={`${item.label}-${i}`}
                  index={i}
                  page="notes"
                  height={tall ? 112 : 84}
                  fill={fc.fill}
                  ink={fc.ink}
                  rail={`№ ${String(i + 1).padStart(2, "0")}`}
                  onPress={() => pick(item)}
                  accessibilityLabel={item.label}
                >
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 14 }}>
                    <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                      {item.sub ? <Text style={kicker(8.5, fc.ink)}>{item.sub}</Text> : null}
                      <Text numberOfLines={2} style={[serif(), { fontSize: tall ? 30 : 25, lineHeight: tall ? 30 : 25, letterSpacing: -0.6, color: fc.ink }]}>
                        {item.label}
                      </Text>
                    </View>
                    <View style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: fc.ink, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={item.icon} size={18} color={fc.ink} />
                    </View>
                  </View>
                </Spread>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
