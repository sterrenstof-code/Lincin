import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";

import { LincinScreen, TopRow } from "@/components/lincin/Chrome";
import { ComposeBar, ReactBox } from "@/components/lincin/ComposeBar";
import { Media } from "@/components/lincin/Media";
import { PrivateSheet, type PrivateTarget } from "@/components/lincin/PrivateSheet";
import { BackChip, BORDER, Body, Box, GAP, GUTTER, Head, Initial, Mono, Serif, VerticalLabel } from "@/components/lincin/ui";
import { SafeImage } from "@/components/SafeImage";
import {
  addEntityComment,
  listEntityComments,
  subscribeToEntityComments,
  type EntityComment,
} from "@/lib/api/entity-comments";
import { deletePost, getPost, type PostWithAuthor } from "@/lib/api/posts";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import { color, friendColor, hueFor, useScheme } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { useLang, useT } from "@/lib/i18n";
import { displayName, fromPost, hhmm, timeLabel } from "@/lib/lincin/model";
import { usePostReactions } from "@/lib/lincin/reactions";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";
import { invalidatePostCaches } from "@/lib/post-cache";
import { markSeen } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

/**
 * De bladzijde van een bijdrage (README §02).
 *
 * `← Terug` en een label bovenaan; dan de kaart: het beeld op 300 met een
 * kleurstrook links, de titel groot, het bijschrift in serif, de tekst,
 * en wie het maakte. Daaronder de reacties, een `◷ EVENT` als er iets te
 * plannen valt, `PRIVAAT BERICHT`, en de comments. Onderaan de balk met
 * `☺` (het reactievak), invoer en `↑`.
 */

const MEDIA_H = 300;
const STRIP_W = 34;

export default function PostScreen() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = String(raw ?? "");
  const router = useRouter();
  const qc = useQueryClient();
  const t = useT();
  const scheme = useScheme();
  const toast = useToast();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";

  const post = useQuery({
    queryKey: ["post", id],
    queryFn: () => getPost(id),
    enabled: !!id,
    initialData: () => {
      const feed = qc.getQueryData<{ type: string; data: PostWithAuthor }[]>(["unified-feed", myUserId]);
      return feed?.find((i) => i.type === "post" && i.data.id === id)?.data;
    },
  });
  const comments = useQuery({
    queryKey: ["entity-comments", "post", id],
    queryFn: () => listEntityComments("post", id),
    enabled: !!id,
  });
  useEffect(() => {
    if (!id) return;
    markSeen(id);
    const ch = subscribeToEntityComments("post", id, () => comments.refetch());
    return () => {
      ch.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const p = post.data ?? null;
  const card = useMemo(() => (p ? fromPost(p) : null), [p]);
  usePageTitle(card?.title ?? null);
  const hue = hueFor(p?.user_id);
  const fc = friendColor(hue, scheme);
  const reactions = usePostReactions(useMemo(() => (id ? [id] : []), [id]), myUserId);
  const grouped = reactions.grouped(id);
  const mine = useMemo(() => new Set(grouped.filter((g) => g.mine).map((g) => g.emoji)), [grouped]);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const [sheet, setSheet] = useState<PrivateTarget | null>(null);

  async function send(imageUri?: string) {
    if (!p || !myUserId) return;
    const body = draft.trim();
    if (!body && !imageUri) return;
    setSending(true);
    try {
      await addEntityComment({ entityType: "post", entityId: id, userId: myUserId, body, ownerId: p.user_id, imageUri });
      setDraft("");
      setBoxOpen(false);
      await comments.refetch();
      invalidatePostCaches(qc);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    } finally {
      setSending(false);
    }
  }

  async function remove() {
    if (!p) return;
    const ok = await confirm("Bijdrage verwijderen?", "Je vrienden zien hem dan niet meer.", {
      affirmativeLabel: "Verwijder",
      destructive: true,
    });
    if (!ok) return;
    try {
      await deletePost(p);
      invalidatePostCaches(qc);
      safeBack(router, "/feed");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t.failed);
    }
  }

  const canEvent = !!p && (/\?/.test(p.caption ?? "") || card?.media.kind === "plek");
  const own = !!p && p.user_id === myUserId;
  const authorName = p ? displayName(p.author) : "";

  return (
    <LincinScreen
      tab="feed"
      tint={p ? fc.fill : null}
      header={
        <TopRow
          left={<BackChip label={`← ${t.back}`} onPress={() => safeBack(router, "/feed")} />}
          right={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Mono variant="micro" tone="dim">
                {t.post}
                {card ? ` · ${card.kind}` : ""}
              </Mono>
              {own ? (
                <Pressable accessibilityRole="button" onPress={remove} hitSlop={6}>
                  <Mono variant="micro" tone="red">
                    Verwijder
                  </Mono>
                </Pressable>
              ) : null}
            </View>
          }
        />
      }
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: GUTTER, paddingTop: 14, gap: GAP }}>
          {post.isLoading && !p ? (
            <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 40 }}>
              {t.loading}
            </Mono>
          ) : !p || !card ? (
            <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 40 }}>
              {t.failed}
            </Mono>
          ) : (
            <>
              <Box>
                {/* beeld met kleurstrook */}
                <View style={{ flexDirection: "row", height: MEDIA_H }}>
                  <View
                    style={{
                      width: STRIP_W,
                      backgroundColor: fc.fill,
                      borderRightWidth: BORDER,
                      borderRightColor: color("ink"),
                      overflow: "hidden",
                    }}
                  >
                    <VerticalLabel
                      text={`${card.kind} · ${hhmm(p.created_at)}`}
                      width={STRIP_W}
                      height={MEDIA_H}
                      color={fc.ink}
                      style={{ letterSpacing: 0.8, textTransform: "uppercase" }}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Media media={card.media} height={MEDIA_H} hue={hue} postId={p.id} myUserId={myUserId} />
                  </View>
                </View>
                {/* tekst */}
                <View style={{ padding: 14, gap: 10, borderTopWidth: BORDER, borderTopColor: color("ink") }}>
                  <Head variant="postTitle">{card.title}</Head>
                  {card.caption ? <Serif variant="quoteLarge">{card.caption}</Serif> : null}
                  {p.body_text && card.media.kind !== "tekst" && p.body_text.trim() !== (p.caption ?? "").trim() ? (
                    <Body small tone="dim">
                      {p.body_text}
                    </Body>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${authorName}, ${t.viewProfile}`}
                    onPress={() => p.author?.username && router.push(`/user/${p.author.username}` as never)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}
                  >
                    <Initial letter={authorName.slice(0, 1).toUpperCase()} size={28} bg={fc.fill} fg={fc.ink} border={false} fontSize={12} />
                    <Text style={[lincinType.meta, { textTransform: "none", textDecorationLine: "underline", color: color("ink") }]}>
                      {authorName}
                    </Text>
                    <Mono variant="meta" tone="dim" style={{ textTransform: "none" }}>
                      · {t.viewProfile}
                    </Mono>
                  </Pressable>
                </View>
                {/* actierij */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    borderTopWidth: BORDER,
                    borderTopColor: color("ink"),
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    gap: 4,
                    flexWrap: "wrap",
                  }}
                >
                  {grouped.map((g) => (
                    <Pressable
                      key={g.emoji}
                      accessibilityRole="button"
                      accessibilityLabel={`${g.emoji} ${g.count}`}
                      accessibilityState={{ selected: g.mine }}
                      onPress={() => reactions.toggle(id, g.emoji)}
                      style={{
                        height: 34,
                        paddingHorizontal: 8,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        backgroundColor: g.mine ? color("ink") : "transparent",
                      }}
                    >
                      <Text style={{ fontSize: 15, lineHeight: 18, color: g.mine ? color("paper") : color("ink") }}>{g.emoji}</Text>
                      <Text style={[lincinType.action, { letterSpacing: 0, color: g.mine ? color("paper") : color("ink") }]}>{g.count}</Text>
                    </Pressable>
                  ))}
                  <View style={{ flex: 1 }} />
                  {canEvent ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => router.push("/event-create")}
                      style={{
                        height: 30,
                        paddingHorizontal: 8,
                        borderWidth: BORDER,
                        borderStyle: "dashed",
                        borderColor: color("ink"),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Mono variant="action">◷ {t.event}</Mono>
                    </Pressable>
                  ) : null}
                  {!own ? (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() =>
                        setSheet({
                          friendId: p.user_id,
                          friendName: authorName,
                          quote: card.caption || card.title,
                          postId: p.id,
                          postTitle: card.title,
                        })
                      }
                      style={{ height: 34, paddingHorizontal: 10, backgroundColor: color("ink"), alignItems: "center", justifyContent: "center" }}
                    >
                      <Mono variant="action" tone="paper">
                        {t.privateMsg}
                      </Mono>
                    </Pressable>
                  ) : null}
                </View>
              </Box>

              {/* comments */}
              <Mono variant="micro" tone="dim" style={{ marginTop: 6 }}>
                {t.comments} · {comments.data?.length ?? p.comment_count ?? 0}
              </Mono>
              {(comments.data ?? []).map((c) => (
                <CommentRow key={c.id} comment={c} myUserId={myUserId} />
              ))}
            </>
          )}
        </ScrollView>

        <ComposeBar
          value={draft}
          onChange={setDraft}
          onSend={() => send()}
          placeholder={t.writeComment}
          boxOpen={boxOpen}
          onToggleBox={() => setBoxOpen((v) => !v)}
          sending={sending}
          above={
            boxOpen ? (
              <ReactBox
                onClose={() => setBoxOpen(false)}
                onEmoji={(e) => reactions.toggle(id, e)}
                onImage={(uri) => send(uri)}
                active={mine}
              />
            ) : null
          }
        />
      </KeyboardAvoidingView>
      <PrivateSheet target={sheet} onClose={() => setSheet(null)} />
    </LincinScreen>
  );
}

function CommentRow({ comment: c, myUserId }: { comment: EntityComment; myUserId: string }) {
  const t = useT();
  const lang = useLang();
  const scheme = useScheme();
  const own = c.user_id === myUserId;
  const fc = own ? { fill: color("ink"), ink: color("paper") } : friendColor(hueFor(c.user_id), scheme);
  const name = own ? t.me : displayName(c.author);
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <Initial letter={name.slice(0, 1).toUpperCase()} size={26} bg={fc.fill} fg={fc.ink} border={false} fontSize={11} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
          <Mono variant="monoBody">{name}</Mono>
          <Mono variant="micro" tone="dim" style={{ textTransform: "none" }}>
            {timeLabel(c.created_at, t, lang)}
          </Mono>
        </View>
        {c.image_url ? (
          <View style={{ width: 160, height: 110, borderWidth: BORDER, borderColor: color("ink"), backgroundColor: color("paper2") }}>
            <SafeImage uri={c.image_url} cacheKey={c.image_path ?? undefined} style={{ width: "100%", height: "100%" }} contentFit="cover" />
            <View style={{ position: "absolute", left: 6, bottom: 6, backgroundColor: color("ink"), paddingHorizontal: 5, paddingVertical: 2 }}>
              <Mono variant="tiny" tone="paper">
                {t.gifNote}
              </Mono>
            </View>
          </View>
        ) : null}
        {c.body ? (
          <Body small style={{ fontSize: 14, lineHeight: 19 }}>
            {c.body}
          </Body>
        ) : null}
      </View>
    </View>
  );
}
