import { useRouter } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getOrCreateDirectChat } from "@/lib/api/chats";
import { sendMessage } from "@/lib/api/messages";
import { useAuth } from "@/lib/auth/provider";
import { color } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

import { BORDER, CONTROL, GUTTER, Mono, Serif, SquareBtn } from "./ui";

/**
 * Het privé-blad (README §Private-message sheet).
 *
 * Vanaf een kaart, een bladzijde of een band: een blad van onder, met de
 * naam van de vriend, het bijschrift als citaat (weg te halen met
 * "Bijdrage vermelden"), en één regel invoer. Versturen opent het gesprek
 * met het bericht erin — de vermelding gaat als `postRef` mee in de
 * versleutelde inhoud, zodat het gesprek hem als "over «…»" kan tonen.
 */

export type PrivateTarget = {
  friendId: string;
  friendName: string;
  /** Het bijschrift; leeg als er niets te citeren valt (de band). */
  quote?: string;
  postId?: string;
  postTitle?: string;
};

export function PrivateSheet({ target, onClose }: { target: PrivateTarget | null; onClose: () => void }) {
  const t = useT();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [withQuote, setWithQuote] = useState(true);
  const [sending, setSending] = useState(false);

  const close = () => {
    setDraft("");
    setWithQuote(true);
    onClose();
  };

  async function send() {
    if (!target || !session || sending) return;
    const text = draft.trim() || "hey, over deze bladzijde…";
    setSending(true);
    try {
      const chatId = await getOrCreateDirectChat(target.friendId);
      await sendMessage({
        chatId,
        senderId: session.user.id,
        text,
        postRef:
          withQuote && target.postId
            ? { id: target.postId, title: target.postTitle ?? target.quote ?? "", quote: target.quote ?? "" }
            : undefined,
      });
      close();
      router.push(`/chat/${chatId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.failed);
    } finally {
      setSending(false);
    }
  }

  const hasQuote = !!target?.quote;

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={close}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.cancel}
        onPress={close}
        style={{ flex: 1, backgroundColor: "rgba(20,20,20,.35)", justifyContent: "flex-end" }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable
            onPress={() => {}}
            style={{
              width: "100%",
              maxWidth: 640,
              alignSelf: "center",
              backgroundColor: color("paper"),
              borderTopWidth: BORDER,
              borderTopColor: color("ink"),
              paddingTop: 16,
              paddingHorizontal: GUTTER,
              paddingBottom: Math.max(insets.bottom, 16) + 28,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <Mono variant="micro" tone="dim" numberOfLines={1} style={{ flex: 1 }}>
                {t.privateChatWith} {target?.friendName}
              </Mono>
              {hasQuote ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: withQuote }}
                  onPress={() => setWithQuote((v) => !v)}
                  style={{
                    borderWidth: BORDER,
                    borderColor: color("ink"),
                    backgroundColor: withQuote ? color("ink") : "transparent",
                    paddingVertical: 5,
                    paddingHorizontal: 8,
                  }}
                >
                  <Mono variant="action" color={withQuote ? color("paper") : color("ink")}>
                    {withQuote ? t.mentioned2 : t.mention}
                  </Mono>
                </Pressable>
              ) : null}
            </View>
            {hasQuote && withQuote ? (
              <View style={{ borderLeftWidth: 3, borderLeftColor: color("ink"), paddingLeft: 10 }}>
                <Serif variant="captionLarge" numberOfLines={3}>
                  {target?.quote}
                </Serif>
              </View>
            ) : null}
            <View style={{ flexDirection: "row" }}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder={t.sheetPh}
                placeholderTextColor={color("ink", "inkDim")}
                onSubmitEditing={send}
                returnKeyType="send"
                autoFocus={Platform.OS !== "web"}
                style={[
                  lincinType.body,
                  {
                    flex: 1,
                    height: CONTROL,
                    borderWidth: BORDER,
                    borderRightWidth: 0,
                    borderColor: color("ink"),
                    paddingHorizontal: 12,
                    color: color("ink"),
                    backgroundColor: "transparent",
                    ...(Platform.OS === "web" ? { outlineWidth: 0 } : null),
                  } as object,
                ]}
              />
              <SquareBtn glyph="↑" size={CONTROL} fontSize={18} fill onPress={send} accessibilityLabel="Verstuur" />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}
