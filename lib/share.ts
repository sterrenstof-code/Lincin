import * as Clipboard from "expo-clipboard";
import { Platform, Share } from "react-native";

/**
 * Cross-platform share/copy helpers. We try the platform's native share sheet
 * first, then fall back to copying to clipboard.
 */
export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareText(args: {
  title?: string;
  message: string;
}): Promise<ShareResult> {
  if (Platform.OS === "web") {
    const nav: any = (globalThis as any).navigator;
    if (nav?.share) {
      try {
        await nav.share({ title: args.title, text: args.message });
        return "shared";
      } catch (e: any) {
        if (e?.name === "AbortError") return "cancelled";
        // fall through to clipboard
      }
    }
    try {
      await Clipboard.setStringAsync(args.message);
      return "copied";
    } catch {
      return "failed";
    }
  }

  try {
    const result = await Share.share(
      { message: args.message, title: args.title },
      { dialogTitle: args.title }
    );
    if (result.action === Share.dismissedAction) return "cancelled";
    return "shared";
  } catch {
    return "failed";
  }
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Build the public Lincin profile / add-friend URL for a given username.
 * On web we use the current origin so dev with localhost just works;
 * on native we fall back to an env-configured public URL.
 */
export function buildAddFriendUrl(username: string): string {
  const base =
    process.env.EXPO_PUBLIC_PUBLIC_URL ??
    (typeof window !== "undefined" && (window as any).location?.origin
      ? (window as any).location.origin
      : "https://lincin.app");
  return `${base}/user/${encodeURIComponent(username)}`;
}
