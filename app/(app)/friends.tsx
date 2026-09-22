import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import {
  Platform,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { PageHead, RubricHead } from "@/components/PageHead";
import { QueryError } from "@/components/QueryError";
import { SkeletonListCard } from "@/components/Skeleton";
import {
  CONTROL_H,
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  rule,
  space,
} from "@/lib/design/type";
import { DesktopFriends } from "@/components/lincin/desktop/DesktopFriends";
import { type FriendshipWithProfile } from "@/lib/api/friends";
import { type Profile } from "@/lib/api/profiles";
import { useIsDesktop } from "@/lib/lincin/desktop";
import { useFriendsModel } from "@/lib/lincin/friends-model";
import { usePageTitle } from "@/lib/page-title";

export default function FriendsScreen() {
  usePageTitle("Vrienden");
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
  const desktop = useIsDesktop();
  const {
    friendships,
    query,
    setQuery,
    trimmed,
    search,
    searchResults,
    pendingIncoming,
    pendingOutgoing,
    accepted,
    onShareLink,
    onSendRequest,
    onAccept,
    onDelete,
  } = useFriendsModel();

  // Op het brede scherm woont Lincs in de Lincin-rail, net als Jij waar het
  // onder valt. Stond hier niet: Jij → Mijn lincs wisselde je midden in een
  // handeling naar een andere navigatie, zonder weg terug naar Jij.
  if (desktop) return <DesktopFriends />;

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      {/* Eén scroller voor de hele pagina; de kop plakt bovenaan.
          Geen ScreenContainer meer: dit ontwerp gebruikt de volle
          breedte tot PAGE_MAX. */}
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        // Naar beneden trekken om te verversen. Stond op de feed, de agenda
        // en de meldingen, en op deze drie niet — terwijl het gebaar hier
        // net zo hard verwacht wordt. `isFetching && !isLoading`: bij de
        // eerste keer laden dragen de skeletons het, dit is voor daarna.
        refreshControl={
          <RefreshControl
            refreshing={friendships.isFetching && !friendships.isLoading}
            onRefresh={() => void friendships.refetch()}
            tintColor={feed.ink}
          />
        }
      >
      <View style={{ paddingVertical: 20, paddingBottom: 40 }}>
        <View>
          <PageHead
            kicker="Wie je kent"
            title="Lincs"
            intro="Link up met mensen die je kent — via een QR-code, je eigen link, of hun handle."
            wide={wide}
            gap={space.xxl}
          />

          {/* ── Link up ──
              Stond in een gevuld vlak met een gevulde knop erin. Twee
              vullingen op een blad dat er verder geen heeft (§4), en de
              gevulde knop concurreerde bovendien met de oranje plus in de
              kopbalk — daarvan is er hoogstens één per scherm.
              Nu: één kader, twee gelijkwaardige knoppen erin. Scannen en
              je linc delen zijn ook echt twee helften van dezelfde daad. */}
          <View
            style={{
              borderWidth: FEED_BORDER,
              borderColor: feed.ink,
              padding: space.lg,
              marginBottom: space.xxl,
            }}
          >
            <RubricHead label="Link up" />
            <View style={{ flexDirection: "row", gap: space.sm }}>
              <OutlineAction
                icon="qr-code-outline"
                label="Scan een linc"
                onPress={() => router.push("/qr-scan")}
              />
              <OutlineAction
                icon="share-outline"
                label="Jouw linc"
                onPress={onShareLink}
              />
            </View>
            {/* Secundaire actie: iemand uitnodigen die nog niet op Lincin zit */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Iemand uitnodigen die nog niet op Lincin zit"
              onPress={() => router.push("/invite-email")}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: space.sm,
                height: CONTROL_H,
                marginTop: space.xs,
              }}
            >
              <Ionicons name="mail-outline" color={feed.inkDim} size={15} />
              <Text style={[feedType.label, { color: feed.inkDim }]}>
                Iemand uitnodigen die nog niet op Lincin zit
              </Text>
            </Pressable>
          </View>

          {/* ── Zoekbalk ── */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              height: CONTROL_H,
              paddingHorizontal: space.md,
              borderWidth: FEED_BORDER,
              borderColor: feed.ink,
              marginBottom: space.lg,
            }}
          >
            <Ionicons name="search" color={feed.inkDim} size={17} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Zoek iemand op handle"
              placeholderTextColor={feed.inkDim}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Zoek iemand op handle"
              style={[
                feedType.body,
                {
                  flex: 1,
                  color: feed.ink,
                  paddingLeft: space.sm,
                  ...(Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null),
                },
              ]}
            />
            {query.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Zoekopdracht wissen"
                onPress={() => setQuery("")}
                style={{
                  // Was `hitSlop={12}`. Het kruisje heeft geen eigen doos —
                  // het ís het glyph van 18 — en zijn buur is de `flex: 1`
                  // TextInput, zonder tussenruimte. Twaalf punten slop
                  // liggen dan over het einde van je eigen tekst, en omdat
                  // dit de latere broer is wint hij het raken: je tikt om
                  // je cursor te zetten en je filter is weg.
                  // Een eigen kolom van 44 hoog raakt niemand anders.
                  height: CONTROL_H,
                  paddingLeft: space.sm,
                  justifyContent: "center",
                }}
              >
                <Ionicons name="close-circle" color={feed.inkDim} size={18} />
              </Pressable>
            )}
          </View>

          {trimmed.length >= 2 && (
            <Section title="Zoekresultaten">
              {search.isError ? (
                <QueryError
                  compact
                  title="Zoeken lukte niet"
                  error={search.error}
                  onRetry={() => search.refetch()}
                />
              ) : search.isLoading ? (
                <SkeletonListCard rows={2} />
              ) : searchResults.length === 0 ? (
                <PaperHint text="Geen gebruikers gevonden." />
              ) : (
                <View style={LIST_BLOCK}>
                  {searchResults.map((p, i) => (
                    <ProfileRow
                      key={p.id}
                      profile={p}
                      onRowPress={() => router.push(`/user/${p.username}`)}
                      onAction={() => onSendRequest(p.id)}
                      actionLabel="Linc"
                      actionIcon="person-add-outline"
                      isLast={i === searchResults.length - 1}
                    />
                  ))}
                </View>
              )}
            </Section>
          )}

          {pendingIncoming.length > 0 && (
            <Section title="Linc-verzoeken" count={pendingIncoming.length}>
              <View style={LIST_BLOCK}>
                {pendingIncoming.map((f, i) => (
                  <FriendshipRow
                    key={f.id}
                    friendship={f}
                    isLast={i === pendingIncoming.length - 1}
                    onRowPress={() => router.push(`/user/${f.other.username}`)}
                    actions={[
                      { label: "Link up", onPress: () => onAccept(f.id, f.requester_id), primary: true },
                      {
                        label: "Weiger",
                        onPress: () =>
                          onDelete(
                            f.id,
                            "reject",
                            f.other.display_name ?? f.other.username
                          ),
                      },
                    ]}
                  />
                ))}
              </View>
            </Section>
          )}

          {pendingOutgoing.length > 0 && (
            <Section title="Verzonden">
              <View style={LIST_BLOCK}>
                {pendingOutgoing.map((f, i) => (
                  <FriendshipRow
                    key={f.id}
                    friendship={f}
                    isLast={i === pendingOutgoing.length - 1}
                    onRowPress={() => router.push(`/user/${f.other.username}`)}
                    actions={[
                      {
                        label: "Annuleer",
                        onPress: () =>
                          onDelete(
                            f.id,
                            "cancel",
                            f.other.display_name ?? f.other.username
                          ),
                      },
                    ]}
                  />
                ))}
              </View>
            </Section>
          )}

          <Section title="Jouw lincs">
            {friendships.isError ? (
              <QueryError
                compact
                title="Je lincs konden niet geladen worden"
                error={friendships.error}
                onRetry={() => friendships.refetch()}
              />
            ) : friendships.isLoading ? (
              <SkeletonListCard rows={3} />
            ) : accepted.length === 0 ? (
              <PaperHint text="Nog geen lincs. Lincs zijn de mensen die je feed en je chats vullen — scan iemands QR-code, of deel jouw linc." />
            ) : (
              <View style={LIST_BLOCK}>
                {accepted.map((f, i) => (
                  <FriendshipRow
                    key={f.id}
                    friendship={f}
                    isLast={i === accepted.length - 1}
                    onRowPress={() => router.push(`/user/${f.other.username}`)}
                    actions={[
                      {
                        label: "Verwijder",
                        onPress: () =>
                          onDelete(
                            f.id,
                            "remove",
                            f.other.display_name ?? f.other.username
                          ),
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </Section>
        </View>
      </View>
      </PageScroll>
    </SafeAreaView>
  );
}

/**
 * Het kader om een lijst. Eén maat, want de vier lijsten op deze pagina
 * hoorden er al hetzelfde uit te zien en deden dat niet helemaal.
 *
 * `feed.ink` en niet `rule.soft`: de chatlijst op het tabblad ernaast
 * kadert met inkt, en twee lijsten met dezelfde bedoeling horen niet zeven
 * keer in gewicht te verschillen. Dat de rand ván een lijst zwaarder is dan
 * de lijnen erbinnen is precies de bedoeling (§4).
 */
const LIST_BLOCK = {
  borderWidth: FEED_BORDER,
  borderColor: feed.ink,
} as const;

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: space.xxl }}>
      <RubricHead label={title} count={count} />
      {children}
    </View>
  );
}

/**
 * Eén regel waar anders een lijst had gestaan. Geen vulling: leegte is
 * hier de mededeling, en een grijs vlak eromheen maakt er een ding van.
 */
function PaperHint({ text }: { text: string }) {
  return (
    <View
      style={{
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        padding: space.xl,
      }}
    >
      <Text style={[feedType.body, { color: feed.inkDim }]}>{text}</Text>
    </View>
  );
}

/**
 * Een omlijnde knop met een icoon ervoor. Twee ervan naast elkaar zijn
 * gelijkwaardig — wat een gevulde en een gedempte knop niet zijn.
 */
function OutlineAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: space.sm,
        height: CONTROL_H,
        borderWidth: FEED_BORDER,
        borderColor: feed.ink,
        backgroundColor: pressed ? feed.panel : "transparent",
      })}
    >
      <Ionicons name={icon} color={feed.ink} size={18} />
      <Text style={[feedType.label, { fontSize: 12, color: feed.ink }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * De vorm van één rij in een lijst. De scheidingslijn is `postRule` en niet
 * de rand van het blok: de binnenlijn hoort de zwakste te zijn, anders
 * leest één lijst als losse kaartjes (§4).
 */
function rowStyle(isLast: boolean) {
  return {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: space.lg,
    // Dezelfde rijhoogte als de chatlijst; anders verspringt alles onder
    // een lijst zodra je van tabblad wisselt.
    paddingVertical: 14,
    ...(isLast
      ? null
      : { borderBottomWidth: FEED_BORDER, borderBottomColor: feed.postRule }),
  };
}

function ProfileRow({
  profile,
  onRowPress,
  onAction,
  actionLabel,
  actionIcon,
  isLast,
}: {
  profile: Profile;
  onRowPress: () => void;
  onAction: () => void;
  actionLabel: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  isLast: boolean;
}) {
  return (
    <View style={rowStyle(isLast)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Profiel van ${profile.display_name ?? profile.username}`}
        onPress={onRowPress}
        className="flex-row items-center flex-1"
        hitSlop={4}
      >
        <Avatar
          name={profile.display_name ?? profile.username}
          avatarUrl={profile.avatar_url}
          size="md"
        />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={[feedType.body, { fontSize: 14, fontWeight: "600", color: feed.ink }]}>
            {profile.display_name ?? profile.username}
          </Text>
          <Text style={[feedType.label, { color: feed.inkDim, marginTop: 2 }]}>
            @{profile.username}
          </Text>
        </View>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel} met ${profile.display_name ?? profile.username}`}
        onPress={onAction}
        hitSlop={6}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: space.xs,
          height: 36,
          paddingHorizontal: space.md,
          backgroundColor: pressed ? feed.inkDim : feed.ink,
        })}
      >
        {actionIcon && (
          <Ionicons name={actionIcon} color={creamOnDark.DEFAULT} size={14} />
        )}
        <Text style={[feedType.label, { fontSize: 12, color: creamOnDark.DEFAULT }]}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

function FriendshipRow({
  friendship,
  actions,
  onRowPress,
  isLast,
}: {
  friendship: FriendshipWithProfile;
  actions: { label: string; onPress: () => void; primary?: boolean }[];
  onRowPress: () => void;
  isLast: boolean;
}) {
  return (
    <View style={rowStyle(isLast)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Profiel van ${
          friendship.other.display_name ?? friendship.other.username
        }`}
        onPress={onRowPress}
        className="flex-row items-center flex-1"
        hitSlop={4}
      >
        <Avatar
          name={friendship.other.display_name ?? friendship.other.username}
          avatarUrl={friendship.other.avatar_url}
          size="md"
        />
        <View style={{ flex: 1, marginLeft: space.md }}>
          <Text style={[feedType.body, { fontSize: 14, fontWeight: "600", color: feed.ink }]}>
            {friendship.other.display_name ?? friendship.other.username}
          </Text>
          <Text style={[feedType.label, { color: feed.inkDim, marginTop: 2 }]}>
            @{friendship.other.username}
          </Text>
        </View>
      </Pressable>
      <View style={{ flexDirection: "row", gap: space.sm }}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            accessibilityLabel={`${a.label} — ${
              friendship.other.display_name ?? friendship.other.username
            }`}
            onPress={a.onPress}
            hitSlop={6}
            style={({ pressed }) => ({
              // 36 en een hitSlop erbij: de regel die dit systeem zichzelf
              // stelt is 44 (§7), en "Weiger"/"Verwijder" zijn de
              // gevaarlijkste knoppen op deze pagina.
              height: 36,
              paddingHorizontal: space.md,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: a.primary ? 0 : FEED_BORDER,
              borderColor: rule.soft,
              backgroundColor: a.primary
                ? pressed
                  ? feed.inkDim
                  : feed.ink
                : pressed
                ? feed.panel
                : "transparent",
            })}
          >
            <Text
              style={[
                feedType.label,
                { fontSize: 12, color: a.primary ? creamOnDark.DEFAULT : feed.ink },
              ]}
            >
              {a.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
