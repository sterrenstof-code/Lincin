import { Toggle } from "./Controls";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState, type ReactNode } from "react";
import { Platform, Pressable, Text, View, type ViewStyle } from "react-native";

import { describe } from "@/app/(app)/notifications";
import { useLincinTheme } from "@/components/lincin/ThemeProvider";
import { acceptFriendRequest, type FriendshipWithProfile } from "@/lib/api/friends";
import type { NotificationWithDetails } from "@/lib/api/notifications";
import { color, friendColor, hueFor, setPreference, usePreference, useScheme, type LincinTheme, type ThemePreference } from "@/lib/design/theme";
import { sans } from "@/lib/design/type";
import { setLang, useLang, useT, type Lang } from "@/lib/i18n";
import { setPref, usePrefs } from "@/lib/lincin/prefs";
import { displayName, shortAgo } from "@/lib/lincin/model";
import { useToast } from "@/lib/toast";

import { Black, Label, LabelLink, RedDot, SEAM, Ser } from "../magazine/Omslag";

/**
 * Jij op desktop, Magazine (desktop-magazine-pages.dc.html, page='jij'):
 * "Jouw account". Een band met de titel en drie feiten, daaronder drie
 * kolommen op het tweede papier — Meldingen, Lincs en Instellingen inline.
 *
 * Losgetrokken uit DesktopYou zodat die alleen nog de data en de modern-tak
 * draagt; hier staat enkel hoe de omslag het tekent. De onderdelen weten
 * zelf wat ze doen (toelaten, schakelen), want dat hoort bij de rij, niet
 * bij de pagina.
 */

const pointer = Platform.OS === "web" ? ({ cursor: "pointer" } as ViewStyle) : null;

/** Licht → donker → toestel → licht: dezelfde volgorde als in Instellingen. */
const STAND_NEXT: Record<ThemePreference, ThemePreference> = { system: "light", light: "dark", dark: "system" };

// ---------------------------------------------------------------
// De band
// ---------------------------------------------------------------

export function AccountBand({ spine, stats }: { spine: string; stats: { k: string; v: string }[] }) {
  const t = useT();
  const dim = color("ink", "inkDim");
  return (
    <View
      style={{
        marginHorizontal: SEAM,
        paddingTop: 22,
        paddingRight: 26,
        paddingBottom: 18,
        paddingLeft: 21,
        borderLeftWidth: 5,
        borderLeftColor: spine,
        borderBottomWidth: 2,
        borderBottomColor: color("ink"),
        flexDirection: "row",
        alignItems: "flex-end",
        gap: 32,
      }}
    >
      <View style={{ gap: 8 }}>
        <Label size={10} color={dim}>
          {t.yourAccount}
        </Label>
        {/* De omslag: de titel rood in Archivo 900 van 64, strak op .8. */}
        <Black size={64} f={0.8} nowrap>
          {t.accountTitle}
        </Black>
      </View>
      <View style={{ flex: 1 }} />
      {stats.map((s) => (
        <View key={s.k} style={{ gap: 6, paddingBottom: 4 }}>
          <Label size={10} color={dim}>
            {s.k}
          </Label>
          <Ser size={30} f={1}>
            {s.v}
          </Ser>
        </View>
      ))}
    </View>
  );
}

/** De subregel: Archivo 12, gedimd. */
function Sub({ children, numberOfLines }: { children: ReactNode; numberOfLines?: number }) {
  return (
    <Text numberOfLines={numberOfLines} style={[sans(), { fontSize: 12, lineHeight: 16, color: color("ink", "inkDim") }]}>
      {children}
    </Text>
  );
}

// ---------------------------------------------------------------
// Kolom
// ---------------------------------------------------------------

function Column({ title, action, children, flush = false }: { title: string; action?: ReactNode; children: ReactNode; flush?: boolean }) {
  // `flush`: Instellingen tekent zijn rijen tot aan de rand (lijn over de
  // volle kolombreedte), de andere twee houden de 28 binnenmarge.
  return (
    <View style={[{ flex: 1, minWidth: 0, minHeight: 560, backgroundColor: color("paper2") }, flush ? null : { paddingTop: 22, paddingHorizontal: 28, paddingBottom: 20, gap: 12 }]}>
      <View style={[{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }, flush ? { paddingTop: 22, paddingHorizontal: 28, paddingBottom: 14 } : null]}>
        <Black size={34} f={0.85} numberOfLines={1} style={{ flexShrink: 1 }}>
          {title}
        </Black>
        {action}
      </View>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------
// Meldingen
// ---------------------------------------------------------------

export function NotesColumn({
  list,
  loading,
  onOpen,
  onReadAll,
}: {
  list: NotificationWithDetails[];
  loading: boolean;
  onOpen: (n: NotificationWithDetails) => void;
  onReadAll: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const unread = list.some((n) => !n.read);
  return (
    <Column
      title={t.notifications}
      action={
        unread ? (
          <LabelLink size={10} onPress={onReadAll}>
            {t.markAllRead}
          </LabelLink>
        ) : null
      }
    >
      {list.length === 0 ? (
        <Ser size={20} f={1.1} color={dim} style={{ paddingTop: 12, borderTopWidth: 1, borderTopColor: rule }}>
          {loading ? t.loading : t.noNotes}
        </Ser>
      ) : (
        // De kolom houdt de maat van de andere twee: de nieuwste acht. Wie
        // meer wil, vindt ze op /notifications via de bel in de balk.
        list.slice(0, 8).map((n) => {
          const by = n.type === "bug_resolved" ? "" : n.actor?.display_name ?? n.actor?.username ?? "Iemand";
          const fc = friendColor(hueFor(n.actor_id), scheme);
          return (
            <Pressable
              key={n.id}
              accessibilityRole="link"
              onPress={() => onOpen(n)}
              style={[{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: rule }, pointer]}
            >
              {/* De rug in de kleur van wie het deed. */}
              <View style={{ width: 6, alignSelf: "stretch", backgroundColor: fc.fill }} />
              <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                <Label size={10} color={n.read ? dim : color("red")}>
                  {by ? `${by} · ` : ""}
                  {shortAgo(n.created_at, t, lang)}
                </Label>
                <Ser size={20} f={1.1}>
                  {describe(n).text}
                </Ser>
              </View>
              {!n.read ? <RedDot /> : null}
            </Pressable>
          );
        })
      )}
    </Column>
  );
}

// ---------------------------------------------------------------
// Lincs
// ---------------------------------------------------------------

export function LincsColumn({ myUserId, friendships }: { myUserId: string; friendships: FriendshipWithProfile[] }) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");

  // Wie je in déze sessie toeliet blijft in de uitnodigingen staan met
  // "Linc ✓", zoals in het prototype: anders verdwijnt de rij onder je
  // vinger zodra de lijst ververst en zie je niet wat er gebeurde.
  const [letIn, setLetIn] = useState<Record<string, FriendshipWithProfile>>({});

  const pending = friendships.filter((f) => f.status === "pending" && f.addressee_id === myUserId && !letIn[f.id]);
  const invites = [...Object.values(letIn), ...pending];
  const lincs = friendships
    .filter((f) => f.status === "accepted" && !letIn[f.id])
    .sort((a, b) => (a.accepted_at ?? a.created_at).localeCompare(b.accepted_at ?? b.created_at));

  async function accept(f: FriendshipWithProfile) {
    // Optimistisch: meteen "Linc ✓"; mislukt het, dan terug naar "Toelaten".
    setLetIn((m) => ({ ...m, [f.id]: { ...f, status: "accepted", accepted_at: new Date().toISOString() } }));
    try {
      await acceptFriendRequest(f.id, myUserId, f.requester_id);
      qc.invalidateQueries({ queryKey: ["friendships", myUserId] });
    } catch {
      setLetIn((m) => {
        const next = { ...m };
        delete next[f.id];
        return next;
      });
      toast.error("Het verzoek kon niet aanvaard worden.", { action: { label: "Opnieuw", onPress: () => accept(f) } });
    }
  }

  const initial = (f: FriendshipWithProfile) => displayName(f.other).slice(0, 1).toUpperCase();
  const openProfile = (f: FriendshipWithProfile) => router.push(`/user/${f.other.username}` as never);

  return (
    <Column
      title="Lincs"
      action={
        <LabelLink size={10} onPress={() => router.push("/friends")}>
          {t.inviteMore}
        </LabelLink>
      }
    >
      {invites.length ? (
        <>
          <Label size={10} color={color("red")} style={{ paddingTop: 6 }}>
            {t.invitationsLabel} · {pending.length}
          </Label>
          {invites.map((f) => {
            const ok = !!letIn[f.id];
            return (
              <View key={f.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderTopWidth: 1, borderTopColor: rule }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: ink, alignItems: "center", justifyContent: "center" }}>
                  <Ser size={18} f={1}>
                    {initial(f)}
                  </Ser>
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                  <Ser size={20} f={1} numberOfLines={1}>
                    {displayName(f.other)}
                  </Ser>
                  <Sub numberOfLines={1}>
                    {t.asksToLinc} · {shortAgo(f.created_at, t, lang)}
                  </Sub>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: ok }}
                  disabled={ok}
                  onPress={() => accept(f)}
                  style={[{ height: 32, paddingHorizontal: 12, borderWidth: 1, borderColor: ink, justifyContent: "center", backgroundColor: ok ? ink : "transparent" }, ok ? null : pointer]}
                >
                  <Label size={9} ls={0.12} color={ok ? color("paper") : ink}>
                    {ok ? t.lincDone : t.letIn}
                  </Label>
                </Pressable>
              </View>
            );
          })}
        </>
      ) : null}
      <Label size={10} color={dim} style={{ paddingTop: invites.length ? 10 : 6 }}>
        {t.yourLincs} · {lincs.length + Object.keys(letIn).length}
      </Label>
      {lincs.length === 0 ? (
        <Ser size={20} f={1.1} color={dim} style={{ paddingTop: 11, borderTopWidth: 1, borderTopColor: rule }}>
          {t.noFriendsYet}
        </Ser>
      ) : (
        lincs.map((f) => {
          const fc = friendColor(hueFor(f.other.id), scheme);
          return (
            <Pressable
              key={f.id}
              accessibilityRole="link"
              onPress={() => openProfile(f)}
              style={[{ flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: rule }, pointer]}
            >
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: fc.fill, alignItems: "center", justifyContent: "center" }}>
                <Ser size={18} f={1} color={fc.ink}>
                  {initial(f)}
                </Ser>
              </View>
              <Ser size={20} f={1} numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
                {displayName(f.other)}
              </Ser>
              {/* Sinds wanneer: het jaar waarin jullie lincs werden. */}
              <Label size={10} color={dim}>
                {new Date(f.accepted_at ?? f.created_at).getFullYear()}
              </Label>
            </Pressable>
          );
        })
      )}
    </Column>
  );
}

// ---------------------------------------------------------------
// Instellingen inline
// ---------------------------------------------------------------

/**
 * De schakelaar: dezelfde als in Instellingen (Controls `Toggle`) — in
 * magazine een lijn van 2 met een knop van 12. Een eigen variant hier gaf
 * twee verschillende schakelaars voor dezelfde voorkeur.
 */
const SmallToggle = Toggle;

/** De keuzerij: losse vierkante vakken van 32 hoog, inkt als gekozen. */
function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  const ink = color("ink");
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[{ flex: 1, height: 32, borderWidth: 1, borderColor: ink, alignItems: "center", justifyContent: "center", backgroundColor: on ? ink : "transparent" }, pointer]}
          >
            <Label size={9} color={on ? color("paper") : ink}>
              {o.label}
            </Label>
          </Pressable>
        );
      })}
    </View>
  );
}

function SetRow({ label, sub, right, below, onPress }: { label: string; sub?: string; right?: ReactNode; below?: ReactNode; onPress?: () => void }) {
  const body = (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Ser size={20} f={1.05}>
            {label}
          </Ser>
          {sub ? <Sub>{sub}</Sub> : null}
        </View>
        {right}
      </View>
      {below}
    </>
  );
  const style = { paddingVertical: 12, paddingHorizontal: 28, gap: 10, borderTopWidth: 1, borderTopColor: color("ink", "postRule") };
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={[style, pointer]}>
      {body}
    </Pressable>
  ) : (
    <View style={style}>{body}</View>
  );
}

export function SettingsColumn({ myUserId }: { myUserId: string }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const scheme = useScheme();
  const pref = usePreference();
  const prefs = usePrefs(myUserId);
  const lincin = useLincinTheme();
  const dim = color("ink", "inkDim");
  const standLabel = pref === "system" ? t.device : scheme === "dark" ? t.dark : t.light;

  const group = (num: string, title: string) => (
    <Label size={10} color={dim} style={{ paddingTop: 16, paddingHorizontal: 28, paddingBottom: 6 }}>
      {num} · {title}
    </Label>
  );

  // Alleen de hoofdschakelaars; de rest (meldingen, stille uren, wie ziet
  // mij, lijsten, uitloggen) staat op /settings achter "Alles →".
  return (
    <Column
      flush
      title={t.settings}
      action={
        <LabelLink size={10} onPress={() => router.push("/settings")}>
          {t.seeAll} →
        </LabelLink>
      }
    >
      {group("01", t.lookTitle)}
      <SetRow
        label={t.theme}
        sub={t.themeSub}
        below={
          <Seg
            value={lincin.theme}
            onChange={(v: LincinTheme) => lincin.choose(v)}
            options={[
              { value: "magazine", label: t.themeMagazine },
              { value: "modern", label: t.themeModern },
            ]}
          />
        }
      />
      <SetRow label={t.language} below={<Seg value={lang} onChange={(v: Lang) => setLang(v)} options={(["nl", "en", "de"] as Lang[]).map((l) => ({ value: l, label: l.toUpperCase() }))} />} />
      <SetRow
        label={t.lightDark}
        sub={t.followsDevice}
        onPress={() => setPreference(STAND_NEXT[pref])}
        right={
          <Ser size={17} italic f={1.2}>
            {standLabel} →
          </Ser>
        }
      />
      {group("02", t.tabFeed)}
      <SetRow
        label={t.openDef}
        sub={t.openDefSub}
        right={<SmallToggle on={prefs.openDefault} onPress={() => setPref(myUserId, "openDefault", !prefs.openDefault)} label={t.openDef} />}
      />
    </Column>
  );
}
