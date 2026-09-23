import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Text, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { columnWidth } from "@/components/lincin/Chrome";
import { Button, labelStyle, Note, Panel, SubPage, titleStyle } from "@/components/lincin/SubPage";
import { VerticalLabel } from "@/components/lincin/ui";
import { RequireSession } from "@/components/RequireSession";
import { useAuth } from "@/lib/auth/provider";
import { getProfile } from "@/lib/api/profiles";
import { buildAddFriendUrl, copyToClipboard, shareText } from "@/lib/share";
import { color, friendColor, hueFor, ON_DARK, ON_LIGHT, RASTER, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { serif } from "@/lib/design/type";
import { usePageTitle } from "@/lib/page-title";

/**
 * Jouw linc: je QR-code en je eigen link, in de vorm van het thema
 * (components/lincin/SubPage).
 *
 *   kleur     de code in een kader van inkt, je naam in kapitaal eronder
 *   magazine  een kleurvlak in jouw kleur als poster: de rail met je
 *             handle, je naam groot in serif, de code erin
 *   modern    een tegel met de code op een afgerond wit vlak
 *
 * DE CODE ZELF kleurt nooit mee. Ze staat altijd donker op licht
 * (ON_LIGHT op ON_DARK) met een stille zone eromheen, ook in de donkere
 * stand en op een gekleurd vlak — anders leest een camera haar niet.
 */

const QR_MAX = 260;
/** De stille zone rond de code: ruim meer dan de vier modules die de norm vraagt. */
const QUIET = 18;

function QRCodeScreenBody() {
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const th = useThemeSpec().id;
  const { width } = useWindowDimensions();

  const [copyHint, setCopyHint] = useState<string | null>(null);

  const profile = useQuery({
    queryKey: ["profile", myUserId],
    queryFn: () => getProfile(myUserId),
  });

  const username = profile.data?.username ?? "";
  const displayName = profile.data?.display_name;
  const heroName = displayName ?? username;
  const addUrl = username ? buildAddFriendUrl(username) : "";

  function flashHint(text: string) {
    setCopyHint(text);
    setTimeout(() => setCopyHint(null), 1600);
  }

  /**
   * Kopiëren en delen zeggen allebei óf het gelukt is.
   *
   * `lib/share.ts` geeft nadrukkelijk een uitkomst terug — `"shared"`,
   * `"copied"`, `"cancelled"`, `"failed"` — en beide functies keken alleen
   * naar één van de vier. Bij `"failed"` (een klembord dat geweigerd wordt,
   * een browser zonder rechten) gebeurde er dus letterlijk niets: je tikt op
   * "Kopieer link", er verschijnt geen bevestiging, en je weet niet of er nu
   * wel of niet iets in je klembord staat. Dan plak je het en dan blijkt het.
   *
   * `"cancelled"` blijft stil — dat is een keuze van de gebruiker en geen
   * mislukking.
   */
  async function onCopyUrl() {
    if (!addUrl) return;
    flashHint(
      (await copyToClipboard(addUrl))
        ? "Link gekopieerd"
        : "Kopiëren lukte niet — de link staat hieronder."
    );
  }

  async function onShare() {
    if (!addUrl) return;
    const r = await shareText({
      title: "Voeg me toe op Lincin",
      message: `Voeg me toe op Lincin: ${addUrl}`,
    });
    if (r === "copied") flashHint("Link gekopieerd");
    else if (r === "failed") flashHint("Delen lukte niet — de link staat hieronder.");
  }

  // De code past altijd in de kolom: het blad, min de marges, het vlak,
  // de stille zone en (magazine) de rail.
  const qrSize = Math.max(170, Math.min(QR_MAX, columnWidth(width) - 2 * QUIET - (th === "magazine" ? 90 : 84)));
  const code = (
    <QrPlate size={qrSize} radius={th === "modern" ? 14 : 0} border={th === "kleur"}>
      {addUrl ? (
        <QRCode
          value={addUrl}
          size={qrSize}
          color={ON_LIGHT}
          backgroundColor={ON_DARK}
          logo={require("../assets/images/icon.png")}
          logoSize={Math.round(qrSize * 0.21)}
          logoBackgroundColor={ON_DARK}
          logoBorderRadius={12}
          logoMargin={4}
          ecl="H"
        />
      ) : (
        <View style={{ width: qrSize, height: qrSize }} />
      )}
    </QrPlate>
  );

  return (
    <SubPage
      // Magazine: de poster hieronder ís de kop.
      title={th === "magazine" ? null : "Jouw linc"}
      kicker="Jij"
      sub={th === "magazine" ? undefined : "Laat een vriend deze code scannen, of stuur je link."}
      back="/(app)/profile"
      tab="you"
      hue={hueFor(myUserId)}
    >
      {th === "magazine" ? (
        <Poster name={heroName || "…"} handle={`@${username || "…"}`} hue={hueFor(myUserId)}>
          {code}
        </Poster>
      ) : (
        <Panel style={{ padding: th === "modern" ? RASTER.tilePadLarge : 18, alignItems: "center", gap: 14 }}>
          {code}
          <View style={{ alignItems: "center", gap: 6 }}>
            <Text style={[titleStyle(th, 30), { textAlign: "center" }]}>{heroName || "…"}</Text>
            <Text style={labelStyle(th, 10, color("ink", "inkDim"))}>@{username || "…"}</Text>
          </View>
        </Panel>
      )}

      <View style={{ flexDirection: "row", gap: th === "kleur" ? 8 : RASTER.seam }}>
        <Button label="Deel link" tone="primary" icon="share-outline" grow onPress={onShare} />
        <Button label="Kopieer link" icon="link-outline" grow onPress={onCopyUrl} />
      </View>

      {copyHint ? <Note tone="ink" center>✓ {copyHint}</Note> : null}

      {addUrl ? (
        <Text selectable style={[labelStyle(th, 9.5, color("ink", "inkDim")), { textTransform: "none", textAlign: "center" }]}>
          {addUrl}
        </Text>
      ) : null}
    </SubPage>
  );
}

/**
 * Het lichte vlak onder de code: altijd licht, met een stille zone. Kleur
 * geeft het een kader van inkt, modern een ronding.
 */
function QrPlate({ size, radius, border, children }: { size: number; radius: number; border: boolean; children: ReactNode }) {
  const spec = useThemeSpec();
  return (
    <View
      style={{
        width: size + 2 * QUIET + (border ? 2 * spec.border : 0),
        padding: QUIET,
        backgroundColor: ON_DARK,
        borderRadius: radius,
        borderWidth: border ? spec.border : 0,
        borderColor: color("ink"),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </View>
  );
}

/**
 * Magazine: een kleurvlak in jouw kleur, als een spread op de voorpagina —
 * de rail met je handle, je naam groot in serif, de code eronder.
 */
function Poster({ name, handle, hue, children }: { name: string; handle: string; hue: Hue; children: ReactNode }) {
  const fc = friendColor(hue, useScheme());
  const [h, setH] = useState(420);
  return (
    <View style={{ backgroundColor: fc.fill, flexDirection: "row" }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <View style={{ width: RASTER.rail, overflow: "hidden" }}>
        <VerticalLabel text={`Jouw linc · ${handle}`} width={RASTER.rail} height={h} color={fc.ink} style={{ letterSpacing: 1.9, textTransform: "uppercase" }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingTop: 26, paddingBottom: 24, paddingRight: 20, paddingLeft: 6, gap: 18 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ ...serif(), fontSize: 50, lineHeight: 48, letterSpacing: -1.5, color: fc.ink }}>{name}</Text>
          <Text style={{ ...serif(true), fontSize: 19, lineHeight: 24, color: fc.ink, opacity: 0.86 }}>{handle}</Text>
        </View>
        <View style={{ alignItems: "flex-start" }}>{children}</View>
        <Text style={{ ...serif(true), fontSize: 16, lineHeight: 21, color: fc.ink, opacity: 0.86 }}>
          Laat een vriend deze code scannen, of stuur je link.
        </Text>
      </View>
    </View>
  );
}

/**
 * Dit scherm leest `session!.user.id` en staat in de wortelstack, die niets
 * bewaakt — zie components/RequireSession.tsx voor waarom dat een wit scherm
 * opleverde in plaats van een inlogpagina.
 */
export default function QRCodeScreen() {
  usePageTitle("Jouw linc");
  return (
    <RequireSession>
      <QRCodeScreenBody />
    </RequireSession>
  );
}
