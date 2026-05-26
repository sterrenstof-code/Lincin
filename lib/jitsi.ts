import * as Linking from "expo-linking";

/**
 * Open een Jitsi Meet room voor deze chat. Jitsi is een tussenstap tot we
 * native WebRTC calling bouwen. Op iOS opent de Jitsi Meet app als die
 * geïnstalleerd is, anders Safari. Op web opent meet.jit.si direct.
 *
 * De roomname leiden we deterministisch af van de chat-id zodat alle
 * deelnemers met dezelfde URL terechtkomen.
 */
export function buildJitsiRoomUrl(chatId: string, opts?: { audioOnly?: boolean }): string {
  const slug = chatId.replace(/-/g, "").slice(0, 24);
  const room = `Lincin-${slug}`;
  const config = opts?.audioOnly ? "#config.startAudioOnly=true" : "";
  return `https://meet.jit.si/${room}${config}`;
}

export async function openJitsiCall(chatId: string, opts?: { audioOnly?: boolean }): Promise<void> {
  const url = buildJitsiRoomUrl(chatId, opts);
  await Linking.openURL(url);
}
