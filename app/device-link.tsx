/**
 * Brontoestel: genereer QR-code voor apparaatkoppeling.
 * Geopend via Profiel → "Nieuw apparaat koppelen".
 *
 * DE VORM. De onderdelen van de subpagina (components/lincin/SubPage),
 * maar niet `SubPage` zelf: die zet een terugknop in de kop die alleen
 * terug navigeert. Hier moet sluiten óók het pakket intrekken
 * (`onClose` → `cancelTransferPackage`), dus het enige sluitknopje is het
 * eigen kruisje bovenaan, zonder terugknop, tabbalk of meldingen ernaast.
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Platform, ScrollView, Text, useWindowDimensions, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

import { columnWidth, LincinScreen, vfade } from "@/components/lincin/Chrome";
import { Button, IconBtn, labelStyle, Note, PageTitle, Panel } from "@/components/lincin/SubPage";
import { VerticalLabel } from "@/components/lincin/ui";
import { RequireSession } from "@/components/RequireSession";
import { useAuth } from "@/lib/auth/provider";
import { safeBack } from "@/lib/nav";
import {
  cancelTransferPackage,
  createTransferPackage,
  type TransferPackage,
} from "@/lib/crypto/transfer";
import { copyToClipboard } from "@/lib/share";
import { color, friendColor, ON_DARK, ON_LIGHT, RASTER, useScheme, useThemeSpec, type Hue } from "@/lib/design/theme";
import { mono, serif } from "@/lib/design/type";
import { usePageTitle } from "@/lib/page-title";

const EXPIRY_SECS = 600;
/** Dezelfde kleur als de kop van `PageTitle` (die valt terug op oranje). */
const HUE: Hue = "orange";
/** De stille zone rond de code: ruim meer dan de vier modules die de norm vraagt. */
const QUIET = 18;

function DeviceLinkScreenBody() {
  const { session } = useAuth();
  const router = useRouter();
  const [pkg, setPkg] = useState<TransferPackage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECS);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    generate();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generate() {
    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(true);
    setError(null);
    try {
      const result = await createTransferPackage(session!.user.id);
      setPkg(result);
      setSecondsLeft(EXPIRY_SECS);
      /**
       * Aftellen, en op nul stóppen in plaats van stilletjes vernieuwen.
       *
       * Hij maakte bij 0:00 vanzelf een nieuw pakket aan. Dat leek
       * behulpzaam en was het tegenovergestelde: de link die je net
       * gekopieerd en in een bericht geplakt had, was op dat moment dood —
       * zonder dat er iets veranderde aan wat je op het scherm zag, want er
       * stond gewoon weer 10:00. De ontvanger kreeg "ongeldig pakket" en jij
       * had geen idee waarom.
       *
       * Nu loopt hij af en zegt het. Een nieuwe link is één tik, en dan
       * weet je ook dat de vorige niet meer werkt.
       */
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (e: any) {
      setError(e?.message ?? "Kon pakket niet aanmaken.");
    } finally {
      setLoading(false);
    }
  }

  async function onClose() {
    if (timerRef.current) clearInterval(timerRef.current);
    await cancelTransferPackage(session!.user.id).catch(() => {});
    safeBack(router, "/(app)/profile");
  }

  async function onCopy() {
    if (!pkg) return;
    const ok = await copyToClipboard(pkg.url);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  const spec = useThemeSpec();
  const th = spec.id;
  const scheme = useScheme();
  const { width } = useWindowDimensions();
  const pad = th === "kleur" ? 18 : RASTER.seam;
  const dim = color("ink", "inkDim");
  const expired = secondsLeft === 0;
  const qrSize = Math.max(170, Math.min(220, columnWidth(width) - 2 * QUIET - 90));

  const timer = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name={expired ? "alert-circle-outline" : "time-outline"} color={expired ? color("red") : dim} size={15} />
      {expired ? (
        <Text style={labelStyle(th, 10, color("red"))}>Deze code is verlopen.</Text>
      ) : (
        <Text style={labelStyle(th, 10, dim)}>
          Verloopt over{" "}
          <Text style={{ ...mono(600), color: color("ink") }}>
            {mins}:{secs.toString().padStart(2, "0")}
          </Text>
        </Text>
      )}
    </View>
  );

  const code = pkg ? (
    // De code staat altijd donker op licht, met een stille zone — ook in de
    // donkere stand en op het kleurvlak van magazine. Anders leest de
    // camera van het nieuwe toestel haar niet.
    <View
      style={{
        padding: QUIET,
        backgroundColor: ON_DARK,
        borderRadius: th === "modern" ? 14 : 0,
        borderWidth: th === "kleur" ? spec.border : 0,
        borderColor: color("ink"),
        opacity: expired ? 0.25 : 1,
      }}
    >
      <QRCode value={pkg.url} size={qrSize} backgroundColor={ON_DARK} color={ON_LIGHT} />
    </View>
  ) : null;

  const intro = "Open Lincin op je nieuwe apparaat, log in met hetzelfde account en scan deze QR-code.";

  return (
    <LincinScreen tab="you" back={null} tabs={false} actions={false} header="none" tint={friendColor(HUE, scheme).fill}>
      <ScrollView style={[{ flex: 1 }, vfade()]} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: pad, paddingTop: th === "kleur" ? 8 : SEAM_TOP, gap: th === "kleur" ? 16 : RASTER.seam }}>
          {/* Het kruisje: sluiten trekt het pakket in (zie `onClose`). */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingHorizontal: th === "kleur" ? 0 : 12 }}>
            <IconBtn icon="close" label="Sluiten" tone="ink" onPress={onClose} />
            <Text style={labelStyle(th, 10, dim)}>Toestel koppelen</Text>
          </View>

          <PageTitle kicker="Beveiliging" title="Nieuw apparaat koppelen" sub={th === "magazine" ? undefined : intro} />

          {loading ? (
            <View style={{ paddingVertical: 48, alignItems: "center" }}>
              <ActivityIndicator color={color("ink")} size="large" />
            </View>
          ) : error ? (
            <Panel style={{ padding: 16, gap: 12 }}>
              <Note tone="red">{error}</Note>
              <Button label="Opnieuw proberen" icon="refresh" onPress={generate} />
            </Panel>
          ) : pkg ? (
            <>
              {th === "magazine" ? (
                <Poster hue={HUE} rail={expired ? "Verlopen" : `Code · ${mins}:${secs.toString().padStart(2, "0")}`} intro={intro}>
                  {code}
                </Poster>
              ) : (
                <Panel style={{ padding: th === "modern" ? RASTER.tilePadLarge : 18, alignItems: "center", gap: 16 }}>
                  {code}
                  {timer}
                </Panel>
              )}

              {th === "magazine" ? <Panel style={{ padding: 14, borderLeftWidth: 5, borderLeftColor: friendColor(HUE, scheme).fill }}>{timer}</Panel> : null}

              {/* Afteltimer, en op nul een knop in plaats van een nieuwe code
                  die er stilletjes voor in de plaats komt. Zie `generate`. */}
              {expired ? (
                <Button label="Nieuwe code" tone="primary" icon="refresh" onPress={generate} />
              ) : null}

              {/* Kopieerknop — voor desktop-browsers die geen camera-QR-scan hebben */}
              <Button
                label={copied ? "Link gekopieerd" : "Kopieer link (voor desktop)"}
                icon={copied ? "checkmark-circle" : "link-outline"}
                onPress={onCopy}
              />

              {Platform.OS !== "web" && (
                <Note center>Op desktop: kopieer de link en open hem in de browser van je nieuwe apparaat.</Note>
              )}

              {/* Stond er als "na 10 minuten wordt automatisch een nieuwe code
                  aangemaakt" — en dat is precies wat er niet meer gebeurt, want
                  die stille vervanging maakte de link die je net doorstuurde
                  dood zonder dat het scherm iets zei. */}
              <Note center>
                De code werkt tien minuten. Daarna moet je zelf een nieuwe maken,
                zodat je weet dat de vorige niet meer werkt.
              </Note>
            </>
          ) : null}
        </View>
      </ScrollView>
    </LincinScreen>
  );
}

/** De bovenmarge in magazine en modern: de naad, zoals in `SubPage`. */
const SEAM_TOP = RASTER.seam;

/**
 * Magazine: de code op een kleurvlak, zoals een spread — de rail met de
 * resterende tijd, een cursieve regel uitleg, en de code op haar lichte
 * plaat.
 */
function Poster({ hue, rail, intro, children }: { hue: Hue; rail: string; intro: string; children: ReactNode }) {
  const fc = friendColor(hue, useScheme());
  const [h, setH] = useState(380);
  return (
    <View style={{ backgroundColor: fc.fill, flexDirection: "row" }} onLayout={(e) => setH(e.nativeEvent.layout.height)}>
      <View style={{ width: RASTER.rail, overflow: "hidden" }}>
        <VerticalLabel text={rail} width={RASTER.rail} height={h} color={fc.ink} style={{ letterSpacing: 1.9, textTransform: "uppercase" }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: 22, paddingRight: 20, paddingLeft: 6, gap: 16 }}>
        <Text style={{ ...serif(true), fontSize: 18, lineHeight: 23, color: fc.ink, opacity: 0.9 }}>{intro}</Text>
        <View style={{ alignItems: "flex-start" }}>{children}</View>
      </View>
    </View>
  );
}

/**
 * Dit scherm leest `session!.user.id` en staat in de wortelstack, die niets
 * bewaakt — zie components/RequireSession.tsx voor waarom dat een wit scherm
 * opleverde in plaats van een inlogpagina.
 */
export default function DeviceLinkScreen() {
  usePageTitle("Toestel koppelen");
  return (
    <RequireSession>
      <DeviceLinkScreenBody />
    </RequireSession>
  );
}
