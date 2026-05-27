import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Toont een waarschuwingsscherm wanneer een gebruiker inlogt op een nieuw
 * apparaat dat geen lokale keys heeft, terwijl het profiel al een andere
 * pubkey heeft (= account was eerder actief op een ander apparaat).
 *
 * Drie opties:
 *  - Koppel via ander apparaat (QR): haalt keys op van brontoestel — geen dataverlies
 *  - Doorgaan met nieuwe keys: oude chats worden onleesbaar
 *  - Annuleren: uitloggen
 */
export function NewDeviceWarning({
  onConfirm,
  onCancel,
  onLinkDevice,
}: {
  /** Roep aan nadat de gebruiker "Doorgaan" tikt — bootstrap opnieuw met confirmOverwrite=true. */
  onConfirm: () => void;
  /** Roep aan bij "Annuleren" — logt de gebruiker uit. */
  onCancel: () => void;
  /** Roep aan bij "Koppel via ander apparaat" — opent QR-scanner. */
  onLinkDevice?: () => void;
}) {
  return (
    <SafeAreaView className="flex-1 bg-shell items-center justify-center px-6">
      <View className="bg-paper-soft rounded-3xl p-6 w-full max-w-sm">
        {/* Icoon */}
        <View className="w-14 h-14 rounded-full bg-amber-500/15 items-center justify-center mb-4 self-center">
          <Ionicons name="warning-outline" color="#F59E0B" size={26} />
        </View>

        <Text className="text-ink text-xl font-bold text-center mb-3">
          Nieuw apparaat gedetecteerd
        </Text>

        <Text className="text-ink-soft text-sm leading-6 text-center mb-5">
          Je Lincin-account is actief op een ander apparaat. Kies hoe je wilt
          doorgaan.
        </Text>

        {/* Aanbevolen: koppel via QR */}
        {onLinkDevice ? (
          <Pressable
            onPress={onLinkDevice}
            className="bg-brand active:bg-brand/80 rounded-2xl py-3.5 items-center mb-2"
          >
            <View className="flex-row items-center gap-2">
              <Ionicons name="qr-code-outline" color="#fff" size={18} />
              <Text className="text-white font-bold text-base">
                Koppel via ander apparaat
              </Text>
            </View>
            <Text className="text-white/70 text-xs mt-1">
              Scan QR — chats blijven leesbaar
            </Text>
          </Pressable>
        ) : null}

        {/* Divider */}
        <View className="flex-row items-center gap-3 my-3">
          <View className="flex-1 h-px bg-line-paper" />
          <Text className="text-ink-muted text-xs">of</Text>
          <View className="flex-1 h-px bg-line-paper" />
        </View>

        {/* Nieuwe keys — oude chats gaan verloren */}
        <View className="bg-paper-warm rounded-2xl px-4 py-3 mb-3">
          <Text className="text-ink-soft text-xs leading-5">
            <Text className="text-ink font-semibold">Let op:</Text> als je
            doorgaat met een nieuwe sleutel worden{" "}
            <Text className="text-ink font-semibold">
              bestaande chats onleesbaar
            </Text>{" "}
            op het oude apparaat. Berichten zijn end-to-end versleuteld — enkel
            het apparaat met de sleutel kan ze lezen.
          </Text>
        </View>

        <Pressable
          onPress={onConfirm}
          className="bg-amber-500 active:bg-amber-600 rounded-2xl py-3.5 items-center mb-2"
        >
          <Text className="text-white font-bold text-base">
            Doorgaan met nieuwe sleutel
          </Text>
        </Pressable>

        <Pressable
          onPress={onCancel}
          className="bg-paper active:bg-paper-warm rounded-2xl py-3.5 items-center"
        >
          <Text className="text-ink font-semibold text-base">Annuleren</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
