import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, Text, TextInput, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { PollOption } from "@/lib/api/polls";
import { color, useThemeSpec } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { displayName } from "@/lib/lincin/model";
import type { PollModel } from "@/lib/lincin/poll";
import { useToast } from "@/lib/toast";

import { PersonDot, fill } from "./Reactions";

/**
 * De poll op de bijdragepagina (Poll-spec, okt 2026; Magazine).
 *
 *   Vóór je stemt: één gelinieerde lijst in een kader van 1 inkt, rijen van
 *   56, links een rondje — geen cijfers, geen balken.
 *   Ná je stem: elke rij een balk zo breed als zijn percentage — jouw keuze
 *   in de makerkleur op 22%, de rest getint; rechts het percentage; jouw
 *   rondje gevuld met een wit vinkje.
 *   Gesloten (einddatum voorbij): geen rondjes meer, de balken blijven, de
 *   winnaar vet.
 *
 * Meerdere keuzes: vierkantjes, en een percentage per stemmer. Een eigen
 * voorstel (als de maker het toeliet) is de laatste rij, tot zes keuzes.
 * "Wie stemde" opent per keuze wie erop stemde — niet bij een anonieme poll.
 */

const isWeb = Platform.OS === "web";
const pointer = isWeb ? ({ cursor: "pointer" } as ViewStyle) : null;
const MAX_OPTIONS = 6;
const ROW = 56;

/** "#B4623F" → "rgba(180,98,63,.22)": de makerkleur op 22%. */
function alpha(hex: string, a: number): string {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${a})`;
}

export function PollBlock({ m, makerFill, myUserId }: { m: PollModel; makerFill: string; myUserId: string }) {
  const t = useT();
  const toast = useToast();
  const modern = useThemeSpec().id === "modern";
  const [proposing, setProposing] = useState(false);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [who, setWho] = useState(false);
  const poll = m.poll;
  if (!poll) return null;

  const multi = poll.allow_multiple;
  const voted = m.mine.size > 0;
  const showResults = voted || m.closed;
  const denom = multi ? Math.max(1, m.voters) : Math.max(1, m.totalVotes);
  const pct = (o: PollOption) => Math.round(((m.counts.get(o.id) ?? 0) / denom) * 100);
  const top = Math.max(0, ...poll.options.map((o) => m.counts.get(o.id) ?? 0));
  const canPropose = !!poll.allow_proposals && !m.closed && poll.options.length < MAX_OPTIONS;
  const ink = color("ink");
  const hair = color("ink", "postRule");
  const n = m.voters;
  const people = n === 1 ? t.oneVoter : `${n} ${t.votesWord}`;

  async function submit() {
    const text = label.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await m.propose(text);
      setLabel("");
      setProposing(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setBusy(false);
    }
  }

  const voterStack = !poll.anonymous ? poll.options.flatMap((o) => o.voters).filter((p, i, all) => all.findIndex((x) => x.id === p.id) === i).slice(0, 3) : [];

  return (
    <View style={{ gap: 12 }}>
      <View accessibilityRole={multi ? undefined : "radiogroup"} style={{ borderWidth: 1, borderColor: modern ? hair : ink, borderRadius: modern ? 14 : 0, overflow: "hidden" }}>
        {poll.options.map((o, i) => {
          const on = m.mine.has(o.id);
          const p = pct(o);
          const winner = m.closed && top > 0 && (m.counts.get(o.id) ?? 0) === top;
          const proposer = o.created_by ? (o.created_by === myUserId ? t.proposalByYou : `${t.proposalBy} ${displayName(o.proposer)}`) : null;
          const othersVoted = (m.counts.get(o.id) ?? 0) - (on ? 1 : 0) > 0;
          const canRemove = !!o.created_by && (o.created_by === myUserId || poll.user_id === myUserId) && !othersVoted && !m.closed;
          return (
            <Pressable
              key={o.id}
              accessibilityRole={multi ? "checkbox" : "radio"}
              accessibilityState={{ checked: on, disabled: m.closed }}
              accessibilityLabel={`${o.label}${showResults ? `, ${p}%` : ""}`}
              onPress={() => m.vote(o.id)}
              disabled={m.closed}
              style={[{ minHeight: ROW, justifyContent: "center", borderTopWidth: i ? 1 : 0, borderTopColor: hair }, m.closed ? null : pointer]}
            >
              {showResults ? (
                <View style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${p}%`, backgroundColor: on ? alpha(makerFill, 0.22) : color("tint") }} />
              ) : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 10 }}>
                {m.closed ? null : (
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: multi ? 3 : 9,
                      borderWidth: on ? 0 : 1.5,
                      borderColor: ink,
                      backgroundColor: on ? makerFill : "transparent",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {on ? <Text style={[sans(700), { fontSize: 11, lineHeight: 13, color: "#FFFFFF" }]}>✓</Text> : null}
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text style={[winner ? sans(700) : serif(), { fontSize: winner ? 17 : 19, lineHeight: 23, color: ink }]}>{o.label}</Text>
                  {proposer ? (
                    <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
                      <Text style={[sans(500), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", color: color("ink", "inkDim") }]}>{proposer}</Text>
                      {canRemove ? (
                        <Pressable
                          accessibilityRole="button"
                          onPress={async () => {
                            try {
                              if (!(await m.removeOption(o.id))) toast.error(t.failed);
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : t.failed);
                            }
                          }}
                          hitSlop={10}
                          style={pointer}
                        >
                          <Text style={[sans(700), { fontSize: 10, lineHeight: 13, letterSpacing: 1, textTransform: "uppercase", textDecorationLine: "underline", color: color("ink", "inkDim") }]}>
                            {t.removeProposal}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </View>
                {showResults ? <Text style={[sans(700), { fontSize: 13, lineHeight: 16, color: ink }]}>{p}%</Text> : null}
              </View>
            </Pressable>
          );
        })}

        {canPropose ? (
          proposing ? (
            <View style={{ minHeight: ROW, flexDirection: "row", alignItems: "stretch", borderTopWidth: 1, borderTopColor: hair }}>
              <TextInput
                autoFocus
                value={label}
                onChangeText={setLabel}
                onSubmitEditing={submit}
                maxLength={80}
                placeholder={t.proposalPh}
                placeholderTextColor={color("ink", "inkDim")}
                style={[serif(label.length === 0), { flex: 1, minWidth: 0, fontSize: 19, paddingHorizontal: 16, color: ink }, isWeb ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null]}
              />
              <Pressable
                accessibilityRole="button"
                onPress={submit}
                disabled={!label.trim() || busy}
                style={[{ paddingHorizontal: 16, justifyContent: "center", backgroundColor: label.trim() ? color("red") : color("ink", "pillSoft") }, pointer]}
              >
                <Text style={[sans(700), { fontSize: 11, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", color: "#F7F4EE" }]}>{busy ? "…" : t.addAndVote}</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setProposing(true)}
              style={[{ minHeight: ROW, justifyContent: "center", paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: hair }, pointer]}
            >
              <Text style={[serif(true), { fontSize: 19, lineHeight: 23, color: color("ink", "inkDim") }]}>
                + {t.addProposal} · {fill(t.leftN, MAX_OPTIONS - poll.options.length)}
              </Text>
            </Pressable>
          )
        ) : null}
      </View>

      {/* De voetregel onder het kader. */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Text style={[sans(500), { flex: 1, fontSize: 11, lineHeight: 15, letterSpacing: 1.1, textTransform: "uppercase", color: color("ink", "inkDim") }]}>
          {m.closed ? `${t.closedC} · ${people}` : voted ? `${people} · ${t.youVoted} · ${t.tapToChange}` : `${people} · ${t.tapToVote}`}
        </Text>
        {voterStack.length ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t.whoVoted} onPress={() => setWho(true)} hitSlop={8} style={[{ flexDirection: "row", alignItems: "center", gap: 8 }, pointer]}>
            <View style={{ flexDirection: "row" }}>
              {voterStack.map((p, i) => (
                <View key={p.id} style={{ marginLeft: i ? -7 : 0, zIndex: 3 - i }}>
                  <PersonDot id={p.id} name={displayName(p)} url={p.avatar_url} size={22} ring={color("paper")} />
                </View>
              ))}
            </View>
            <Text style={[sans(700), { fontSize: 10, lineHeight: 14, letterSpacing: 1.2, textTransform: "uppercase", textDecorationLine: "underline", color: ink }]}>{t.whoVoted}</Text>
          </Pressable>
        ) : null}
      </View>

      {!poll.anonymous ? <WhoVoted m={m} visible={who} onClose={() => setWho(false)} myUserId={myUserId} /> : null}
    </View>
  );
}

/** "Wie stemde", per keuze gegroepeerd — hetzelfde paneel als bij likes. */
function WhoVoted({ m, visible, onClose, myUserId }: { m: PollModel; visible: boolean; onClose: () => void; myUserId: string }) {
  const t = useT();
  const insets = useSafeAreaInsets();
  const modern = useThemeSpec().id === "modern";
  if (!visible || !m.poll) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable accessibilityLabel={t.closeC} onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(22,22,15,.45)" }} />
      <View
        style={{
          // Op een breed scherm een blad van 520 in het midden, niet de hele breedte.
          width: "100%",
          maxWidth: 520,
          alignSelf: "center",
          maxHeight: "66%",
          backgroundColor: color("paper"),
          borderTopWidth: modern ? 0 : 2,
          borderTopColor: color("ink"),
          borderTopLeftRadius: modern ? 22 : 0,
          borderTopRightRadius: modern ? 22 : 0,
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 12,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14 }}>
          <Text style={[sans(700), { fontSize: 10, lineHeight: 13, letterSpacing: 1.2, textTransform: "uppercase", color: color("ink") }]}>
            {t.whoVoted} · {m.voters}
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t.closeC} onPress={onClose} hitSlop={12}>
            <Text style={{ fontSize: 16, lineHeight: 18, color: color("ink") }}>×</Text>
          </Pressable>
        </View>
        <ScrollView>
          {m.poll.options
            .filter((o) => o.voters.length)
            .map((o) => (
              <View key={o.id} style={{ paddingBottom: 10 }}>
                <Text style={[serif(true), { fontSize: 18, lineHeight: 23, color: color("ink"), paddingVertical: 6 }]}>{o.label}</Text>
                {o.voters.map((p) => (
                  <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color("ink", "postRule") }}>
                    <PersonDot id={p.id} name={displayName(p)} url={p.avatar_url} size={32} />
                    <Text style={[sans(700), { fontSize: 13, lineHeight: 16, color: color("ink") }]}>{p.id === myUserId ? t.me : displayName(p)}</Text>
                  </View>
                ))}
              </View>
            ))}
        </ScrollView>
      </View>
    </Modal>
  );
}
