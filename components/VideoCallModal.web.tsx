/**
 * VideoCallModal — web implementatie.
 * Expo's bundler pikt .web.tsx automatisch op boven .tsx op web.
 *
 * Renderen we als een fullscreen Modal bovenop de chat, net als Telegram.
 * De iframe laadt de JaaS room; Jitsi vraagt de gebruiker zelf om een naam
 * (geen JWT nodig voor MVP). Camera + microfoon worden door de browser
 * gevraagd bij binnenkomst in de room.
 */
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { buildJitsiEmbedUrl } from "@/lib/jitsi";

interface Props {
  chatId: string;
  visible: boolean;
  onClose: () => void;
}

export function VideoCallModal({ chatId, visible, onClose }: Props) {
  if (!visible) return null;

  const src = buildJitsiEmbedUrl(chatId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.container}>
        {/* Header met sluit-knop */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Videogesprek</Text>
          <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
            <Ionicons name="close" color="#F5E8D3" size={22} />
          </Pressable>
        </View>

        {/* JaaS iframe — neemt alle resterende ruimte in */}
        {/* @ts-ignore — iframe is een geldig DOM-element in React Native Web */}
        <iframe
          src={src}
          style={styles.iframe as any}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          allowFullScreen
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1A1714", // shell-black
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#242019",
  },
  headerTitle: {
    color: "#F5E8D3",
    fontSize: 16,
    fontWeight: "600",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  iframe: {
    flex: 1,
    border: "none",
    width: "100%",
    height: "100%",
  },
});
