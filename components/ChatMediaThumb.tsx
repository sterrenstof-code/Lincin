import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { Skeleton } from "@/components/Skeleton";
import { downloadEncryptedAttachment, type AttachmentInfo } from "@/lib/api/messages";
import { base64ToBytes } from "@/lib/crypto/base64";
import { bytesToDisplayUri, decryptFileBytes } from "@/lib/crypto/file";
import { feed } from "@/lib/design/type";

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
  onPress,
}: {
  attachment: AttachmentInfo;
  size: number;
  onPress?: () => void;
}) {
  const [uri, setUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

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
    return <View style={{ width: size, height: size, backgroundColor: feed.post }} />;
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
    <View style={{ width: size, height: size, backgroundColor: feed.post }}>
      <Image
        source={{ uri }}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        transition={120}
        onError={() => setFailed(true)}
      />
    </View>
  );
}
