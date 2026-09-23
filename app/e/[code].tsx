import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyStyle, Button, labelStyle, Panel, titleStyle } from "@/components/lincin/SubPage";
import { VerticalLabel } from "@/components/lincin/ui";
import { useAuth } from "@/lib/auth/provider";
import { rememberPendingInvite } from "@/lib/pending-invite";
import { joinEventByCode } from "@/lib/api/events";
import { color, friendColor, hueFor, RASTER, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { serif } from "@/lib/design/type";
import { usePageTitle } from "@/lib/page-title";

/**
 * Wat de `join_event`-RPC opwerpt, in taal die de ontvanger van een
 * uitnodiging kan lezen.
 *
 * De database spreekt in brokstukken — `event not found`, `event is vol` —
 * en die stonden hier rechtstreeks onder "Kon niet meedoen": een Engelse
 * regel in een Nederlands scherm, op de enige pagina die deze app naar
 * buiten stuurt. Wie hem niet kent, weet nog steeds niet of de link stuk
 * is of het feest vol. Onbekende meldingen worden bewust níet doorgegeven:
 * dan liever één zin die klopt dan een technische die niemand helpt.
 */
function joinErrorText(raw: unknown): string {
  const m = typeof raw === "string" ? raw.toLowerCase() : "";
  if (m.includes("not found")) {
    return "Deze uitnodiging bestaat niet meer. Vraag je gastheer om een nieuwe link.";
  }
  if (m.includes("vol")) {
    return "Dit event zit vol. Vraag je gastheer of er nog plek bij kan.";
  }
  if (m.includes("not authenticated")) {
    return "Je bent niet meer ingelogd. Log opnieuw in en open de link nog eens.";
  }
  return "Er ging iets mis bij het meedoen. Probeer de link straks opnieuw.";
}

/**
 * Landing voor /e/{join_code}: roept de join_event RPC aan.
 *
 * Bij een **open** event sta je meteen in de gastenlijst en sturen we door
 * naar /event/{id}. Bij een **gesloten** event is er nog niets om naartoe te
 * gaan — je verzoek staat bij de host — dus blijft dit scherm staan met de
 * uitleg. Bij niet-ingelogd: eerst naar login.
 *
 * Deze route staat buiten de sessiewacht (app/_layout.tsx): wie de link
 * opent is misschien nog niet ingelogd, of nog geen lid. Daarom geen
 * `SubPage` — die hangt aan `LincinScreen` met zijn kop en tabbladen —
 * maar een kaal blad in de papierkleur van het thema, met de onderdelen
 * uit de kit erop.
 */
export default function JoinEventScreen() {
  usePageTitle("Uitnodiging");
  const router = useRouter();
  const qc = useQueryClient();
  const { session, loading } = useAuth();
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = (raw ?? "").toString();

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) {
      /**
       * De code moet de reis naar het inloggen overleven.
       *
       * Hier stond `?event=CODE` in de URL, met de opmerking dat dat de
       * eenvoudige manier was. Alleen las niemand hem ooit uit: niet het
       * inlogscherm, niet `app/index.tsx`. Je kwam na het inloggen binnen op
       * een lege feed en het event waarvoor je uitgenodigd was, was weg — en
       * dat is nu net de enige link die deze app naar buiten stuurt.
       *
       * Een queryparameter kán die reis ook niet overleven: op web zit er
       * een bevestigingsmail en een terugkeer vanaf een ander adres tussen.
       * Zie lib/pending-invite.ts; `app/index.tsx` verzilvert hem zodra er
       * een sessie is.
       */
      rememberPendingInvite(code);
      router.replace("/(auth)/login");
      return;
    }
    (async () => {
      try {
        const result = await joinEventByCode(code);
        await qc.invalidateQueries({ queryKey: ["events", session.user.id] });
        if (result.status === "pending") {
          setPending(true);
          return;
        }
        router.replace(`/event/${result.eventId}`);
      } catch (e: any) {
        setError(joinErrorText(e?.message));
      }
    })();
  }, [code, loading, session, router, qc]);

  const insets = useSafeAreaInsets();
  const hue = hueFor(code);

  return (
    <View style={{ flex: 1, backgroundColor: color("paper"), paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
        <View style={{ width: "100%", maxWidth: 440 }}>
          {error ? (
            <InviteCard
              hue={hue}
              icon="alert-circle-outline"
              title="Kon niet meedoen"
              body={error}
              action={{ label: "Naar Lincin", onPress: () => router.replace("/(app)/feed") }}
            />
          ) : pending ? (
            <InviteCard
              hue={hue}
              icon="hourglass-outline"
              title="Verzoek verstuurd"
              body="Dit is een gesloten event. De organisator kreeg je verzoek en laat je binnen zodra hij het goedkeurt — je krijgt er een melding van."
              action={{ label: "Naar Lincin", onPress: () => router.replace("/(app)/events") }}
            />
          ) : (
            // "Je doet mee" was de standaardtak, dus hij stond er vóórdat
            // de RPC iets teruggegeven had — ook op het moment dat het
            // antwoord "je verzoek staat bij de host" of "dit event bestaat
            // niet" ging worden. Een scherm hoort geen uitkomst te melden
            // die het nog niet weet.
            <InviteCard
              hue={hue}
              icon="sparkles"
              title="Je aanmelding loopt"
              body="Even één moment — we kijken of dit event nog openstaat."
            />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * Het blok met de uitkomst.
 *
 *   kleur     een kader van inkt; het icoon op een vlak in de kleur,
 *             de kop in Archivo smal kapitaal, de knop zuurgeel.
 *   magazine  een volvlaks kleurvlak als een spread: rail met de kicker,
 *             de kop in serif, de uitleg cursief; de knop eronder.
 *   modern    een tegel, het icoon in een rondje in de kleur, pillen.
 */
function InviteCard({
  hue,
  icon,
  title,
  body,
  action,
}: {
  hue: Hue;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  action?: { label: string; onPress: () => void };
}) {
  const th = useThemeSpec().id;
  const scheme = useScheme();
  const fc = friendColor(hue, scheme);
  const button = action ? <Button label={action.label} tone="primary" onPress={action.onPress} /> : null;

  if (th === "magazine") {
    return (
      <View style={{ gap: RASTER.seam }}>
        <View style={{ backgroundColor: fc.fill, flexDirection: "row", minHeight: 240 }}>
          <View style={{ width: RASTER.rail, overflow: "hidden" }}>
            <VerticalLabel text="Uitnodiging" width={RASTER.rail} height={240} color={fc.ink} style={{ letterSpacing: 1.9, textTransform: "uppercase" }} />
          </View>
          <View style={{ flex: 1, minWidth: 0, paddingVertical: 22, paddingRight: 20, paddingLeft: 6, justifyContent: "flex-end", gap: 12 }}>
            <Ionicons name={icon} color={fc.ink} size={26} />
            <Text style={{ ...serif(), fontSize: 44, lineHeight: 44, letterSpacing: -1.2, color: fc.ink }}>{title}</Text>
            <Text style={{ ...serif(true), fontSize: 18, lineHeight: 24, color: fc.ink, opacity: 0.86 }}>{body}</Text>
          </View>
        </View>
        {button}
      </View>
    );
  }

  return (
    <Panel style={{ padding: th === "modern" ? RASTER.tilePadLarge : 24, gap: 14 }}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: th === "kleur" ? 0 : 28,
          backgroundColor: fc.fill,
          borderWidth: th === "kleur" ? 1.5 : 0,
          borderColor: color("ink"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} color={fc.ink} size={24} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={labelStyle(th, 10, color("ink", "inkDim"))}>Uitnodiging</Text>
        <Text style={titleStyle(th, 32)}>{title}</Text>
        <Text style={bodyStyle(th, 14, color("ink", "inkDim"))}>{body}</Text>
      </View>
      {button}
    </Panel>
  );
}
