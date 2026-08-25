import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { Skeleton } from "@/components/Skeleton";
import { downloadEncryptedAttachment, type AttachmentInfo } from "@/lib/api/messages";
import { base64ToBytes } from "@/lib/crypto/base64";
import { bytesToDisplayUri, decryptFileBytes } from "@/lib/crypto/file";
import { creamOnDark, feed, space } from "@/lib/design/type";

/**
 * Eén gedeeld beeld uit een gesprek, klein.
 *
 * Bijlagen in een chat zijn versleuteld: de bucket bewat bytes waar niemand
 * iets aan heeft zonder de sleutel die in het bericht zelf zit. Er bestaat
 * dus geen URL die je zomaar in een `<img>` kunt zetten — elke miniatuur
 * haalt zijn eigen bestand op en ontsleutelt het hier, in het toestel.
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
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cipher = await downloadEncryptedAttachment(attachment.path);
        const plain = decryptFileBytes(
          cipher,
          base64ToBytes(attachment.key_b64),
          base64ToBytes(attachment.nonce_b64)
        );
        if (!plain) throw new Error("Decryptie faalde");
        const display = await bytesToDisplayUri(
          plain,
          attachment.mime_type,
          `att-${attachment.path.split("/").pop()}`
        );
        if (!cancelled) setUri(display);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attachment.path, attachment.key_b64, attachment.nonce_b64, attachment.mime_type]);

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
