import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Linking, Platform, Text, View } from "react-native";

import { PersonDot } from "@/components/lincin/post/Reactions";
import { Badge, bodyStyle, Button, Field, ListRow, Note, Section, SubPage } from "@/components/lincin/SubPage";
import { contactsAvailable, hashEmail, matchContacts, readContactsWithEmail, type ContactMatch, type PhoneContact } from "@/lib/api/contacts";
import { sendEmailInvite } from "@/lib/api/invites";
import { useThemeSpec } from "@/lib/design/theme";
import { useFriendsModel } from "@/lib/lincin/friends-model";
import { displayName } from "@/lib/lincin/model";
import { usePageTitle } from "@/lib/page-title";
import { useToast } from "@/lib/toast";

type Phase =
  | { kind: "intro" }
  | { kind: "web" }
  | { kind: "loading" }
  | { kind: "denied"; canAskAgain: boolean }
  | { kind: "error"; message: string }
  | { kind: "done"; contacts: PhoneContact[]; matches: Map<string, ContactMatch> };

/**
 * "Uit je contacten": wie in je telefoonboek staat en al op Lincin zit,
 * met een knop om te lincen; de rest kun je uitnodigen per mail.
 *
 * Pas na een tik op de knop vraagt de app toestemming en leest hij — niet
 * bij het openen van de pagina. De adressen gaan alleen als hash naar de
 * server (`lib/api/contacts.ts`, 0088) en worden nergens bewaard.
 */
export default function ContactsScreen() {
  usePageTitle("Uit je contacten");
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const th = useThemeSpec().id;
  const { friendships, onSendRequest } = useFriendsModel();
  const [phase, setPhase] = useState<Phase>(Platform.OS === "web" ? { kind: "web" } : { kind: "intro" });
  const [filter, setFilter] = useState("");
  const [invited, setInvited] = useState<Set<string>>(new Set());
  const [inviting, setInviting] = useState<string | null>(null);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  useEffect(() => {
    contactsAvailable().then((ok) => {
      if (!ok) setPhase({ kind: "web" });
    });
  }, []);

  async function look() {
    setPhase({ kind: "loading" });
    try {
      const res = await readContactsWithEmail();
      if (res.status === "denied") {
        setPhase({ kind: "denied", canAskAgain: res.canAskAgain });
        return;
      }
      const byHash = new Map<string, string>();
      for (const c of res.contacts) for (const e of c.emails) byHash.set(await hashEmail(e), c.key);
      const found = await matchContacts([...byHash.keys()]);
      const matches = new Map<string, ContactMatch>();
      for (const m of found) {
        const key = byHash.get(m.hash);
        if (key && !matches.has(key)) matches.set(key, m);
      }
      setPhase({ kind: "done", contacts: res.contacts, matches });
    } catch (e) {
      const message =
        e instanceof Error && e.message === "rate_limited"
          ? "Je keek net al een paar keer. Probeer het over een uur opnieuw."
          : "Je contacten konden niet vergeleken worden.";
      setPhase({ kind: "error", message });
    }
  }

  // Wie al linc is of een verzoek heeft lopen, in welke richting dan ook.
  const status = useMemo(() => {
    const m = new Map<string, "linc" | "pending">();
    for (const f of friendships.data ?? []) {
      const other = f.other.id;
      if (f.status === "accepted") m.set(other, "linc");
      else if (f.status === "pending") m.set(other, "pending");
    }
    return m;
  }, [friendships.data]);

  async function invite(c: PhoneContact) {
    setInviting(c.key);
    try {
      await sendEmailInvite(c.emails[0]);
      await qc.invalidateQueries({ queryKey: ["pending-invites"] });
      setInvited((s) => new Set(s).add(c.key));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "De uitnodiging kon niet verstuurd worden.");
    } finally {
      setInviting(null);
    }
  }

  async function request(id: string) {
    setRequested((s) => new Set(s).add(id));
    await onSendRequest(id);
  }

  const q = filter.trim().toLowerCase();
  const done = phase.kind === "done" ? phase : null;
  const onLincin = done ? done.contacts.filter((c) => done.matches.has(c.key)) : [];
  const others = done
    ? done.contacts.filter((c) => !done.matches.has(c.key) && (!q || c.name.toLowerCase().includes(q) || c.emails.some((e) => e.includes(q))))
    : [];

  return (
    <SubPage
      title="Uit je contacten"
      kicker="Wie je kent"
      sub="Zie wie van je contacten al op Lincin zit. Je adressen gaan als onleesbare code naar de server en worden niet bewaard."
      back="/(app)/friends"
      tab="you"
      hue="blue"
    >
      {phase.kind === "web" ? (
        <Section pad>
          <Text style={bodyStyle(th, 15)}>Je contacten lezen kan alleen in de app op je telefoon. Hier kun je iemand uitnodigen met zijn e-mailadres.</Text>
          <Button label="Uitnodigen via e-mail" icon="mail-outline" onPress={() => router.push("/invite-email")} />
        </Section>
      ) : null}

      {phase.kind === "intro" || phase.kind === "loading" ? (
        <Section pad>
          <Text style={bodyStyle(th, 15)}>Lincin vraagt eerst toestemming. Daarna vergelijken we alleen e-mailadressen; namen en nummers blijven op je telefoon.</Text>
          <Button label="Kijk in mijn contacten" tone="primary" icon="people-outline" busy={phase.kind === "loading"} onPress={look} />
        </Section>
      ) : null}

      {phase.kind === "denied" ? (
        <Section pad>
          <Note tone="red">Lincin mag je contacten niet lezen.</Note>
          {phase.canAskAgain ? (
            <Button label="Opnieuw vragen" onPress={look} />
          ) : (
            <Button label="Open instellingen" icon="settings-outline" onPress={() => Linking.openSettings()} />
          )}
        </Section>
      ) : null}

      {phase.kind === "error" ? (
        <Section pad>
          <Note tone="red">{phase.message}</Note>
          <Button label="Opnieuw" onPress={look} />
        </Section>
      ) : null}

      {done ? (
        <>
          <Section label={`Al op Lincin · ${onLincin.length}`}>
            {onLincin.length === 0 ? (
              <View style={{ padding: 16 }}>
                <Note>Nog niemand uit je contacten. Nodig hieronder iemand uit.</Note>
              </View>
            ) : (
              onLincin.map((c, i) => {
                const m = done.matches.get(c.key)!;
                const st = requested.has(m.id) ? "pending" : status.get(m.id);
                return (
                  <ListRow
                    key={c.key}
                    first={i === 0}
                    title={c.name}
                    sub={`@${m.username}${m.display_name && m.display_name !== c.name ? ` · ${displayName(m)}` : ""}`}
                    left={<PersonDot id={m.id} name={displayName(m)} url={m.avatar_url} size={40} />}
                    onPress={() => router.push(`/user/${m.username}` as never)}
                    right={
                      st === "linc" ? (
                        <Badge label="Linc ✓" />
                      ) : st === "pending" ? (
                        <Badge label="Verstuurd" />
                      ) : (
                        <Button label="Linc" small tone="primary" onPress={() => request(m.id)} />
                      )
                    }
                  />
                );
              })
            )}
          </Section>

          <Section label={`Nog niet op Lincin · ${done.contacts.length - onLincin.length}`} style={{ marginTop: 12 }}>
            {done.contacts.length - onLincin.length > 12 ? (
              <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <Field value={filter} onChangeText={setFilter} placeholder="Zoek op naam of e-mail" autoCapitalize="none" autoCorrect={false} />
              </View>
            ) : null}
            {others.slice(0, 300).map((c, i) => (
              <ListRow
                key={c.key}
                first={i === 0}
                title={c.name}
                sub={c.emails[0]}
                right={
                  invited.has(c.key) ? (
                    <Badge label="Uitgenodigd" />
                  ) : (
                    <Button label="Uitnodigen" small busy={inviting === c.key} disabled={inviting !== null && inviting !== c.key} onPress={() => invite(c)} />
                  )
                }
              />
            ))}
            {others.length > 300 ? (
              <View style={{ padding: 16 }}>
                <Note>Nog {others.length - 300} meer — zoek op naam.</Note>
              </View>
            ) : null}
          </Section>
        </>
      ) : null}
    </SubPage>
  );
}
