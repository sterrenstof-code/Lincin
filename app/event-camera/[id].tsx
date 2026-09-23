import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Button, IconBtn, labelStyle, Panel, titleStyle, bodyStyle } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import { contributeToEvent } from "@/lib/api/events";
import { color, ON_DARK, ON_LIGHT, useThemeSpec, type LincinTheme } from "@/lib/design/theme";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";

/**
 * Full-screen camera. Tap shutter → preview verschijnt met Plaats /
 * Opnieuw knoppen. Plaats uploadt en keert terug naar live view voor de
 * volgende foto (Once-stijl rapid contribute).
 *
 * Geen SubPage: het beeld is de pagina. Alleen de knoppen erop volgen het
 * thema — vierkant in kleur, rond in magazine en modern — en alles op het
 * beeld staat in ON_DARK op een donkere waas, in elke stand.
 */
export default function EventCameraScreen() {
  usePageTitle("Foto toevoegen");
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = id!;
  const { session } = useAuth();
  const myUserId = session!.user.id;

  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>("back");
  const [flash, setFlash] = useState<"off" | "on">("off");
  const [preview, setPreview] = useState<{ uri: string; mimeType?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  // ---------- handlers ----------

  async function onShutter() {
    if (sending || preview) return;
    setError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({
        quality: 0.85,
        skipProcessing: false,
      });
      if (!photo?.uri) return;
      setPreview({ uri: photo.uri });
    } catch (e: any) {
      setError(e?.message ?? "Kon geen foto maken.");
    }
  }

  async function onSend() {
    if (!preview) return;
    setSending(true);
    setError(null);
    try {
      await contributeToEvent({
        eventId,
        userId: myUserId,
        imageUri: preview.uri,
        mimeType: preview.mimeType ?? "image/jpeg",
      });
      await qc.invalidateQueries({ queryKey: ["event-contributions", eventId] });
      await qc.invalidateQueries({ queryKey: ["event", eventId] });
      setPreview(null);
      flashToast("✓ Geplaatst");
    } catch (e: any) {
      setError(e?.message ?? "Kon foto niet uploaden.");
    } finally {
      setSending(false);
    }
  }

  function flashToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 1600);
  }

  function flipCamera() {
    setFacing((f) => (f === "back" ? "front" : "back"));
  }

  function toggleFlash() {
    setFlash((f) => (f === "off" ? "on" : "off"));
  }

  const th = useThemeSpec().id;

  // ---------- render ----------

  if (!permission) {
    return (
      <View style={{ flex: 1, backgroundColor: ON_LIGHT, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={ON_DARK} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: color("paper") }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 }}>
          <IconBtn icon="close" label="Sluiten" onPress={() => safeBack(router, `/event/${eventId}`)} />
          <Text style={labelStyle(th, 10, color("ink", "inkDim"))}>Camera</Text>
        </View>
        <View style={{ flex: 1, paddingHorizontal: 24, alignItems: "center", justifyContent: "center" }}>
          <Panel style={{ width: "100%", maxWidth: 440, padding: 28, alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: th === "kleur" ? 0 : 28,
                borderWidth: th === "kleur" ? 1.5 : 1,
                borderColor: th === "kleur" ? color("ink") : color("ink", "postRule"),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="camera-outline" color={color("ink")} size={24} />
            </View>
            <Text style={[titleStyle(th, 26), { textAlign: "center" }]}>Camera-toegang nodig</Text>
            {/**
              * Twee verschillende doodlopende wegen, en er stond er maar één.
              *
              * `canAskAgain` werd nergens gelezen. Heb je één keer geweigerd,
              * dan doet "Geef toegang" niets meer — het systeem stelt de vraag
              * niet nog eens — en dan is dit scherm een knop die je blijft
              * indrukken terwijl er niets gebeurt. Precies het gedrag dat een
              * app kapot laat lijken.
              *
              * En de uitleg ernaast stond alleen op iOS. Op Android en op web
              * was het een lége string, dus de zin eindigde na "voor dit
              * event." en er werd nergens gezegd wáár je het dan wél aanzet.
              */}
            <Text style={[bodyStyle(th, 13.5, color("ink", "inkDim")), { textAlign: "center" }]}>
              {permission.canAskAgain
                ? "Geef Lincin toegang om foto's te maken voor dit event. De foto's gaan alleen naar de gasten van dit event."
                : Platform.OS === "web"
                  ? "Je browser heeft de camera geblokkeerd voor deze site. Klik op het slotje in de adresbalk en zet camera weer op \"toestaan\"."
                  : "Je hebt de camera eerder geweigerd, dus de app mag het niet nog eens vragen. Zet hem aan in de instellingen van je toestel."}
            </Text>
            {/* Wat de knop kán doen hangt af van welke van de twee het is.
                Op web bestaat `openSettings` niet — daar zit de schakelaar in
                de browser en niet in het besturingssysteem — dus daar blijft
                alleen de uitleg over. */}
            {permission.canAskAgain ? (
              <Button label="Geef toegang" icon="camera-outline" tone="primary" onPress={requestPermission} style={{ marginTop: 6 }} />
            ) : Platform.OS !== "web" ? (
              <Button
                label="Open instellingen"
                icon="settings-outline"
                tone="primary"
                onPress={() => {
                  Linking.openSettings().catch(() => {});
                }}
                style={{ marginTop: 6 }}
              />
            ) : null}
          </Panel>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: ON_LIGHT }}>
      <CameraView
        ref={cameraRef}
        style={{ flex: 1 }}
        facing={facing}
        // @ts-ignore — flash is supported but typed inconsistently across platforms
        flash={flash}
      />

      {/* Top controls */}
      <SafeAreaView
        edges={["top"]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
        }}
        pointerEvents="box-none"
      >
        <View
          style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12 }}
          pointerEvents="box-none"
        >
          <OverlayBtn icon="close" label="Camera sluiten" onPress={() => safeBack(router, `/event/${eventId}`)} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <OverlayBtn
              icon={flash === "on" ? "flash" : "flash-off"}
              label={flash === "on" ? "Flits uitzetten" : "Flits aanzetten"}
              onPress={toggleFlash}
              iconSize={20}
            />
            <OverlayBtn icon="camera-reverse-outline" label="Wisselen tussen voor- en achtercamera" onPress={flipCamera} />
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom shutter */}
      <SafeAreaView
        edges={["bottom"]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
        pointerEvents="box-none"
      >
        <View style={{ alignItems: "center", paddingBottom: 24, paddingTop: 32 }} pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Foto maken"
            onPress={onShutter}
            disabled={sending || !!preview}
            style={{
              width: 80,
              height: 80,
              borderRadius: round(th, 40),
              backgroundColor: ON_DARK,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: ON_LIGHT,
              shadowOpacity: 0.4,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <View style={{ width: 64, height: 64, borderRadius: round(th, 32), backgroundColor: ON_DARK, borderWidth: 2, borderColor: ON_LIGHT }} />
          </Pressable>
          <Text style={[labelStyle(th, 9.5, ON_DARK), ON_IMAGE_SHADOW, { marginTop: 12 }]}>Tik om een foto te maken</Text>
        </View>
      </SafeAreaView>

      {/* Toast */}
      {toast && (
        <View style={{ pointerEvents: "none", position: "absolute", top: 80, left: 0, right: 0, alignItems: "center" }}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: round(th, 999), overflow: "hidden" }}>
            <Scrim strength={0.8} />
            <Text style={labelStyle(th, 10, ON_DARK)}>{toast}</Text>
          </View>
        </View>
      )}

      {/* Preview overlay (na shutter) */}
      {preview && (
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: ON_LIGHT,
          }}
        >
          <Image
            source={{ uri: preview.uri }}
            style={{ flex: 1 }}
            contentFit="cover"
            transition={0}
          />

          <SafeAreaView
            edges={["top"]}
            style={{ position: "absolute", top: 0, left: 0, right: 0 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
              <OverlayBtn icon="close" label="Sluiten" onPress={() => setPreview(null)} disabled={sending} />
            </View>
          </SafeAreaView>

          <SafeAreaView
            edges={["bottom"]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
          >
            <View style={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 16, flexDirection: "row", gap: 12 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Opnieuw"
                onPress={() => setPreview(null)}
                disabled={sending}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 54,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  borderRadius: round(th, 27),
                  borderWidth: th === "kleur" ? 1.5 : 1,
                  borderColor: ON_DARK,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Scrim />
                <Text style={labelStyle(th, 10.5, ON_DARK)}>Opnieuw</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Plaats"
                onPress={onSend}
                disabled={sending}
                style={({ pressed }) => ({
                  flex: 1.4,
                  height: 54,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  borderRadius: round(th, 27),
                  // De hoofdactie: zuurgeel in kleur, licht op het beeld elders.
                  backgroundColor: th === "kleur" ? color("acid") : ON_DARK,
                  borderWidth: th === "kleur" ? 1.5 : 0,
                  borderColor: ON_LIGHT,
                  opacity: sending ? 0.7 : pressed ? 0.85 : 1,
                })}
              >
                {sending ? (
                  <ActivityIndicator color={ON_LIGHT} />
                ) : (
                  <>
                    <Ionicons name="checkmark" color={ON_LIGHT} size={18} />
                    <Text style={labelStyle(th, 10.5, ON_LIGHT)}>Plaats</Text>
                  </>
                )}
              </Pressable>
            </View>
          </SafeAreaView>

          {error && <ErrorStrip th={th} text={error} />}
        </View>
      )}

      {error && !preview && <ErrorStrip th={th} text={error} passThrough />}
    </View>
  );
}

/** Rond in magazine en modern, vierkant in kleur. */
function round(th: LincinTheme, r: number): number {
  return th === "kleur" ? 0 : r;
}

/** Tekst direct op het camerabeeld: een zachte schaduw houdt hem leesbaar. */
const ON_IMAGE_SHADOW = {
  textShadowColor: ON_LIGHT,
  textShadowRadius: 6,
  textShadowOffset: { width: 0, height: 1 },
} as const;

/**
 * De donkere waas onder een knop op het beeld. Een laag met een eigen
 * dekking, zodat het icoon erboven vol ON_DARK blijft.
 */
function Scrim({ strength = 0.6 }: { strength?: number }) {
  return (
    <View
      style={{
        pointerEvents: "none",
        position: "absolute",
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        backgroundColor: ON_LIGHT,
        opacity: strength,
      }}
    />
  );
}

/** Een knopje op het camerabeeld: ON_DARK op een waas. */
function OverlayBtn({
  icon,
  label,
  onPress,
  disabled = false,
  iconSize = 22,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  iconSize?: number;
}) {
  const th = useThemeSpec().id;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: 44,
        height: 44,
        borderRadius: round(th, 22),
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: th === "kleur" ? 1.5 : 0,
        borderColor: ON_DARK,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Scrim />
      <Ionicons name={icon} color={ON_DARK} size={iconSize} />
    </Pressable>
  );
}

/** Wat er misging, boven de knoppen op het beeld. */
function ErrorStrip({ th, text, passThrough = false }: { th: LincinTheme; text: string; passThrough?: boolean }) {
  return (
    <View style={{ pointerEvents: passThrough ? "none" : "auto", position: "absolute", bottom: 140, left: 24, right: 24 }}>
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 12,
          overflow: "hidden",
          borderRadius: th === "modern" ? 14 : 0,
          borderLeftWidth: 4,
          borderLeftColor: color("red"),
        }}
      >
        <Scrim strength={0.85} />
        <Text style={{ ...bodyStyle(th, 13, ON_DARK), textAlign: "center" }}>{text}</Text>
      </View>
    </View>
  );
}
