import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Avatar } from "@/components/Avatar";
import { openUrl } from "@/components/FindBody";
import { RichText } from "@/components/RichText";
import { SafeImage } from "@/components/SafeImage";
import { Scrim } from "@/components/Scrim";
import type { Profile } from "@/lib/api/profiles";
import {
  CONTROL_H,
  creamOnDark,
  feed,
  FEED_BORDER,
  feedType,
  flameDeep,
  gutter as gutterFor,
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
 * WAAROM DIT NIET MEER GECENTREERD STAAT
 * ---------------------------------------------------------------
 * Het stond zo: plaat, avatar in het midden, naam eronder, bio eronder.
 * Dat is de vorm van een sociaal profiel — een pasfoto met een bijschrift
 * — en die vorm zegt "dit gaat over een account".
 *
 * Een moodboard is een uitgave, en een uitgave heeft een omslag. Dus loopt
 * de plaat tot de vier randen van het venster en begint hij bóven de balk;
 * de naam staat groot en links op de bladspiegel; en de avatar hangt over
 * de onderrand als een zegel. Wat je eerst ziet is het beeld dat jíj koos,
 * en je naam leest eroverheen zoals de titel van een uitgave over zijn
 * omslag ligt.
 *
 * Links uitlijnen en niet centreren is dezelfde regel als `PageHead` (§5):
 * gecentreerde tekst leest als een aankondiging, links uitgelijnde als een
 * pagina die begint. Een moodboard begint.
 *
 * Zonder plaat is er geen leeg vak: dan begint de kop gewoon bij de
 * avatar. Een plaatshouder van tweehonderd punten hoog om te zeggen dat
 * er niets is, is erger dan niets — behalve op je eigen profiel, waar hij
 * de knop ís om er een te kiezen.
 */
export function ProfileHeader({
  profile,
  wide,
  heroBusy,
  avatarBusy,
  onPickHero,
  onPickAvatar,
  onEditBio,
}: {
  profile: Profile | null | undefined;
  /**
   * Geen `email` meer.
   *
   * Die stond onder de bio, klein en grijs, op de omslag van je eigen
   * pagina. Een omslag draagt wie je bent; je inlogadres is geen
   * eigenschap van jou maar van je account, en dat hoort in de rubriek
   * die daarover gaat (§03 op het profielscherm).
   */
  wide: boolean;
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
  const pad = gutterFor(wide);
  const hasHero = !!profile?.hero_url;

  return (
    <View>
      <ProfileHeroPlate
        uri={profile?.hero_url}
        busy={heroBusy}
        onPick={onPickHero}
        userId={profile?.id}
        wide={wide}
      />

      {/*
          De avatar hangt over de onderrand van de plaat; de tékst niet.

          Dat was de fout in de vorige versie: naam en handle stonden op één
          rij mét de avatar, dus ze schoven mee omhoog en landden half op de
          foto. De kicker — klein en in flame — kwam daarmee op een donker
          beeld terecht en was niet te lezen, en de naam botste op de rand
          van de plaat in plaats van eronder te beginnen.

          Alleen de avatar overlapt nu. Hij is rond en heeft een ring in het
          paginavlak, dus hij leest als een zegel op het blad; tekst kan dat
          niet, want tekst heeft geen eigen vlak. Alles wat gelezen moet
          worden staat onder de plaat, op de inkt van de pagina.
      */}
      <View style={{ paddingHorizontal: pad, marginTop: hasHero ? -36 : space.xl }}>
        <Pressable
          accessibilityRole={mine ? "button" : undefined}
          accessibilityLabel={mine ? "Profielfoto wijzigen" : undefined}
          onPress={onPickAvatar}
          disabled={!mine}
          style={{ position: "relative", alignSelf: "flex-start" }}
        >
          <View style={{ padding: 4, borderRadius: 999, backgroundColor: feed.lav }}>
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

        {/* De naam ónder de avatar, niet ernaast.
            Ernaast moest hij op één grondlijn met een cirkel van tachtig
            punten, en dan staat er een kop van vierenveertig tegen een
            rondje aan met een gat ernaast waar niets komt. Onder elkaar
            leest het als een pagina die begint: merk, titel, inleiding. */}
        <Text
          style={[
            feedType.kicker,
            {
              color: flameDeep,
              letterSpacing: 0.55,
              marginTop: space.lg,
              marginBottom: 4,
            },
          ]}
        >
          {`@${username || "…"}`}
        </Text>
        {displayName ? (
          <Text
            style={[wide ? feedType.hero : feedType.heroSmall, { color: feed.ink }]}
            numberOfLines={2}
          >
            {displayName}
          </Text>
        ) : null}

        {/* De bio op leesmaat en niet over de volle bladspiegel: een regel
            van twaalfhonderd punten is er één die je hoofd moet volgen in
            plaats van lezen. Zelfde redenering als `maxWidth` in PageHead. */}
        {bio ? (
          <View style={{ marginTop: space.lg, maxWidth: 620 }}>
            <RichText
              text={bio}
              style={feedType.taglineSmall}
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
            style={{ height: CONTROL_H, justifyContent: "center", marginTop: space.sm }}
          >
            <Text
              style={[
                feedType.label,
                { color: feed.inkDim, textDecorationLine: "underline" },
              ]}
            >
              Voeg een bio toe
            </Text>
          </Pressable>
        ) : null}

        {links.length > 0 ? <ProfileLinkList links={links} wide={wide} /> : null}
      </View>
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
  wide = false,
}: {
  uri?: string | null;
  busy?: boolean;
  onPick?: () => void;
  userId?: string;
  wide?: boolean;
}) {
  const mine = !!onPick;
  /**
   * Of de muis erboven hangt.
   *
   * De wijzigknop stond er altijd, en dat is een blijvend bedieningselement
   * over je eigen omslag — precies het ding waar de plaat niet voor
   * bedoeld is. Nu komt hij op bij het zweven; op een aanraakscherm, waar
   * zweven niet bestaat, blijft de plaat zélf de knop en is er dus niets
   * verloren.
   *
   * Bij een lége plaat ligt het andersom: dan ís de knop de hele inhoud, en
   * iets dat alleen bij zweven verschijnt zou op een telefoon een leeg vak
   * zonder uitleg zijn. Zie de `!uri`-tak hieronder.
   */
  const [hovered, setHovered] = useState(false);

  if (!uri) {
    if (!mine) return null;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Kies een plaat voor je profiel"
        onPress={onPick}
        style={({ pressed }) => ({
          width: "100%",
          aspectRatio: wide ? 6 : 3,
          borderBottomWidth: FEED_BORDER,
          borderBottomColor: rule.soft,
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
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      // Breder op een breed scherm, hoger op een telefoon. Eén vaste
      // verhouding zou op een van beide fout zijn: 3:1 is op een telefoon
      // een streep van honderd punten, en 1.6:1 vult op een monitor het
      // hele eerste scherm met alleen de omslag.
      style={{ width: "100%", aspectRatio: wide ? 3 : 1.6 }}
    >
      <SafeImage
        uri={uri}
        cacheKey={userId ? `${userId}-hero` : undefined}
        style={{ width: "100%", height: "100%" }}
        contentFit="cover"
        fallbackBg="bg-feed-fill"
        fallbackColor={feed.textDim}
      />
      {/* De balk ligt hierover en de naam hangt over de onderrand; zonder
          sluier vallen ze allebei weg op een lichte foto. Geen schaduw —
          die staan niet in dit systeem — maar het verloop uit `Scrim`. */}
      <Scrim height={140} strength={0.5} steps={12} />
      {mine && (hovered || busy) ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            bottom: space.lg,
            right: space.lg,
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
export function ProfileLinkList({
  links,
  wide = false,
}: {
  links: { label: string; url: string }[];
  wide?: boolean;
}) {
  return (
    <View style={{ marginTop: space.section }}>
      <Text
        style={[
          feedType.kicker,
          { color: flameDeep, letterSpacing: 0.55, marginBottom: space.md },
        ]}
      >
        ELDERS
      </Text>
      <View style={{ borderTopWidth: FEED_BORDER, borderTopColor: feed.ink }}>
        {links.map((link, i) => (
          <Pressable
            key={`${link.url}-${i}`}
            accessibilityRole="link"
            accessibilityLabel={`${link.label}, opent ${link.url}`}
            onPress={() => void openUrl(link.url)}
            style={({ pressed }) => ({
              // Etiket links, adres rechts, lijn ertussen — de opbouw van
              // `LabelBand` uit de rasterlaag (§4c). Dat leest als een
              // colofon en niet als een rij knoppen, en dat is wat het is:
              // de bronnen onderaan je pagina. Op smal valt hij onder
              // elkaar; 180 punten etiket naast een telefoon laat niets over.
              flexDirection: wide ? "row" : "column",
              alignItems: wide ? "center" : "flex-start",
              gap: wide ? space.lg : 2,
              // Eén besturingshoogte als ondergrens; een rij met een lange
              // naam mag groeien maar nooit krimpen.
              minHeight: 52,
              paddingVertical: space.md,
              borderBottomWidth: FEED_BORDER,
              borderBottomColor: rule.soft,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text
              style={[
                feedType.body,
                {
                  color: feed.ink,
                  fontWeight: "700",
                  ...(wide ? { width: 180 } : null),
                },
              ]}
              numberOfLines={1}
            >
              {link.label}
            </Text>
            <Text
              style={[
                feedType.caption,
                { color: feed.inkDim, flex: wide ? 1 : undefined },
              ]}
              numberOfLines={1}
            >
              {link.url.replace(/^https?:\/\//i, "")}
            </Text>
            {wide ? <Ionicons name="arrow-forward" color={feed.inkDim} size={16} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}
