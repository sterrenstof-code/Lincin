import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { useWide } from "@/components/Editorial";
import { useAuth } from "@/lib/auth/provider";
import {
  BUG_STATUS_LABEL,
  listBugs,
  reportBug,
  toggleBugConfirm,
  withdrawBug,
  type BugReportWithReporter,
  type BugStatus,
} from "@/lib/api/bugs";
import { confirm } from "@/lib/confirm";
import { safeBack } from "@/lib/nav";
import {
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  flame,
  flameDeep,
  space,
} from "@/lib/design/type";

/**
 * Wat er stuk is.
 *
 * Eén bord voor iedereen, geen formulier dat in het niets verdwijnt. Je
 * leest eerst of je bug er al staat; staat hij er, dan tik je "ik heb dit
 * ook" in plaats van een tweede melding te schrijven. Dat aantal bepaalt
 * wat er als eerste opgelost wordt.
 */
export default function BugsScreen() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const wide = useWide();
  const qc = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [composing, setComposing] = useState(false);

  const bugs = useQuery({
    queryKey: ["bugs"],
    queryFn: listBugs,
    refetchOnWindowFocus: true,
  });

  const submit = useMutation({
    mutationFn: () =>
      reportBug({ userId: myUserId, title, body, route: pathname }),
    onSuccess: () => {
      setTitle("");
      setBody("");
      setComposing(false);
      qc.invalidateQueries({ queryKey: ["bugs"] });
    },
  });

  const meToo = useMutation({
    mutationFn: (bug: BugReportWithReporter) =>
      toggleBugConfirm({
        reportId: bug.id,
        userId: myUserId,
        confirmed: bug.confirmed_by_me,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bugs"] }),
  });

  async function onWithdraw(bug: BugReportWithReporter) {
    const ok = await confirm(
      "Melding intrekken?",
      "De melding verdwijnt van het bord.",
      { affirmativeLabel: "Intrekken", destructive: true }
    );
    if (!ok) return;
    await withdrawBug(bug.id);
    qc.invalidateQueries({ queryKey: ["bugs"] });
  }

  const open = (bugs.data ?? []).filter((b) => !b.resolved_at);
  const done = (bugs.data ?? []).filter((b) => b.resolved_at);

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space.md,
          paddingHorizontal: space.lg,
          paddingVertical: space.md,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
          onPress={() => safeBack(router)}
          hitSlop={10}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed ? 0.5 : 1,
          })}
        >
          <Ionicons name="close" color={feed.ink} size={20} />
        </Pressable>
        <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>
          WAT ER STUK IS
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.lg,
          paddingBottom: 80,
          width: "100%",
          maxWidth: 760,
          alignSelf: "center",
        }}
        refreshControl={
          <RefreshControl
            refreshing={bugs.isFetching && !bugs.isLoading}
            onRefresh={() => qc.invalidateQueries({ queryKey: ["bugs"] })}
            tintColor={feed.ink}
          />
        }
      >
        <Text style={[wide ? feedType.hero : feedType.heroSmall, { color: feed.ink, maxWidth: 620 }]}>
          Bugmeldingen
        </Text>
        <Text
          style={[
            feedType.body,
            { color: feed.inkDim, maxWidth: 520, marginTop: 10, marginBottom: 24 },
          ]}
        >
          Kijk eerst of het er al staat. Zo ja — tik "ik heb dit ook", dat
          weegt zwaarder dan een tweede melding. Zo nee, schrijf hem erbij.
        </Text>

        {/* --- Melden --- */}
        {composing ? (
          <View
            style={{
              borderWidth: FEED_BORDER,
              borderColor: feed.ink,
              backgroundColor: feed.post,
              padding: space.lg,
              marginBottom: space.xl,
            }}
          >
            <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>
              WAT GING ER MIS
            </Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="In één zin — “de pijl in de carrousel doet niets”"
              placeholderTextColor={feed.inkDim}
              maxLength={120}
              autoFocus
              style={[
                feedType.tile,
                {
                  fontSize: 17,
                  color: feed.ink,
                  paddingVertical: 10,
                  ...(Platform.OS === "web"
                    ? ({ outlineWidth: 0, outlineStyle: "none" } as any)
                    : {}),
                },
              ]}
            />
            <View style={{ height: FEED_BORDER, backgroundColor: feed.ink, opacity: 0.25 }} />
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Wat deed je vlak ervoor? Wat verwachtte je? (mag leeg)"
              placeholderTextColor={feed.inkDim}
              multiline
              maxLength={2000}
              style={[
                feedType.body,
                {
                  color: feed.ink,
                  paddingVertical: 10,
                  minHeight: 90,
                  textAlignVertical: "top",
                  ...(Platform.OS === "web"
                    ? ({ outlineWidth: 0, outlineStyle: "none" } as any)
                    : {}),
                },
              ]}
            />
            <Text style={[feedType.label, { color: feed.inkDim, marginTop: 4 }]}>
              Je toestel, je versie en het scherm waar je vandaan komt gaan
              automatisch mee.
            </Text>

            <View style={{ flexDirection: "row", gap: space.sm, marginTop: space.lg }}>
              <Pressable
                onPress={() => submit.mutate()}
                disabled={title.trim().length < 3 || submit.isPending}
                style={{
                  flex: 1,
                  height: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: title.trim().length < 3 ? feed.panel : flame,
                }}
              >
                {submit.isPending ? (
                  <ActivityIndicator color={creamOnDark.DEFAULT} size="small" />
                ) : (
                  <Text
                    style={[
                      feedType.tile,
                      {
                        fontSize: 14,
                        color: title.trim().length < 3 ? feed.inkDim : creamOnDark.DEFAULT,
                      },
                    ]}
                  >
                    Melden
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => setComposing(false)}
                style={{
                  height: 44,
                  paddingHorizontal: space.lg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={[feedType.tile, { fontSize: 14, color: feed.inkDim }]}>
                  Laat maar
                </Text>
              </Pressable>
            </View>

            {submit.isError ? (
              <Text style={[feedType.label, { color: flame, marginTop: space.sm }]}>
                Versturen lukte niet. Probeer het nog eens.
              </Text>
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={() => setComposing(true)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              borderWidth: FEED_BORDER,
              borderColor: feed.ink,
              backgroundColor: pressed ? feed.panel : feed.post,
              paddingHorizontal: space.lg,
              height: 56,
              marginBottom: space.xl,
            })}
          >
            <Ionicons name="add" color={feed.ink} size={20} />
            <Text style={[feedType.tile, { fontSize: 15, color: feed.ink, flex: 1 }]}>
              Iets melden
            </Text>
          </Pressable>
        )}

        {/* --- Het bord --- */}
        {bugs.isLoading ? (
          <ActivityIndicator color={feed.ink} />
        ) : (bugs.data ?? []).length === 0 ? (
          <Empty />
        ) : (
          <>
            <Section title="Nog open" count={open.length}>
              {open.map((bug, i) => (
                <BugRow
                  key={bug.id}
                  bug={bug}
                  mine={bug.user_id === myUserId}
                  isLast={i === open.length - 1}
                  onConfirm={() => meToo.mutate(bug)}
                  onWithdraw={() => onWithdraw(bug)}
                />
              ))}
            </Section>

            {done.length > 0 && (
              <Section title="Afgehandeld" count={done.length}>
                {done.map((bug, i) => (
                  <BugRow
                    key={bug.id}
                    bug={bug}
                    mine={bug.user_id === myUserId}
                    isLast={i === done.length - 1}
                    onConfirm={() => meToo.mutate(bug)}
                    onWithdraw={() => onWithdraw(bug)}
                  />
                ))}
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <View style={{ marginBottom: space.xl }}>
      <Text
        style={[
          feedType.kicker,
          { color: flameDeep, letterSpacing: 0.55, marginBottom: space.sm },
        ]}
      >
        {title.toUpperCase()} · {count}
      </Text>
      <View style={{ borderWidth: FEED_BORDER, borderColor: feed.ink }}>{children}</View>
    </View>
  );
}

function BugRow({
  bug,
  mine,
  isLast,
  onConfirm,
  onWithdraw,
}: {
  bug: BugReportWithReporter;
  mine: boolean;
  isLast: boolean;
  onConfirm: () => void;
  onWithdraw: () => void;
}) {
  const [open, setOpen] = useState(false);
  const settled = !!bug.resolved_at;

  return (
    <View
      style={{
        backgroundColor: settled ? feed.panel : feed.post,
        ...(isLast ? null : { borderBottomWidth: FEED_BORDER, borderBottomColor: feed.ink }),
      }}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={{ paddingHorizontal: space.lg, paddingVertical: space.lg, gap: 6 }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm }}>
          <StatusDot status={bug.status} />
          <Text style={[feedType.label, { color: feed.inkDim }]}>
            {BUG_STATUS_LABEL[bug.status]}
          </Text>
          <View style={{ flex: 1 }} />
          {/* Het getal dat de volgorde bepaalt. */}
          <Text style={[feedType.label, { color: bug.affected > 1 ? flameDeep : feed.inkDim }]}>
            {bug.affected} {bug.affected === 1 ? "persoon" : "mensen"}
          </Text>
        </View>

        <Text style={[feedType.tile, { fontSize: 16, color: feed.ink }]}>
          {bug.title}
        </Text>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Avatar
            name={bug.reporter?.display_name ?? bug.reporter?.username}
            avatarUrl={bug.reporter?.avatar_url ?? null}
            size="xs"
          />
          <Text style={[feedType.kicker, { color: "#3A3540", letterSpacing: 0.5 }]}>
            {(bug.reporter?.display_name ?? bug.reporter?.username ?? "Iemand").toUpperCase()}
            {bug.platform ? ` · ${bug.platform.toUpperCase()}` : ""}
            {bug.app_version ? ` · v${bug.app_version}` : ""}
          </Text>
        </View>
      </Pressable>

      {open && (
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingBottom: space.lg,
            gap: space.md,
          }}
        >
          {bug.body ? (
            <Text style={[feedType.body, { color: feed.inkDim }]}>{bug.body}</Text>
          ) : null}

          {bug.route ? (
            <Text style={[feedType.label, { color: feed.inkDim }]}>
              Scherm: {bug.route}
            </Text>
          ) : null}

          {bug.resolution ? (
            <View style={{ flexDirection: "row", gap: space.md }}>
              <View style={{ width: FEED_BORDER * 2, backgroundColor: flame }} />
              <Text style={[feedType.body, { color: feed.ink, flex: 1 }]}>
                {bug.resolution}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: "row", gap: space.sm }}>
            {!settled && !mine && (
              <Pressable
                hitSlop={6}
                onPress={onConfirm}
                style={{
                  height: 38,
                  paddingHorizontal: space.lg,
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: FEED_BORDER,
                  borderColor: feed.ink,
                  backgroundColor: bug.confirmed_by_me ? flame : "transparent",
                }}
              >
                <Text
                  style={[
                    feedType.label,
                    { color: bug.confirmed_by_me ? creamOnDark.DEFAULT : feed.ink },
                  ]}
                >
                  {bug.confirmed_by_me ? "Ik heb dit ook ✓" : "Ik heb dit ook"}
                </Text>
              </Pressable>
            )}
            {mine && (
              <Pressable
                hitSlop={6}
                onPress={onWithdraw}
                style={{
                  height: 38,
                  paddingHorizontal: space.lg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={[feedType.label, { color: feed.inkDim }]}>Intrekken</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

function StatusDot({ status }: { status: BugStatus }) {
  // Vierkant, niet rond — zelfde markering als de ongelezen-stip in de
  // meldingen. Kleur alleen waar hij iets zegt.
  const color =
    status === "open" ? flame :
    status === "bezig" ? flameDeep :
    feed.inkDim;
  return <View style={{ width: 6, height: 6, backgroundColor: color }} />;
}

function Empty() {
  return (
    <View
      style={{
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        backgroundColor: feed.post,
        padding: 32,
      }}
    >
      <Text style={[feedType.tile, { fontSize: 20, color: feed.text, marginBottom: 8 }]}>
        Nog niets gemeld
      </Text>
      <Text style={[feedType.body, { color: feed.textDim, maxWidth: 440 }]}>
        Kom je iets tegen dat niet klopt — hoe klein ook — zet het erbij. Een
        bug die niemand meldt wordt niet opgelost.
      </Text>
    </View>
  );
}
