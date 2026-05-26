import { Alert, Platform } from "react-native";

/**
 * Cross-platform confirm dialog. Returns true if the user clicks the
 * affirmative button, false on cancel. On web falls back to native
 * `window.confirm` so styling matches the OS rather than fighting it.
 */
export function confirm(
  title: string,
  message: string,
  options: { affirmativeLabel?: string; destructive?: boolean } = {}
): Promise<boolean> {
  const affirmative = options.affirmativeLabel ?? "OK";
  if (Platform.OS === "web") {
    return Promise.resolve(
      typeof window !== "undefined" && window.confirm(`${title}\n\n${message}`)
    );
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: "Annuleer", style: "cancel", onPress: () => resolve(false) },
      {
        text: affirmative,
        style: options.destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}
