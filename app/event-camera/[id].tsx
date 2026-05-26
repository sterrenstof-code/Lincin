import { Ionicons } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { CameraView, useCameraPermissions, type CameraType } from "expo-camera";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth/provider";
import { contributeToEvent } from "@/lib/api/events";

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
        <ActivityIndicator color="#F5E8D3" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-shell">
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
          >
            <Ionicons name="close" color="#1A1714" size={20} />
          </Pressable>
          <Text className="flex-1 text-cream text-lg font-semibold ml-3">
            Camera
          </Text>
        </View>
        <View className="flex-1 px-6 items-center justify-center">
          <View className="bg-paper rounded-3xl p-8 w-full max-w-md items-center">
            <View className="w-14 h-14 rounded-full bg-paper-warm items-center justify-center mb-3">
              <Ionicons name="camera-outline" color="#1A1714" size={24} />
            </View>
            <Text className="text-ink font-bold text-xl text-center mb-1">
              Camera-toegang nodig
            </Text>
            <Text className="text-ink-soft text-sm text-center mb-5 leading-5">
              Geef Lincin toegang om foto's te maken voor dit event.
              {Platform.OS === "ios"
                ? " Op iOS kan je dit aanpassen in Instellingen → Lincin."
                : ""}
            </Text>
            <Pressable
              onPress={requestPermission}
              className="bg-ink active:bg-ink-soft rounded-full px-6 py-3"
            >
              <Text className="text-cream font-semibold">Geef toegang</Text>
            </Pressable>
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
            onPress={() => router.back()}
            className="w-11 h-11 rounded-full bg-shell/70 items-center justify-center"
          >
            <Ionicons name="close" color="#F5E8D3" size={22} />
          </Pressable>
          <View className="flex-row gap-2">
            <Pressable
              onPress={toggleFlash}
              className="w-11 h-11 rounded-full bg-shell/70 items-center justify-center"
            >
              <Ionicons
                name={flash === "on" ? "flash" : "flash-off"}
                color="#F5E8D3"
                size={20}
              />
            </Pressable>
            <Pressable
              onPress={flipCamera}
              className="w-11 h-11 rounded-full bg-shell/70 items-center justify-center"
            >
              <Ionicons name="camera-reverse-outline" color="#F5E8D3" size={22} />
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
            className="w-20 h-20 rounded-full bg-cream items-center justify-center"
            style={{
              borderWidth: 4,
              borderColor: "rgba(255,255,255,0.5)",
              shadowColor: "#000",
              shadowOpacity: 0.4,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <View className="w-16 h-16 rounded-full bg-cream border-2 border-shell" />
          </Pressable>
          <Text className="text-cream-soft text-xs mt-3">
            Tap om foto te maken
          </Text>
        </View>
      </SafeAreaView>

      {/* Toast */}
      {toast && (
        <View
          pointerEvents="none"
          style={{ position: "absolute", top: 80, left: 0, right: 0, alignItems: "center" }}
        >
          <View className="bg-shell/80 rounded-full px-4 py-2">
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
            backgroundColor: "#0A0A0B",
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
                onPress={() => setPreview(null)}
                disabled={sending}
                className="w-11 h-11 rounded-full bg-shell/70 items-center justify-center"
              >
                <Ionicons name="close" color="#F5E8D3" size={22} />
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
                className="flex-1 border border-cream-muted rounded-full py-4 items-center"
              >
                <Text className="text-cream font-semibold">Opnieuw</Text>
              </Pressable>
              <Pressable
                onPress={onSend}
                disabled={sending}
                className={`flex-2 rounded-full py-4 flex-row items-center justify-center ${
                  sending ? "bg-paper-warm" : "bg-cream active:bg-cream-soft"
                }`}
                style={{ flex: 1.4 }}
              >
                {sending ? (
                  <ActivityIndicator color="#1A1714" />
                ) : (
                  <>
                    <Ionicons name="checkmark" color="#1A1714" size={18} />
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
              <View className="bg-red-100 rounded-2xl px-4 py-3">
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
          <View className="bg-red-100 rounded-2xl px-4 py-3">
            <Text className="text-red-800 text-sm text-center">{error}</Text>
          </View>
        </View>
      )}
    </View>
  );
}
