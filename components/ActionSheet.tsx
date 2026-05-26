import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, Text, View } from "react-native";

export type ActionSheetAction = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  /** Async / sync handler. Sheet closes automatically afterwards. */
  onPress: () => void | Promise<void>;
};

/**
 * Cross-platform bottom action sheet styled like the rest of the app.
 * Slides up on mobile, fades over content on desktop web. Tap the backdrop
 * or the Annuleer pill to dismiss.
 */
export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionSheetAction[];
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        {/* Dim backdrop — tap to dismiss */}
        <Pressable
          onPress={onClose}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
        />

        {/* Sheet — capped at 600px and centered on wide screens */}
        <View
          style={{
            width: "100%",
            maxWidth: 600,
            alignSelf: "center",
          }}
        >
          <View className="bg-paper rounded-t-3xl pt-5 pb-8 px-4 mx-2">
            <View className="self-center w-10 h-1 rounded-full bg-line-paper mb-4" />
            {title && (
              <Text className="text-xs uppercase tracking-wider text-ink-muted text-center mb-3">
                {title}
              </Text>
            )}
            <View className="bg-paper-soft rounded-2xl overflow-hidden">
              {actions.map((action, i) => (
                <Pressable
                  key={action.label}
                  onPress={async () => {
                    onClose();
                    // Tiny delay so the sheet animation finishes before any
                    // follow-up modal (confirm dialog) opens — feels less jarring.
                    setTimeout(() => {
                      Promise.resolve(action.onPress()).catch(() => {});
                    }, 60);
                  }}
                  className={`flex-row items-center px-4 py-4 ${
                    i === actions.length - 1
                      ? ""
                      : "border-b border-line-paper/60"
                  }`}
                >
                  {action.icon && (
                    <Ionicons
                      name={action.icon}
                      size={20}
                      color={action.destructive ? "#B23A1C" : "#1A1714"}
                    />
                  )}
                  <Text
                    className={`ml-3 font-semibold text-base ${
                      action.destructive ? "" : "text-ink"
                    }`}
                    style={action.destructive ? { color: "#B23A1C" } : undefined}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={onClose}
              className="mt-3 bg-paper-warm active:bg-paper rounded-full py-3 items-center"
            >
              <Text className="text-ink font-semibold">Annuleer</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
