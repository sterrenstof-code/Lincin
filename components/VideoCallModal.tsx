/**
 * VideoCallModal — native (iOS / Android).
 * Toont een fullscreen Modal met een WebView die de JaaS-videocall embed.
 * Camera en microfoon worden via de mediaPlaybackRequiresUserAction=false
 * flag doorgegeven; iOS vereist bovendien NSCameraUsageDescription en
 * NSMicrophoneUsageDescription in app.json infoPlist (al ingesteld).
 */
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";

import { buildJitsiEmbedUrl } from "@/lib/jitsi";

interface Props {
  chatId: string;
  visible: boolean;
  onClose: () => void;
}

export function VideoCallModal({ chatId, visible, onClose }: Props) {
  const url = buildJitsiEmbedUrl(chatId);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }} edges={["top"]}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingVertical: 10,
            backgroundColor: "#111",
          }}
        >
          <Ionicons name="videocam" color="#F5E8D3" size={18} />
          <Text
            style={{
              color: "#F5E8D3",
              fontWeight: "600",
              fontSize: 16,
              marginLeft: 8,
              flex: 1,
            }}
          >
            Videogesprek
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={8}
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: 6,
            }}
          >
            <Ionicons name="close" color="#F5E8D3" size={18} />
          </Pressable>
        </View>

        {/* JaaS WebView */}
        <WebView
          source={{ uri: url }}
          style={{ flex: 1 }}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
          javaScriptEnabled
          domStorageEnabled
          // Verberg de Jitsi toolbar UI — het sluiten doen we via onze eigen knop.
          injectedJavaScript={`
            document.querySelector('#largeVideoContainer')?.style.setProperty('height','100%');
            true;
          `}
        />
      </SafeAreaView>
    </Modal>
  );
}
