import { useState } from "react";
import { Platform } from "react-native";

import { ActionSheet } from "@/components/ActionSheet";
import { useToggleChatRead } from "@/lib/chat-read";
import { useT } from "@/lib/i18n";

/**
 * Lang drukken (telefoon) of rechtsklikken (web) op een gesprek in de lijst
 * opent dit menuutje: markeer als gelezen, of weer als ongelezen. Telegram
 * doet het zo, dus mensen zoeken het daar.
 */
export function useChatReadMenu() {
  const t = useT();
  const toggle = useToggleChatRead();
  const [target, setTarget] = useState<{ id: string; name: string; unread: boolean } | null>(null);

  const sheet = (
    <ActionSheet
      visible={!!target}
      onClose={() => setTarget(null)}
      title={target?.name}
      actions={
        target
          ? [
              target.unread
                ? { label: t.markRead, icon: "checkmark-done", onPress: () => toggle(target.id, false) }
                : { label: t.markUnread, icon: "ellipse", onPress: () => toggle(target.id, true) },
            ]
          : []
      }
    />
  );

  /** De props voor een rij: lang drukken, en op web de rechtermuisknop. */
  const rowProps = (id: string, name: string, unread: boolean) => {
    const open = () => setTarget({ id, name, unread });
    return {
      onLongPress: open,
      delayLongPress: 300,
      ...(Platform.OS === "web"
        ? {
            onContextMenu: (e: { preventDefault: () => void }) => {
              e.preventDefault();
              open();
            },
          }
        : null),
    };
  };

  return { sheet, rowProps, toggle };
}

export type ChatRowMenuProps = ReturnType<ReturnType<typeof useChatReadMenu>["rowProps"]>;
