import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";

import { LincinScreen, TopRow } from "@/components/lincin/Chrome";
import { CommentReactions } from "@/components/lincin/CommentReactions";
import { CommentRow } from "@/components/lincin/CommentRow";
import { ComposeBar, ReactBox } from "@/components/lincin/ComposeBar";
import { PostCard } from "@/components/lincin/PostCard";
import { GAP, GUTTER, Mono } from "@/components/lincin/ui";
import { addEntityComment, listEntityComments, subscribeToEntityComments } from "@/lib/api/entity-comments";
import { getPollWithDetails } from "@/lib/api/polls";
import { useAuth } from "@/lib/auth/provider";
import { friendColor, hueFor, useHueChoices, useScheme } from "@/lib/design/theme";
import { useT } from "@/lib/i18n";
import { openProfile } from "@/lib/lincin/desktop";
import { fromPoll } from "@/lib/lincin/model";
import { useCommentReactions } from "@/lib/lincin/reactions";
import { usePageTitle } from "@/lib/page-title";
import { invalidatePostCaches } from "@/lib/post-cache";
import { markSeen } from "@/lib/read-state";
import { useToast } from "@/lib/toast";

/**
 * De bladzijde van een poll uit de feed.
 *
 * Een poll is geen bijdrage (hij staat in `polls`, niet in `posts`) en had
 * daarom geen eigen plek: een tik op hem in de inhoudsopgave deed niets.
 * Hier: de kaart zelf, waarin je stemt, en de comments eronder
 * (`entity_comments` met type `poll`). Wie hem mag zien bepaalt de
 * database (0063): de maker en zijn lincs.
 */
export default function PollScreen() {
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = String(raw ?? "");
  const qc = useQueryClient();
  const t = useT();
  const scheme = useScheme();
  const toast = useToast();
  const { session } = useAuth();
  const myUserId = session?.user.id ?? "";

  const poll = useQuery({
    queryKey: ["poll", id],
    queryFn: () => getPollWithDetails(id, myUserId),
    enabled: !!id && !!myUserId,
  });
  const comments = useQuery({
    queryKey: ["entity-comments", "poll", id],
    queryFn: () => listEntityComments("poll", id),
    enabled: !!id,
  });
  useEffect(() => {
    if (!id) return;
    markSeen(id);
    const ch = subscribeToEntityComments("poll", id, () => comments.refetch());
    return () => {
      ch.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const p = poll.data ?? null;
  // Op zijn eigen bladzijde opent de kaart niets meer.
  const card = useMemo(() => (p ? { ...fromPoll(p, t), href: "" } : null), [p, t]);
  usePageTitle(card?.title ?? null);
  // Hertekent als je iemand een eigen kleur geeft (zie hueFor).
  useHueChoices();
  const hue = hueFor(p?.user_id);
  const fc = friendColor(hue, scheme);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [boxOpen, setBoxOpen] = useState(false);
  const commentIds = useMemo(() => (comments.data ?? []).map((c) => c.id), [comments.data]);
  const commentReactions = useCommentReactions(commentIds, myUserId);
  const [pickOpen, setPickOpen] = useState<string | null>(null);

  async function send(imageUri?: string) {
    if (!p || !myUserId) return;
    const body = draft.trim();
    if (!body && !imageUri) return;
    setSending(true);
    try {
      await addEntityComment({ entityType: "poll", entityId: id, userId: myUserId, body, ownerId: p.user_id, imageUri });
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

  return (
    <LincinScreen
      tab="feed"
      tint={p ? fc.fill : null}
      counter={t.post}
      back="/feed"
      header={
        <TopRow
          right={
            <Mono variant="micro" tone="dim">
              poll
            </Mono>
          }
        />
      }
    >
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: GUTTER, paddingTop: 14, gap: GAP }} showsVerticalScrollIndicator={false}>
          {poll.isLoading && !p ? (
            <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 40 }}>
              {t.loading}
            </Mono>
          ) : !p || !card ? (
            <Mono variant="micro" tone="dim" style={{ textAlign: "center", paddingVertical: 40 }}>
              {t.failed}
            </Mono>
          ) : (
            <>
              <PostCard
                post={card}
                hue={hue}
                myUserId={myUserId}
                reactions={[]}
                onReact={() => {}}
                onOpen={() => {}}
                onProfile={() => (p.author?.username ? openProfile(p.author.username) : undefined)}
              />
              <Mono variant="micro" tone="dim" style={{ marginTop: 6 }}>
                {t.comments} · {comments.data?.length ?? 0}
              </Mono>
              {(comments.data ?? []).map((c) => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  myUserId={myUserId}
                  reactions={
                    <CommentReactions
                      reactions={commentReactions.grouped(c.id)}
                      onToggle={(emoji) => commentReactions.toggle(c.id, emoji)}
                      open={pickOpen === c.id}
                      onOpenChange={(o) => setPickOpen(o ? c.id : null)}
                    />
                  }
                />
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
              // Een poll heeft geen emoji-reacties: een emoji gaat in je comment.
              <ReactBox onClose={() => setBoxOpen(false)} onEmoji={(e) => setDraft((d) => d + e)} onImage={(uri) => send(uri)} />
            ) : null
          }
        />
      </KeyboardAvoidingView>
    </LincinScreen>
  );
}
