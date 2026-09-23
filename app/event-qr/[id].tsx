import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { bodyStyle, Button, labelStyle, Note, Panel, Section, SubPage } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import { buildEventJoinUrl, getEvent } from "@/lib/api/events";
import { copyToClipboard, shareText } from "@/lib/share";
import { color, friendColor, hueFor, ON_DARK, ON_LIGHT, RASTER, useScheme, useThemeSpec } from "@/lib/design/theme";
import { mono, serif } from "@/lib/design/type";
import { NL } from "@/lib/locale";
import { usePageTitle } from "@/lib/page-title";

const QR_SIZE = 260;

/**
 * Uitnodigen voor een event, in de vorm van het thema
 * (components/lincin/SubPage).
 *
 * De kop is het event zelf, in de kleur van de gastheer. Daaronder de
 * code: in magazine op een volvlaks kleurvlak, in kleur in een inktkader,
 * in modern op een tegel. De code zelf is altijd donker op licht
 * (ON_LIGHT op ON_DARK), ook in de donkere stand: een camera leest een
 * omgekeerde code slecht.
 */
export default function EventQrScreen() {
  usePageTitle("Uitnodigen");
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id!;
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const event = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => getEvent(eventId, myUserId),
  });

  const [copyHint, setCopyHint] = useState<string | null>(null);

  function flashHint(text: string) {
    setCopyHint(text);
    setTimeout(() => setCopyHint(null), 1600);
  }

  async function onShare() {
    if (!event.data) return;
    const url = buildEventJoinUrl(event.data.join_code);
    const r = await shareText({
      title: `Join "${event.data.name}" op Lincin`,
      message: `Je bent uitgenodigd voor "${event.data.name}": ${url}`,
    });
    if (r === "copied") flashHint("Link gekopieerd");
  }

  async function onCopy() {
    if (!event.data) return;
    const url = buildEventJoinUrl(event.data.join_code);
    if (await copyToClipboard(url)) flashHint("Link gekopieerd");
  }

  const th = useThemeSpec().id;
  const scheme = useScheme();

  /**
   * Een schijfje in het midden van een leeg scherm, en geen uitweg.
   *
   * `isLoading || !data` dekte drie situaties met één beeld — nog bezig,
   * mislukt, of het event bestaat niet meer — en bij de laatste twee bleef
   * die spinner draaien tot je de app afsloot. Er stond geen kop boven en
   * dus ook geen sluitknop: dit scherm wordt vanaf de eventpagina geopend,
   * maar je komt er ook via een deep-link, en dan was er niets.
   *
   * Hier blijven de drie standen gescheiden, en de pagina draagt altijd de
   * weg terug naar het event in zijn kop.
   */
  if (event.isLoading || event.isError || !event.data) {
    const kind = event.isLoading ? "loading" : event.isError ? "error" : "missing";
    const detail = (event.error as Error | null)?.message;
    return (
      <SubPage
        title={kind === "loading" ? "…" : kind === "error" ? "Niet geladen" : "Niet gevonden"}
        kicker="Uitnodigen"
        back={`/event/${eventId}`}
        tab="events"
        hue={hueFor(eventId)}
      >
        {kind === "loading" ? (
          <Note>Dit event laden…</Note>
        ) : kind === "error" ? (
          <Section pad>
            <Text style={bodyStyle(th, 15)}>Dit event kon niet geladen worden.</Text>
            {detail ? <Text style={labelStyle(th, 9, color("ink", "inkDim"))}>{detail}</Text> : null}
            <View style={{ flexDirection: "row" }}>
              <Button label="Opnieuw" icon="refresh" small onPress={() => event.refetch()} />
            </View>
          </Section>
        ) : (
          <Section pad>
            <Text style={bodyStyle(th, 15)}>Dit event bestaat niet meer</Text>
            <Text style={bodyStyle(th, 13, color("ink", "inkDim"))}>
              Hij is verwijderd, of je hebt er geen toegang (meer) toe. De
              link klopt misschien nog wel, maar er staat niets meer achter.
            </Text>
          </Section>
        )}
      </SubPage>
    );
  }

  const ev = event.data;
  const url = buildEventJoinUrl(ev.join_code);
  const hue = hueFor(ev.host_user_id);
  const fc = friendColor(hue, scheme);
  const sub = `${new Date(ev.starts_at).toLocaleDateString(NL, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })} · ${ev.members_count} ${ev.members_count === 1 ? "gast" : "gasten"}`;
  const explain =
    ev.join_policy === "closed"
      ? "Laat iemand deze code scannen met hun camera, of stuur de link door. Dit is een gesloten event: hun verzoek komt eerst bij jou terecht."
      : "Laat iemand deze code scannen met hun camera, of stuur de link door. Ze worden automatisch toegevoegd aan het event.";

  // De code op zijn eigen lichte vlak, in elk thema.
  const code = (
    <View
      style={{
        padding: 16,
        backgroundColor: ON_DARK,
        borderRadius: th === "modern" ? 14 : 0,
        borderWidth: th === "kleur" ? 1.5 : 0,
        borderColor: color("ink"),
      }}
    >
      <QRCode
        value={url}
        size={QR_SIZE}
        color={ON_LIGHT}
        backgroundColor={ON_DARK}
        logo={require("../../assets/images/icon.png")}
        logoSize={56}
        logoBackgroundColor={ON_DARK}
        logoBorderRadius={12}
        logoMargin={4}
        ecl="H"
      />
    </View>
  );

  const labelColor = th === "magazine" ? fc.ink : color("ink", "inkDim");
  const textColor = th === "magazine" ? fc.ink : color("ink", "inkDim");
  const codeBlockInner = (
    <View style={{ alignItems: "center", gap: 16, paddingVertical: th === "modern" ? RASTER.tilePadLarge : 24, paddingHorizontal: 18 }}>
      <Text style={labelStyle(th, th === "magazine" ? 9 : 10, labelColor)}>Scan om mee te doen</Text>
      {code}
      <Text
        style={[
          th === "magazine" ? { ...serif(true), fontSize: 16, lineHeight: 22 } : bodyStyle(th, 12.5),
          { color: textColor, textAlign: "center", maxWidth: 360 },
        ]}
      >
        {explain}
      </Text>
    </View>
  );

  return (
    <SubPage title={ev.name} kicker="Uitnodigen" sub={sub} back={`/event/${eventId}`} tab="events" hue={hue}>
      {/* Magazine: de code op een volvlaks kleurvlak, zoals een spread. */}
      {th === "magazine" ? <View style={{ backgroundColor: fc.fill }}>{codeBlockInner}</View> : <Panel>{codeBlockInner}</Panel>}

      <Section label="Join-link" pad>
        <Text numberOfLines={1} style={{ ...mono(400), fontSize: 13, lineHeight: 18, color: color("ink") }}>
          {url}
        </Text>
      </Section>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button label="Deel link" icon="share-outline" tone="primary" grow onPress={onShare} />
        <Button label="Kopieer" icon="link-outline" grow onPress={onCopy} />
      </View>

      {copyHint ? (
        <Note center tone="ink">
          ✓ {copyHint}
        </Note>
      ) : null}
    </SubPage>
  );
}
