import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { getOrCreateDirectChat } from "@/lib/api/chats";
import type { Profile } from "@/lib/api/profiles";
import { color, useThemeSpec } from "@/lib/design/theme";
import { capf, mono, sans } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { useFriendsModel } from "@/lib/lincin/friends-model";
import { useToast } from "@/lib/toast";

import { DesktopShell, MonoLink, TopBar } from "./Shell";

/**
 * Lincs op desktop, in de Lincin-rail.
 *
 * Dit scherm tekende op elke breedte de oude kop (`AppChrome`): een
 * bovenbalk met Feed · Events · Chats · Profiel, zonder Meldingen en zonder
 * weg terug. Je kwam er vanuit Jij → Mijn lincs, dus midden in een
 * handeling veranderde de hele navigatie van vorm. Nu staat het in dezelfde
 * rail als Jij, met "04 JIJ" aan, want daar woont het.
 *
 * Wat het dóét komt uit `useFriendsModel`, dezelfde bron als de telefoon:
 * bevestigen voor verbreken, per soort een eigen foutmelding, de zoekrem.
 * Hier staat alleen de vorm — de groepen en rijen van `DesktopYou`, zodat
 * de twee schermen onder Jij bij elkaar horen.
 */
export function DesktopFriends() {
  const router = useRouter();
  const t = useT();
  const spec = useThemeSpec();
  // Lincs woont onder Jij; dat is zijn terugweg, waar je ook vandaan kwam.
  // Een tabblad heeft geen geschiedenis om uit te lezen (zie lib/nav).
  const back = { label: t.tabYou, go: () => router.navigate("/profile") };
  const m = useFriendsModel();

  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const rule = color("ink", "postRule");
  const nameOf = (p: Profile) => p.display_name ?? p.username;
  const openProfile = (p: Profile) => router.push(`/user/${p.username}` as never);
  const toast = useToast();
  // Hetzelfde gesprek als "Bericht" op iemands profiel: bestaat het al, dan
  // dat; anders wordt het nu gemaakt.
  async function openChat(p: Profile) {
    try {
      router.push(`/chat/${await getOrCreateDirectChat(p.id)}` as never);
    } catch {
      toast.error("Het gesprek kon niet geopend worden.");
    }
  }

  const note = (text: string) => (
    <Text style={[sans(), { fontSize: 13, lineHeight: 18, color: dim, paddingVertical: 13 }]}>{text}</Text>
  );

  return (
    <DesktopShell active="you">
      <TopBar
        left={
          <>
            <MonoLink label={`← ${back.label}`} active onPress={back.go} />
            <MonoLink label={t.myLincs} />
          </>
        }
      />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
        <View style={{ maxWidth: 900, borderBottomWidth: spec.border, borderBottomColor: ink, paddingBottom: 16 }}>
          <Text style={[capf(false, true), { fontSize: 46, lineHeight: 44, color: ink }]}>
            Lincs <Text style={[capf(true, true), { color: dim }]}>die je kent</Text>
          </Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 24, marginTop: 26, maxWidth: 900 }}>
          <Group title="Link up">
            <Row label="Scan een linc" sub="Met de camera, bij elkaar" onPress={() => router.push("/qr-scan")}>
              <MonoLink label="→" active />
            </Row>
            <Row label="Jouw linc" sub="Je QR-code en je eigen link" onPress={() => router.push("/qr-code")}>
              <MonoLink label="→" active />
            </Row>
            <Row label="Deel je link" sub="Naar wie je wil, buiten Lincin" onPress={m.onShareLink}>
              <MonoLink label="→" active />
            </Row>
            <Row label="Iemand uitnodigen" sub="Die nog niet op Lincin zit" onPress={() => router.push("/invite-email")} last>
              <MonoLink label="→" active />
            </Row>
          </Group>

          <Group title="Zoek op handle">
            <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: rule }}>
              <TextInput
                value={m.query}
                onChangeText={m.setQuery}
                placeholder="@handle"
                placeholderTextColor={dim}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Zoek iemand op handle"
                style={[
                  sans(),
                  {
                    fontSize: 15,
                    lineHeight: 19,
                    color: ink,
                    paddingVertical: 4,
                    ...(Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null),
                  },
                ]}
              />
            </View>
            {m.trimmed.length < 2 ? (
              note("Minstens twee tekens.")
            ) : m.search.isError ? (
              note("Zoeken lukte niet.")
            ) : m.search.isLoading ? (
              note(t.loading)
            ) : m.searchResults.length === 0 ? (
              note("Geen gebruikers gevonden.")
            ) : (
              m.searchResults.map((p, i) => (
                <Person key={p.id} profile={p} onOpen={() => openProfile(p)} last={i === m.searchResults.length - 1}>
                  <MonoLink label="Linc +" active onPress={() => m.onSendRequest(p.id)} />
                </Person>
              ))
            )}
          </Group>
        </View>

        {m.pendingIncoming.length > 0 ? (
          <Wide title={`Linc-verzoeken · ${m.pendingIncoming.length}`}>
            {m.pendingIncoming.map((f, i) => (
              <Person key={f.id} profile={f.other} onOpen={() => openProfile(f.other)} last={i === m.pendingIncoming.length - 1}>
                <MonoLink label="Link up" active onPress={() => m.onAccept(f.id, f.requester_id)} />
                <MonoLink label="Weiger" on={false} active onPress={() => m.onDelete(f.id, "reject", nameOf(f.other))} />
              </Person>
            ))}
          </Wide>
        ) : null}

        {m.pendingOutgoing.length > 0 ? (
          <Wide title="Verzonden">
            {m.pendingOutgoing.map((f, i) => (
              <Person key={f.id} profile={f.other} onOpen={() => openProfile(f.other)} last={i === m.pendingOutgoing.length - 1}>
                <MonoLink label="Annuleer" on={false} active onPress={() => m.onDelete(f.id, "cancel", nameOf(f.other))} />
              </Person>
            ))}
          </Wide>
        ) : null}

        <Wide title={`Jouw lincs · ${m.accepted.length}`}>
          {m.friendships.isError
            ? note("Je lincs konden niet geladen worden.")
            : m.friendships.isLoading
              ? note(t.loading)
              : m.accepted.length === 0
                ? note("Nog geen lincs. Scan iemands QR-code, of deel jouw linc.")
                : m.accepted.map((f, i) => (
                    <Person key={f.id} profile={f.other} onOpen={() => openProfile(f.other)} last={i === m.accepted.length - 1}>
                      <MonoLink label={`${t.privateMsg} →`} active onPress={() => openChat(f.other)} />
                      <MonoLink label="Verwijder" on={false} active onPress={() => m.onDelete(f.id, "remove", nameOf(f.other))} />
                    </Person>
                  ))}
        </Wide>
      </ScrollView>
    </DesktopShell>
  );

  function GroupTitle({ children }: { children: string }) {
    return (
      <Text style={[capf(true, true), { fontSize: 20, lineHeight: 22, color: ink, borderBottomWidth: spec.border, borderBottomColor: ink, paddingBottom: 8 }]}>
        {children}
      </Text>
    );
  }

  function Group({ title, children }: { title: string; children: ReactNode }) {
    return (
      <View style={{ flexGrow: 1, flexBasis: 280, minWidth: 280 }}>
        <GroupTitle>{title}</GroupTitle>
        <View>{children}</View>
      </View>
    );
  }

  function Wide({ title, children }: { title: string; children: ReactNode }) {
    return (
      <View style={{ marginTop: 26, maxWidth: 900 }}>
        <GroupTitle>{title}</GroupTitle>
        <View>{children}</View>
      </View>
    );
  }

  function Row({ label, sub, children, onPress, last = false }: { label: string; sub: string; children: ReactNode; onPress?: () => void; last?: boolean }) {
    return (
      <Pressable
        accessibilityRole={onPress ? "button" : undefined}
        accessibilityLabel={label}
        onPress={onPress}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 13, borderBottomWidth: last ? 0 : 1, borderBottomColor: rule }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[sans(), { fontSize: 15, lineHeight: 19, color: ink }]}>{label}</Text>
          {sub ? <Text style={[sans(), { fontSize: 12, lineHeight: 16, color: dim }]}>{sub}</Text> : null}
        </View>
        {children}
      </Pressable>
    );
  }

  /** Eén persoon: naam en handle openen het profiel, rechts wat je met hem kunt. */
  function Person({ profile: p, onOpen, children, last }: { profile: Profile; onOpen: () => void; children: ReactNode; last: boolean }) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: last ? 0 : 1, borderBottomColor: rule }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`Profiel van ${nameOf(p)}`}
          onPress={onOpen}
          style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 12 }}
        >
          <Avatar name={nameOf(p)} avatarUrl={p.avatar_url} size="sm" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={[sans(), { fontSize: 15, lineHeight: 19, color: ink }]}>{nameOf(p)}</Text>
            <Text numberOfLines={1} style={[mono(500), { fontSize: 10, lineHeight: 13, color: dim }]}>@{p.username}</Text>
          </View>
        </Pressable>
        <View style={{ flexDirection: "row", gap: 16 }}>{children}</View>
      </View>
    );
  }
}
