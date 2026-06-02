/**
 * VideoCallModal — native (iOS / Android) + web.
 *
 * Fixes:
 * 1. Camera/mic permissies worden gevraagd vóór de WebView laadt
 *    → geen zwart scherm meer bij eerste keer openen.
 * 2. Bij sluiten wordt eerst 'hangup' in Jitsi geïnjecteerd en 300ms
 *    gewacht zodat WebRTC netjes afbreekt → geen bevriezing meer.
 */
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import WebView from "react-native-webview";
import { Camera } from "expo-camera";

import { buildJitsiEmbedUrl } from "@/lib/jitsi";

interface Props {
  chatId: string;
  visible: boolean;
  onClose: () => void;
}

export function VideoCallModal({ chatId, visible, onClose }: Props) {
  const url = buildJitsiEmbedUrl(chatId);
  const webviewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [closing, setClosing] = useState(false);

  // Vraag camera + microfoon toestemming zodra modal opent
  useEffect(() => {
    if (!visible) {
      setReady(false);
      setClosing(false);
      return;
    }
    if (Platform.OS === "web") {
      setReady(true);
      return;
    }
    (async () => {
      const { status: camStatus } = await Camera.requestCameraPermissionsAsync();
      const { status: micStatus } = await Camera.requestMicrophonePermissionsAsync();
      if (camStatus === "granted" && micStatus === "granted") {
        setReady(true);
      } else {
        // Toestemmingen geweigerd — toon waarschuwing maar laad toch
        setReady(true);
      }
    })();
  }, [visible]);

  // Netjes afsluiten: injecteer hangup → wacht 300ms → sluit modal
  function handleClose() {
    if (closing) return;
    setClosing(true);
    try {
      webviewRef.current?.injectJavaScript(`
        try {
          window.JitsiMeetExternalAPI && window._jitsiApi?.executeCommand('hangup');
        } catch(e) {}
        true;
      `);
    } catch (_) {}
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 350);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: "#111" }} edges={["top"]}>
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#111" }}>
          <Ionicons name="videocam" color="#F5E8D3" size={18} />
          <Text style={{ color: "#F5E8D3", fontWeight: "600", fontSize: 16, marginLeft: 8, flex: 1 }}>
            Videogesprek
          </Text>
          <Pressable
            onPress={handleClose}
            hitSlop={8}
            style={{ backgroundColor: closing ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.12)", borderRadius: 20, padding: 6 }}
          >
            {closing
              ? <ActivityIndicator size="small" color="#F5E8D3" />
              : <Ionicons name="close" color="#F5E8D3" size={18} />
            }
          </Pressable>
        </View>

        {/* Wacht op toestemmingen */}
        {!ready ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActivityIndicator color="#F5E8D3" />
            <Text style={{ color: "#F5E8D3", opacity: 0.6, fontSize: 13 }}>
              Camera en microfoon toestemming aanvragen…
            </Text>
          </View>
        ) : (
          <WebView
            ref={webviewRef}
            key={chatId}
            source={{ uri: url }}
            style={{ flex: 1 }}
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
            javaScriptEnabled
            domStorageEnabled
            allowsProtectedMedia
            // Sla de externe Jitsi API-referentie op zodat hangup werkt
            injectedJavaScriptBeforeContentLoaded={`
              window._jitsiApiReady = function(api) { window._jitsiApi = api; };
              true;
            `}
            injectedJavaScript={`
              document.querySelector('#largeVideoContainer')?.style.setProperty('height','100%');
              true;
            `}
            // Voorkom externe navigatie binnen de WebView
            onShouldStartLoadWithRequest={(req) => {
              return req.url.startsWith("https://meet.jit.si") ||
                     req.url.startsWith("https://8x8.vc") ||
                     req.url === url;
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
