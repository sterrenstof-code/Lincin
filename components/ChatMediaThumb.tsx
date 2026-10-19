import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { Skeleton } from "@/components/Skeleton";
import type { AttachmentInfo } from "@/lib/api/messages";
import { useAttachmentUri } from "@/lib/attachment-cache";
import { creamOnDark, feed, space } from "@/lib/design/type";

/**
 * Eén gedeeld beeld uit een gesprek, klein.
 *
 * Bijlagen in een chat zijn versleuteld: de bucket bewat bytes waar niemand
 * iets aan heeft zonder de sleutel die in het bericht zelf zit. Er bestaat
 * dus geen URL die je zomaar in een `<img>` kunt zetten — het bestand wordt
 * opgehaald en hier, in het toestel, ontsleuteld (één keer per sessie, zie
 * lib/attachment-cache.ts).
 *
 * Dat is ook waarom deze strook hoogstens een handvol beelden toont: elk
 * beeld is een download plus een ontsleuteling, en dat doe je niet voor een
 * gesprek van duizend berichten.
 */
export function ChatMediaThumb({
  attachment,
  size,
}: {
  attachment: AttachmentInfo;
  size: number;
}) {
  // Gedeeld met de bubbel in de draad: dezelfde foto wordt één keer
  // opgehaald en ontsleuteld, niet bij elke mount (lib/attachment-cache.ts).
  const { uri, error } = useAttachmentUri(attachment);
  const [imageFailed, setFailed] = useState(false);
  const failed = imageFailed || !!error;
  const [open, setOpen] = useState(false);

  if (failed) {
    return <View style={{ width: size, height: size, backgroundColor: feed.postFill }} />;
  }

  if (!uri) {
    return (
      <Skeleton
        className="bg-paper-warm"
        style={{ width: size, height: size, borderRadius: 0 }}
      />
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{ width: size, height: size, backgroundColor: feed.postFill }}
      >
        <Image
          source={{ uri }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={120}
          onError={() => setFailed(true)}
        />
      </Pressable>

      {/*
          Een miniatuur van vierentachtig pixels is een geheugensteun, geen
          foto: je herkent er wat aan maar je kunt hem niet lezen — en juist
          een schermafbeelding met tekst erin, waarvoor je zo'n strook het
          vaakst opendoet, is op die maat niets. Aantikken toont hem op ware
          grootte, op zwart, zodat de foto het enige is wat er nog staat.
      */}
      <Modal
        visible={open}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Sluiten"
          onPress={() => setOpen(false)}
          style={{
            flex: 1,
            backgroundColor: "rgba(11,10,12,0.95)",
            alignItems: "center",
            justifyContent: "center",
            padding: space.lg,
          }}
        >
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="contain"
          />
          <View
            style={{
              position: "absolute",
              top: space.lg,
              right: space.lg,
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(11,10,12,0.6)",
            }}
          >
            <Ionicons name="close" color={creamOnDark.DEFAULT} size={20} />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
