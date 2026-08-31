import { Ionicons } from "@expo/vector-icons";
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

import { useAuth } from "@/lib/auth/provider";
import { contributeToEvent } from "@/lib/api/events";
import { creamOnDark, feed } from "@/lib/design/type";
import { safeBack } from "@/lib/nav";

/**
 * Full-screen camera met paper-cream shutter controls. Tap shutter →
 * preview verschijnt met Plaats / Opnieuw knoppen. Plaats uploadt en keert
 * terug naar live view voor de volgende foto (Once-stijl rapid contribute).
 */
export default function EventCameraScreen() {
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

  // ---------- render ----------

  if (!permission) {
    return (
      <View className="flex-1 bg-shell items-center justify-center">
        <ActivityIndicator color={creamOnDark.DEFAULT} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-shell">
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Sluiten"
            onPress={() => safeBack(router, `/event/${eventId}`)}
            className="w-9 h-9 bg-paper-soft items-center justify-center"
          >
            <Ionicons name="close" color={feed.ink} size={20} />
          </Pressable>
          <Text className="flex-1 text-cream text-lg font-semibold ml-3">
            Camera
          </Text>
        </View>
        <View className="flex-1 px-6 items-center justify-center">
          <View className="bg-paper p-8 w-full max-w-md items-center">
            <View className="w-14 h-14 bg-paper-warm items-center justify-center mb-3">
              <Ionicons name="camera-outline" color={feed.ink} size={24} />
            </View>
            <Text className="text-ink font-bold text-xl text-center mb-1">
              Camera-toegang nodig
            </Text>
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
            <Text className="text-ink-soft text-sm text-center mb-5 leading-5">
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Geef toegang"
                onPress={requestPermission}
                className="bg-ink active:bg-ink-soft px-6 py-3"
              >
                <Text className="text-cream font-semibold">Geef toegang</Text>
              </Pressable>
            ) : Platform.OS !== "web" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open de instellingen"
                onPress={() => {
                  Linking.openSettings().catch(() => {});
                }}
                className="bg-ink active:bg-ink-soft px-6 py-3"
              >
                <Text className="text-cream font-semibold">Open instellingen</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-shell">
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
        <View className="flex-row items-center justify-between px-4 py-3" pointerEvents="box-none">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Camera sluiten"
            onPress={() => safeBack(router, `/event/${eventId}`)}
            className="w-11 h-11 bg-shell/70 items-center justify-center"
          >
            <Ionicons name="close" color={creamOnDark.DEFAULT} size={22} />
          </Pressable>
          <View className="flex-row gap-2">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={flash === "on" ? "Flits uitzetten" : "Flits aanzetten"}
              onPress={toggleFlash}
              className="w-11 h-11 bg-shell/70 items-center justify-center"
            >
              <Ionicons
                name={flash === "on" ? "flash" : "flash-off"}
                color={creamOnDark.DEFAULT}
                size={20}
              />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Wisselen tussen voor- en achtercamera"
              onPress={flipCamera}
              className="w-11 h-11 bg-shell/70 items-center justify-center"
            >
              <Ionicons name="camera-reverse-outline" color={creamOnDark.DEFAULT} size={22} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* Bottom shutter */}
      <SafeAreaView
        edges={["bottom"]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
        pointerEvents="box-none"
      >
        <View className="items-center pb-6 pt-8" pointerEvents="box-none">
          <Pressable
            onPress={onShutter}
            disabled={sending || !!preview}
            className="w-20 h-20 bg-cream items-center justify-center"
            style={{
              borderWidth: 4,
              borderColor: "rgba(255,255,255,0.5)",
              shadowColor: "#000",
              shadowOpacity: 0.4,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <View className="w-16 h-16 bg-cream border-2 border-shell" />
          </Pressable>
          <Text className="text-cream-soft text-xs mt-3">
            Tik om een foto te maken
          </Text>
        </View>
      </SafeAreaView>

      {/* Toast */}
      {toast && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 80, left: 0, right: 0, alignItems: "center" }}
        >
          <View className="bg-shell/80 px-4 py-2">
            <Text className="text-cream text-sm font-semibold">{toast}</Text>
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
            backgroundColor: feed.ink,
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
            <View className="flex-row items-center px-4 py-3">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sluiten"
                onPress={() => setPreview(null)}
                disabled={sending}
                className="w-11 h-11 bg-shell/70 items-center justify-center"
              >
                <Ionicons name="close" color={creamOnDark.DEFAULT} size={22} />
              </Pressable>
            </View>
          </SafeAreaView>

          <SafeAreaView
            edges={["bottom"]}
            style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}
          >
            <View className="px-5 pb-6 pt-4 flex-row gap-3">
              <Pressable
                onPress={() => setPreview(null)}
                disabled={sending}
                className="flex-1 border border-cream-muted py-4 items-center"
              >
                <Text className="text-cream font-semibold">Opnieuw</Text>
              </Pressable>
              <Pressable
                onPress={onSend}
                disabled={sending}
                className={`flex-2 py-4 flex-row items-center justify-center ${
                  sending ? "bg-paper-warm" : "bg-cream active:bg-cream-soft"
                }`}
                style={{ flex: 1.4 }}
              >
                {sending ? (
                  <ActivityIndicator color={feed.ink} />
                ) : (
                  <>
                    <Ionicons name="checkmark" color={feed.ink} size={18} />
                    <Text className="text-ink font-bold ml-2">Plaats</Text>
                  </>
                )}
              </Pressable>
            </View>
          </SafeAreaView>

          {error && (
            <View
              style={{
                position: "absolute",
                bottom: 140,
                left: 24,
                right: 24,
              }}
            >
              <View className="bg-red-100 px-4 py-3">
                <Text className="text-red-800 text-sm text-center">{error}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      {error && !preview && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", bottom: 140, left: 24, right: 24 }}
        >
          <View className="bg-red-100 px-4 py-3">
            <Text className="text-red-800 text-sm text-center">{error}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
