import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";

import { useAuth } from "@/lib/auth/provider";
import { feed, FEED_BORDER, feedType } from "@/lib/design/type";
import { getPostSignals, togglePostBoost, togglePostFollow } from "@/lib/api/post-signals";

/**
 * Wat je met een vondst kunt doen zonder te typen.
 *
 *   OMHOOG DUWEN  "dit is het bekijken waard". Telt mee voor waar de
 *                 thematische weergave zijn aandacht heen stuurt.
 *   VOLGEN        je blijft op de hoogte: elke nieuwe reactie op deze
 *                 vondst komt in je meldingen, ook als je zelf niets zegt.
 *
 * De emoji-pillen staan er los naast (PostReactions): die zeggen iets
 * over de foto, deze twee zeggen iets over wat je er verder mee wilt.
 */
export function PostSignalBar({
  postId,
  ownerId,
}: {
  postId: string;
  ownerId?: string | null;
}) {
  const { session } = useAuth();
  const myUserId = session?.user.id;
  const qc = useQueryClient();

  const signals = useQuery({
    queryKey: ["post-signals", postId, myUserId],
    queryFn: () => getPostSignals(postId, myUserId),
    enabled: !!postId,
  });

  const boosted = signals.data?.boosted ?? false;
  const following = signals.data?.following ?? false;
  const count = signals.data?.boosts ?? 0;

  async function onBoost() {
    if (!myUserId) return;
    // Meteen omzetten en pas daarna vragen: een duw die een halve seconde
    // nadenkt voelt als een duw die niet aankwam.
    qc.setQueryData(["post-signals", postId, myUserId], (prev: any) =>
      prev ? { ...prev, boosted: !boosted, boosts: prev.boosts + (boosted ? -1 : 1) } : prev
    );
    try {
      await togglePostBoost({ postId, userId: myUserId, ownerId, boosted });
    } finally {
      qc.invalidateQueries({ queryKey: ["post-signals", postId, myUserId] });
      qc.invalidateQueries({ queryKey: ["post-people", postId, myUserId] });
      qc.invalidateQueries({ queryKey: ["feed"] });
    }
  }

  async function onFollow() {
    if (!myUserId) return;
    qc.setQueryData(["post-signals", postId, myUserId], (prev: any) =>
      prev ? { ...prev, following: !following } : prev
    );
    try {
      await togglePostFollow({ postId, userId: myUserId, following });
    } finally {
      qc.invalidateQueries({ queryKey: ["post-signals", postId, myUserId] });
    }
  }

  return (
    /**
     * Twee cellen tussen lijnen — géén kader eromheen.
     *
     * Ze hadden eerst allebei een eigen rand met acht punten ertussen, en
     * in het midden zag je dus twee evenwijdige lijnen. Dat werd één kader
     * om beide, en toen stond het kader zelf weer dubbel: de rij hangt
     * onder een lijn (de kop erboven sluit ermee af) en boven de lijn van
     * de reacties, dus je zag drie lijnen waar er één hoorde te staan.
     *
     * Nu tekent deze rij alleen de lijn ónder zich — de scheiding met de
     * reactiepillen. De lijn erbóven komt van het blok waar hij in staat.
     * Cellen tussen lijnen, geen kaartje op een pagina (DESIGN.md §4).
     */
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: FEED_BORDER,
        borderBottomColor: feed.ink,
      }}
    >
      <SignalButton
        icon={boosted ? "arrow-up-circle" : "arrow-up-circle-outline"}
        /**
         * Het aantal staat er altijd, ook op nul.
         *
         * Het verdween onder de één, en dan zie je niet dát er geteld wordt
         * — een knop die soms een getal draagt en soms niet leest als twee
         * verschillende knoppen. Nul is bovendien informatie: je bent de
         * eerste.
         */
        label={`Omhoog · ${count}`}
        active={boosted}
        onPress={onBoost}
      />
      <View style={{ width: FEED_BORDER, backgroundColor: feed.ink }} />
      <SignalButton
        icon={following ? "notifications" : "notifications-outline"}
        label={following ? "Je volgt dit" : "Volgen"}
        active={following}
        onPress={onFollow}
      />
    </View>
  );
}

function SignalButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingVertical: 11,
        paddingHorizontal: 10,
        // Geen eigen rand: de lijnen boven, onder en ertussen doen dat werk.
        // `minWidth: 0` zodat een lang label de andere cel niet wegduwt
        // maar zelf afkapt.
        minWidth: 0,
        backgroundColor: active ? feed.ink : "transparent",
      }}
    >
      <Ionicons name={icon} size={16} color={active ? feed.lav : feed.ink} />
      <Text
        style={[feedType.label, { fontSize: 12, color: active ? feed.lav : feed.ink }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}
