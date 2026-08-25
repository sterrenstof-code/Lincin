import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { ModalShell } from "@/components/ModalShell";
import { feed, FEED_BORDER, feedType, space } from "@/lib/design/type";

export type ActionSheetAction = {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
  /** Async / sync handler. Sheet closes automatically afterwards. */
  onPress: () => void | Promise<void>;
};

/**
 * Een lijstje met wat je kunt doen, in het midden van het scherm.
 *
 * Stond eerder onderaan, als blad dat omhoog schoof. Dat is een patroon van
 * een telefoon-app; op een breed scherm is de onderrand juist de plek waar
 * je níet kijkt, en een blad dat vanaf daar komt zetten trekt de aandacht
 * naar de verkeerde hoek. Zie ModalShell voor de vorm en de beweging.
 */
export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionSheetAction[];
  /**
   * Iets dat onder de rij acties staat en het venster níet sluit — een
   * schakelaar in plaats van een opdracht. Krijgt zijn eigen lijn erboven,
   * want het is een ander soort ding dan de regels erboven.
   */
  footer?: ReactNode;
}) {
  return (
    <ModalShell visible={visible} onClose={onClose} title={title}>
      <View>
        {actions.map((action, i) => (
          <Pressable
            key={action.label}
            onPress={async () => {
              onClose();
              // Kleine vertraging zodat de overgang klaar is voor een
              // volgend venster (bijvoorbeeld een bevestiging) opengaat.
              setTimeout(() => {
                Promise.resolve(action.onPress()).catch(() => {});
              }, 60);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              paddingHorizontal: space.lg,
              paddingVertical: space.lg,
              ...(i === actions.length - 1 && !footer
                ? null
                : { borderBottomWidth: FEED_BORDER, borderBottomColor: feed.ink }),
            }}
          >
            {action.icon && (
              <Ionicons
                name={action.icon}
                size={20}
                color={action.destructive ? "#B23A1C" : feed.ink}
              />
            )}
            <Text
              style={[
                feedType.tile,
                {
                  fontSize: 15,
                  fontWeight: "700",
                  color: action.destructive ? "#B23A1C" : feed.ink,
                },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </View>
      {footer ? (
        <View style={{ borderTopWidth: FEED_BORDER, borderTopColor: feed.ink }}>
          {footer}
        </View>
      ) : null}
    </ModalShell>
  );
}
