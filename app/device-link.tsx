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

import { RequireSession } from "@/components/RequireSession";
import { useAuth } from "@/lib/auth/provider";
import { FormError } from "@/components/FormError";
import { safeBack } from "@/lib/nav";
import {
  cancelTransferPackage,
  createTransferPackage,
  type TransferPackage,
} from "@/lib/crypto/transfer";
import { copyToClipboard } from "@/lib/share";
import { desk, feed, flameDeep } from "@/lib/design/type";

const EXPIRY_SECS = 600;

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

  return (
    <SafeAreaView className="flex-1 bg-desk">
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-2">
        <Pressable
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
          onPress={onClose}
          className="w-9 h-9 bg-paper-soft items-center justify-center"
        >
          <Ionicons name="close" color={feed.ink} size={20} />
        </Pressable>
        <Text className="text-ink text-lg font-bold ml-3">
          Nieuw apparaat koppelen
        </Text>
      </View>

      <View className="flex-1 items-center justify-center px-6">
        {loading ? (
          <ActivityIndicator color={desk.ink} size="large" />
        ) : error ? (
          <View className="items-center gap-4">
            <FormError tone="desk">{error}</FormError>
            <Pressable
              onPress={generate}
              className="bg-paper-soft active:bg-paper px-6 py-3"
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
            <View className="bg-paper p-5 mb-5 shadow-sm">
              <QRCode
                value={pkg.url}
                size={220}
                backgroundColor="transparent"
                color={feed.ink}
              />
            </View>

            {/* Afteltimer, en op nul een knop in plaats van een nieuwe code
                die er stilletjes voor in de plaats komt. Zie `generate`. */}
            <View className="flex-row items-center gap-2 mb-5">
              <Ionicons
                name={secondsLeft === 0 ? "alert-circle-outline" : "time-outline"}
                color={secondsLeft === 0 ? flameDeep : feed.inkDim}
                size={15}
              />
              {secondsLeft === 0 ? (
                <Text className="text-sm" style={{ color: flameDeep }}>
                  Deze code is verlopen.
                </Text>
              ) : (
                <Text className="text-ink-muted text-sm">
                  Verloopt over{" "}
                  <Text className="text-ink font-semibold">
                    {mins}:{secs.toString().padStart(2, "0")}
                  </Text>
                </Text>
              )}
            </View>

            {secondsLeft === 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Maak een nieuwe code"
                onPress={generate}
                className="bg-ink active:bg-ink-soft px-6 py-3 mb-5"
              >
                <Text className="text-cream font-semibold">Nieuwe code</Text>
              </Pressable>
            ) : null}

            {/* Kopieerknop — voor desktop-browsers die geen camera-QR-scan hebben */}
            <Pressable
              onPress={onCopy}
              className="flex-row items-center bg-paper-soft active:bg-paper px-5 py-3.5 mb-3"
            >
              <Ionicons
                name={copied ? "checkmark-circle" : "link-outline"}
                color={copied ? "#4CAF82" : feed.ink}
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

            {/* Stond er als "na 10 minuten wordt automatisch een nieuwe code
                aangemaakt" — en dat is precies wat er niet meer gebeurt, want
                die stille vervanging maakte de link die je net doorstuurde
                dood zonder dat het scherm iets zei. */}
            <Text className="text-ink-muted text-xs text-center mt-4 leading-5 max-w-xs">
              De code werkt tien minuten. Daarna moet je zelf een nieuwe maken,
              zodat je weet dat de vorige niet meer werkt.
            </Text>
          </>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

/**
 * Dit scherm leest `session!.user.id` en staat in de wortelstack, die niets
 * bewaakt — zie components/RequireSession.tsx voor waarom dat een wit scherm
 * opleverde in plaats van een inlogpagina.
 */
export default function DeviceLinkScreen() {
  return (
    <RequireSession>
      <DeviceLinkScreenBody />
    </RequireSession>
  );
}
