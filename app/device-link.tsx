/**
 * Brontoestel: genereer QR-code voor apparaatkoppeling.
 * Geopend via Profiel → "Nieuw apparaat koppelen".
 */

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth/provider";
import {
  cancelTransferPackage,
  createTransferPackage,
  type TransferPackage,
} from "@/lib/crypto/transfer";
import { copyToClipboard } from "@/lib/share";

const EXPIRY_SECS = 600;

export default function DeviceLinkScreen() {
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
      // Afteltimer — auto-vernieuwen bij 0
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current!);
            generate();
            return EXPIRY_SECS;
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
    router.back();
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

  return (
    <SafeAreaView className="flex-1 bg-shell">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Pressable
          onPress={onClose}
          className="w-9 h-9 rounded-full bg-paper-soft items-center justify-center"
        >
          <Ionicons name="close" color="#1A1714" size={20} />
        </Pressable>
        <Text className="text-ink text-lg font-bold ml-3">
          Nieuw apparaat koppelen
        </Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {loading ? (
          <ActivityIndicator color="#F5E8D3" size="large" />
        ) : error ? (
          <View className="items-center gap-4">
            <Text className="text-red-400 text-sm text-center">{error}</Text>
            <Pressable
              onPress={generate}
              className="bg-paper-soft active:bg-paper rounded-2xl px-6 py-3"
            >
              <Text className="text-ink font-semibold">Opnieuw proberen</Text>
            </Pressable>
          </View>
        ) : pkg ? (
          <>
            <Text className="text-ink-soft text-sm text-center mb-6 leading-6 max-w-xs">
              Open Lincin op je nieuwe apparaat, log in met hetzelfde account
              en scan deze QR-code.
            </Text>

            {/* QR-code op paper achtergrond */}
            <View className="bg-paper rounded-3xl p-5 mb-5 shadow-sm">
              <QRCode
                value={pkg.url}
                size={220}
                backgroundColor="transparent"
                color="#1A1714"
              />
            </View>

            {/* Afteltimer */}
            <View className="flex-row items-center gap-2 mb-5">
              <Ionicons name="time-outline" color="#8A7E6C" size={15} />
              <Text className="text-ink-muted text-sm">
                Verloopt over{" "}
                <Text className="text-ink font-semibold">
                  {mins}:{secs.toString().padStart(2, "0")}
                </Text>
              </Text>
            </View>

            {/* Kopieerknop — voor desktop-browsers die geen camera-QR-scan hebben */}
            <Pressable
              onPress={onCopy}
              className="flex-row items-center bg-paper-soft active:bg-paper rounded-2xl px-5 py-3.5 mb-3"
            >
              <Ionicons
                name={copied ? "checkmark-circle" : "link-outline"}
                color={copied ? "#4CAF82" : "#1A1714"}
                size={18}
              />
              <Text className="text-ink font-semibold ml-2">
                {copied ? "Link gekopieerd" : "Kopieer link (voor desktop)"}
              </Text>
            </Pressable>

            {Platform.OS !== "web" && (
              <Text className="text-ink-muted text-xs text-center mt-2 leading-5 max-w-xs">
                Op desktop: kopieer de link en open hem in de browser van je nieuwe apparaat.
              </Text>
            )}

            <Text className="text-ink-muted text-xs text-center mt-4 leading-5 max-w-xs">
              Na 10 minuten wordt automatisch een nieuwe code aangemaakt.
            </Text>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
