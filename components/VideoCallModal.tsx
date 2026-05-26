/**
 * VideoCallModal — native stub (iOS / Android).
 * Op native opent openJitsiCall() de URL in de browser; deze component
 * wordt niet gebruikt. Stub zorgt dat de import in chat/[id].tsx niet breekt.
 * Vervang later door een echte react-native-webview implementatie.
 */
interface Props {
  chatId: string;
  visible: boolean;
  onClose: () => void;
}

export function VideoCallModal(_props: Props) {
  return null;
}
