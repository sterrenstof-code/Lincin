import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View, type TextInput } from "react-native";

import { LincinScreen, TopRow, vfade } from "@/components/lincin/Chrome";
import { ComposeBar, ReactBox, ReplyStrip } from "@/components/lincin/ComposeBar";
import { CommentList, CommentsHead } from "@/components/lincin/post/Comments";
import { PollBlock } from "@/components/lincin/post/Poll";
import { Mono } from "@/components/lincin/ui";
import type { EntityComment } from "@/lib/api/entity-comments";
import { deletePoll } from "@/lib/api/polls";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { color, friendColor, hueFor, RASTER, useHueChoices, useScheme, useThemeSpec } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { useComments } from "@/lib/lincin/comments";
import { openProfile } from "@/lib/lincin/desktop";
import { useDraft } from "@/lib/lincin/drafts";
import { displayName, swatchOf, timeLabel } from "@/lib/lincin/model";
import { usePoll } from "@/lib/lincin/poll";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";
import { invalidatePostCaches } from "@/lib/post-cache";
import { markSeen } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

/**
 * De bladzijde van een poll (Poll-spec, okt 2026): dezelfde vorm als een
 * bijdrage. De vraag en de toelichting ("Eén stem per linc. Eigen voorstel
 * mag.") in het vriendenblok, daaronder de keuzes als één gelinieerde
 * lijst (`PollBlock`), en de reacties met draden zoals bij een bijdrage.
 *
 * Wie hem mag zien bepaalt de database (0063): de maker en zijn lincs.
 */
export default function PollScreen() {
  const { id: raw, c: highlight } = useLocalSearchParams<{ id: string; c?: string }>();
  const id = String(raw ?? "");
  const qc = useQueryClient();
  const router = useRouter();
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const toast = useToast();
  const modern = useThemeSpec().id === "modern";
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";

  const pm = usePoll(id || undefined, myUserId);
  const p = pm.poll;
  useEffect(() => {
    if (id) markSeen(id);
  }, [id]);
  usePageTitle(p?.question ?? null);
  useHueChoices();
  // De kleur die de maker koos, anders zijn eigen kleur.
  const hue = (p ? swatchOf(p.swatch, p.user_id) : undefined) ?? hueFor(p?.user_id);
  const fc = friendColor(hue, scheme);

  const m = useComments({ entityType: "poll", entityId: id || undefined, myUserId, ownerId: p?.user_id });
  const [draft, setDraft, clearDraft] = useDraft(id ? `poll:${id}` : null);
  const [replyTo, setReplyTo] = useState<EntityComment | null>(null);
  const [boxOpen, setBoxOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  function send(imageUri?: string) {
    if (!p || !myUserId) return;
    const body = draft.trim();
    if (!body && !imageUri) return;
    m.send({ body, imageUri: imageUri ?? null, parentId: replyTo?.id ?? null });
    clearDraft();
    setBoxOpen(false);
    setReplyTo(null);
    invalidatePostCaches(qc);
  }

  function reply(c: EntityComment) {
    const author = c.user_id === myUserId ? null : m.authorOf(c);
    setReplyTo(c);
    if (c.parent_id && author?.username && !draft.includes(`@${author.username}`)) setDraft((d) => `@${author.username} ${d}`);
    m.setOpen(c.parent_id ?? c.id, true);
    inputRef.current?.focus();
  }

  // Een poll is geen bijdrage en had daarom geen "Verwijder": eenmaal
  // gedeeld bleef hij voor altijd in de feed staan.
  async function remove() {
    if (!p) return;
    const ok = await confirm("Poll verwijderen?", "Je vrienden zien hem dan niet meer, en de stemmen gaan mee.", {
      affirmativeLabel: "Verwijder",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePoll(p.id);
      invalidatePostCaches(qc);
      safeBack(router, "/feed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    }
  }

  const authorName = p ? displayName(p.author) : "";
  const hint = p
    ? [p.allow_multiple ? t.pollMultiVote : t.pollOneVote, p.allow_proposals ? t.pollProposalsOk : null, p.anonymous ? t.pollAnon : null].filter(Boolean).join(" ")
    : "";
  const replyName = replyTo ? (replyTo.user_id === myUserId ? t.me : displayName(m.authorOf(replyTo))) : "";
  const onBlock = modern ? color("ink") : fc.ink;

  return (
    <LincinScreen
      tab="feed"
      tint={p ? fc.fill : null}
      counter={t.post}
      back="/feed"
      header={
        <TopRow
          right={
            p && p.user_id === myUserId ? (
              <Pressable accessibilityRole="button" onPress={remove} hitSlop={8}>
                <Mono variant="micro" tone="red">
                  Verwijder
                </Mono>
              </Pressable>
            ) : (
              <Mono variant="micro" tone="dim">
                poll
              </Mono>
            )
          }
        />
      }
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={[{ flex: 1 }, vfade()]} contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          {pm.isLoading && !p ? (
            <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 40 }}>
              {t.loading}
            </Mono>
          ) : !p ? (
            <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 40 }}>
              {t.failed}
            </Mono>
          ) : (
            <>
              {/* Het vriendenblok: wie en wanneer, de vraag, de toelichting. */}
              <View
                style={{
                  marginHorizontal: 6,
                  padding: 20,
                  gap: 10,
                  backgroundColor: modern ? color("tile", "tileFill") : fc.fill,
                  borderRadius: modern ? RASTER.tileRadius : 0,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                  <Pressable accessibilityRole="link" onPress={() => p.author?.username && openProfile(p.author.username)} hitSlop={8}>
                    <Text style={[sans(700), { fontSize: 9, lineHeight: 12, letterSpacing: 1.8, textTransform: "uppercase", textDecorationLine: "underline", color: onBlock }]}>
                      {authorName} · poll
                    </Text>
                  </Pressable>
                  <Text style={[sans(700), { fontSize: 9, lineHeight: 12, letterSpacing: 1.8, textTransform: "uppercase", color: onBlock }]}>{timeLabel(p.created_at, t, lang)}</Text>
                </View>
                <Text accessibilityRole="header" style={[modern ? sans(400) : serif(), { fontSize: modern ? 30 : 38, lineHeight: modern ? 33 : 40, letterSpacing: modern ? -1.1 : -0.3, color: onBlock }]}>
                  {p.question}
                </Text>
                <Text style={[serif(true), { fontSize: 18, lineHeight: 23, color: modern ? color("ink", "inkDim") : fc.ink }]}>{hint}</Text>
              </View>

              <View style={{ paddingHorizontal: 24, paddingTop: 18 }}>
                <PollBlock m={pm} makerFill={fc.fill} myUserId={myUserId} />
              </View>

              <View style={{ paddingHorizontal: 24, marginTop: 22 }}>
                <CommentsHead m={m} count={m.total} />
                {m.rootCount === 0 && !m.isLoading && m.pendingFor(null).length === 0 ? (
                  <Text style={[serif(true), { paddingVertical: 18, fontSize: 18, lineHeight: 23, color: color("ink", "inkDim") }]}>{t.firstComment}</Text>
                ) : null}
                <CommentList m={m} myUserId={myUserId} onReply={reply} highlightId={typeof highlight === "string" ? highlight : null} />
              </View>
            </>
          )}
        </ScrollView>

        <ComposeBar
          inputRef={inputRef}
          value={draft}
          onChange={setDraft}
          onSend={() => send()}
          placeholder={replyTo ? t.replyPh.replace("{name}", replyName) : t.writeComment}
          boxOpen={boxOpen}
          onToggleBox={() => setBoxOpen((v) => !v)}
          above={
            <>
              {replyTo ? <ReplyStrip label={t.replyTo} name={replyName} onCancel={() => setReplyTo(null)} /> : null}
              {boxOpen ? <ReactBox onClose={() => setBoxOpen(false)} onEmoji={(e) => setDraft((d) => d + e)} onImage={(uri) => send(uri)} active={EMPTY} /> : null}
            </>
          }
        />
      </KeyboardAvoidingView>
    </LincinScreen>
  );
}

const EMPTY = new Set<string>();
