import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { openUrl } from "@/components/FindBody";
import { RichText } from "@/components/RichText";
import { SafeImage } from "@/components/SafeImage";
import { Scrim } from "@/components/Scrim";
import type { Profile } from "@/lib/api/profiles";
import {
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  flameDeep,
  rule,
  space,
} from "@/lib/design/type";

/**
 * De kop van een profiel: een plaat, wie je bent, en waar je heen wijst.
 *
 * ---------------------------------------------------------------
 * WAAROM ÉÉN ONDERDEEL VOOR TWEE PAGINA'S
 * ---------------------------------------------------------------
 * Je eigen profiel en dat van iemand anders tekenden allebei hun eigen
 * kop, en ze liepen al uit elkaar voordat hier iets bij kwam. Dat is
 * dezelfde reden als bij `PostGrid`: zodra er twee zijn, wordt er één
 * bijgewerkt.
 *
 * Het verschil tussen de twee zit niet in de vorm maar in wat je mag: op
 * je eigen profiel kun je de plaat en de foto vervangen. Dat komt als
 * `onPickHero`/`onPickAvatar` binnen, en zonder die twee is het precies
 * dezelfde kop zonder knoppen.
 *
 * ---------------------------------------------------------------
 * DE PLAAT
 * ---------------------------------------------------------------
 * Hij loopt tot de rand van het venster en de avatar hangt eroverheen —
 * de enige plek in de app waar twee vlakken elkaar overlappen. Dat mag
 * hier omdat de avatar zelf de uitzondering al is: hij is rond in een
 * systeem van rechte hoeken (§4), en iets ronds dat over een rand hangt
 * leest als een zegel op een blad, niet als een derde vlak.
 *
 * Zonder plaat is er geen leeg vak: dan begint de kop gewoon bij de
 * avatar. Een plaatshouder van tweehonderd punten hoog om te zeggen dat
 * er niets is, is erger dan niets — behalve op je eigen profiel, waar hij
 * de knop ís om er een te kiezen.
 */
export function ProfileHeader({
  profile,
  email,
  heroBusy,
  avatarBusy,
  onPickHero,
  onPickAvatar,
  onEditBio,
}: {
  profile: Profile | null | undefined;
  /** Alleen op je eigen profiel; die van een ander gaat je niets aan. */
  email?: string | null;
  heroBusy?: boolean;
  avatarBusy?: boolean;
  onPickHero?: () => void;
  onPickAvatar?: () => void;
  /** De weg naar de bewerkpagina als je nog geen bio hebt. */
  onEditBio?: () => void;
}) {
  const displayName = profile?.display_name?.trim() || null;
  const username = profile?.username ?? "";
  const bio = profile?.bio?.trim() || "";
  const links = profile?.links ?? [];
  const mine = !!onPickAvatar;

  return (
    <View>
      <ProfileHeroPlate
        uri={profile?.hero_url}
        busy={heroBusy}
        onPick={onPickHero}
        userId={profile?.id}
      />

      {/* De avatar hangt over de onderrand van de plaat. Is er geen plaat,
          dan is er niets om overheen te hangen en staat hij gewoon boven-
          aan — vandaar de negatieve marge alleen in het eerste geval. */}
      <View
        style={{
          alignItems: "center",
          marginTop: profile?.hero_url ? -44 : space.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Profielfoto wijzigen"
          accessibilityState={{ disabled: !mine }}
          onPress={onPickAvatar}
          disabled={!mine}
          style={{ position: "relative" }}
        >
          {/* Een ring in het paginavlak, zodat de avatar loskomt van de
              foto eronder in plaats van erin te verdwijnen. */}
          <View
            style={{
              padding: 4,
              borderRadius: 999,
              backgroundColor: feed.lav,
            }}
          >
            <Avatar
              name={displayName ?? username}
              avatarUrl={profile?.avatar_url}
              size="hero"
              tint="warm"
            />
          </View>
          {mine ? (
            <View
              style={{
                position: "absolute",
                bottom: 2,
                right: 2,
                width: 28,
                height: 28,
                backgroundColor: feed.ink,
                borderWidth: 2,
                borderColor: feed.lav,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {avatarBusy ? (
                <ActivityIndicator size="small" color={creamOnDark.DEFAULT} />
              ) : (
                <Ionicons name="camera" color={creamOnDark.DEFAULT} size={14} />
              )}
            </View>
          ) : null}
        </Pressable>

        {displayName ? (
          <Text
            style={[
              feedType.tagline,
              { color: feed.ink, marginTop: space.md, textAlign: "center" },
            ]}
          >
            {displayName}
          </Text>
        ) : null}
        <Text style={[feedType.body, { color: feed.inkDim, marginTop: 2 }]}>
          @{username || "…"}
        </Text>
        {email ? (
          <Text style={[feedType.label, { color: feed.inkDim, marginTop: space.xs }]}>
            {email}
          </Text>
        ) : null}

        {/* De bio is opmaak geworden (0054). `RichText` kiest geen letter en
            geen kleur — die krijgt hij hier mee — dus een bio kan nooit uit
            de toon vallen tegen het stelsel in. Zie components/RichText.tsx. */}
        {bio ? (
          <View style={{ marginTop: space.lg, maxWidth: 520, width: "100%" }}>
            <RichText
              text={bio}
              style={[feedType.body, { textAlign: "center" }]}
              color={feed.ink}
              dimColor={feed.inkDim}
              ruleColor={rule.soft}
            />
          </View>
        ) : mine && onEditBio ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voeg een bio toe"
            onPress={onEditBio}
            style={{ height: 44, justifyContent: "center", marginTop: space.sm }}
          >
            <Text style={[feedType.label, { color: feed.inkDim, textDecorationLine: "underline" }]}>
              Voeg een bio toe
            </Text>
          </Pressable>
        ) : null}
      </View>

      {links.length > 0 ? <ProfileLinkList links={links} /> : null}
    </View>
  );
}

/**
 * De plaat bovenaan.
 *
 * Vaste verhouding en niet een vaste hoogte: op een telefoon is 3:1 een
 * strook en op een breed scherm een panorama, en dat is precies goed —
 * hij hoort de breedte van de pagina te dragen, welke dat ook is.
 *
 * Los geëxporteerd, want niet elk profiel heeft dezelfde opbouw.
 * `app/user/[username].tsx` zet portret en naam bewust náást elkaar in
 * plaats van gecentreerd — dat staat daar uitgeschreven en is een andere
 * vorm, geen achterstand. Die pagina heeft dus wél de plaat en de links
 * nodig maar niet de kop eromheen.
 */
export function ProfileHeroPlate({
  uri,
  busy,
  onPick,
  userId,
}: {
  uri?: string | null;
  busy?: boolean;
  onPick?: () => void;
  userId?: string;
}) {
  const mine = !!onPick;

  if (!uri) {
    if (!mine) return null;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kies een plaat voor je profiel"
        onPress={onPick}
        style={({ pressed }) => ({
          width: "100%",
          aspectRatio: 4,
          borderWidth: FEED_BORDER,
          borderColor: rule.soft,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? feed.postFill : "transparent",
        })}
      >
        {busy ? (
          <ActivityIndicator color={feed.ink} />
        ) : (
          <>
            <Ionicons name="image-outline" color={feed.inkDim} size={22} />
            <Text
              style={[
                feedType.kicker,
                { color: flameDeep, letterSpacing: 0.55, marginTop: space.sm },
              ]}
            >
              KIES EEN PLAAT
            </Text>
          </>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      accessibilityRole={mine ? "button" : undefined}
      accessibilityLabel={mine ? "Plaat wijzigen" : undefined}
      onPress={onPick}
      disabled={!mine}
      style={{ width: "100%", aspectRatio: 3 }}
    >
      <SafeImage
        uri={uri}
        cacheKey={userId ? `${userId}-hero` : undefined}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        fallbackBg="bg-feed-fill"
        fallbackColor={feed.textDim}
      />
      {/* De avatar hangt straks over de onderrand; zonder sluier valt hij
          weg op een lichte foto. Geen schaduw — die staan niet in dit
          systeem — maar het verloop uit `Scrim`. */}
      <Scrim height={96} strength={0.45} steps={10} />
      {mine ? (
        <View
          style={{
            position: "absolute",
            top: space.md,
            right: space.md,
            flexDirection: "row",
            alignItems: "center",
            gap: space.xs,
            backgroundColor: feed.ink,
            paddingHorizontal: space.md,
            height: 32,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={creamOnDark.DEFAULT} />
          ) : (
            <Ionicons name="camera" color={creamOnDark.DEFAULT} size={13} />
          )}
          <Text style={[feedType.label, { color: creamOnDark.DEFAULT }]}>
            Wijzig
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Je links.
 *
 * Rijen met een lijn ertussen, geen pillen en geen kaartjes: dit is een
 * lijst en een lijst is regels onder elkaar (§4). Het label draagt de
 * regel, het adres staat eronder in het klein — je kiest op naam, en het
 * adres is er om te zien waar je terechtkomt voordat je drukt.
 */
export function ProfileLinkList({ links }: { links: { label: string; url: string }[] }) {
  return (
    <View style={{ marginTop: space.section }}>
      <Text
        style={[
          feedType.kicker,
          { color: flameDeep, letterSpacing: 0.55, marginBottom: space.md },
        ]}
      >
        LINKS
      </Text>
      <View style={{ borderTopWidth: FEED_BORDER, borderTopColor: feed.ink }}>
        {links.map((link, i) => (
          <Pressable
            key={`${link.url}-${i}`}
            accessibilityRole="link"
            accessibilityLabel={`${link.label}, opent ${link.url}`}
            onPress={() => void openUrl(link.url)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: space.md,
              // Eén besturingshoogte als ondergrens; een rij met een lange
              // naam mag groeien maar nooit krimpen.
              minHeight: 52,
              paddingVertical: space.sm,
              borderBottomWidth: FEED_BORDER,
              borderBottomColor: rule.soft,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text
                style={[feedType.body, { color: feed.ink, fontWeight: "700" }]}
                numberOfLines={1}
              >
                {link.label}
              </Text>
              <Text
                style={[feedType.caption, { color: feed.inkDim, marginTop: 1 }]}
                numberOfLines={1}
              >
                {link.url.replace(/^https?:\/\//i, "")}
              </Text>
            </View>
            <Ionicons name="arrow-forward" color={feed.inkDim} size={16} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
