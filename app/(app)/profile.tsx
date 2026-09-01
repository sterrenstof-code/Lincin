import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { ActivityHistory } from "@/components/ActivityHistory";
import { InteractionSummaryCard } from "@/components/InteractionSummary";
import { PostGrid } from "@/components/PostGrid";
import { ProfileHeader } from "@/components/ProfileHeader";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { RubricHead } from "@/components/PageHead";
import { feed, feedType, flameDeep, space } from "@/lib/design/type";
import { useAuth } from "@/lib/auth/provider";
import {
  getProfile,
  updateMyProfile,
  uploadAvatar,
  uploadProfileHero,
} from "@/lib/api/profiles";
import { getInteractionSummary } from "@/lib/api/interactions";
import { listUserPosts } from "@/lib/api/posts";
import { uriToBytes } from "@/lib/crypto/file";
import { bytesToBase64 } from "@/lib/crypto/base64";
import { loadIdentity } from "@/lib/crypto/keys";
import {
  checkKeySync,
  resetDeviceIdentity,
  resyncDevice,
  type KeySyncStatus,
} from "@/lib/crypto/sync";
import { confirm } from "@/lib/confirm";
import { useToast } from "@/lib/toast";
import { getPushStatus, sendTestPush, type PushStatus } from "@/lib/push";
import { usePageTitle } from "@/lib/page-title";

export default function ProfileScreen() {
  usePageTitle("Profiel");
  const { session, signOut } = useAuth();
  const router = useRouter();
  const wide = useWide();
  const chrome = useChromeScroll();
  const qc = useQueryClient();
  const toast = useToast();
  const myUserId = session!.user.id;

  const [pubkey, setPubkey] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [heroUploading, setHeroUploading] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [keySync, setKeySync] = useState<KeySyncStatus | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);

  const myPosts = useQuery({
    queryKey: ["posts-by-user", myUserId],
    queryFn: () => listUserPosts(myUserId, 60),
    enabled: !!myUserId,
  });

  /**
   * Hoeveel je de laatste maand gedaan hebt. Eigen query en geen onderdeel
   * van `profile`: hij is trager (zes tellingen), hij mag falen zonder de
   * kop mee te nemen, en hij hoeft niet opnieuw als je je bio aanpast.
   */
  const interactions = useQuery({
    queryKey: ["interaction-summary", myUserId],
    queryFn: () => getInteractionSummary(myUserId, 30),
    enabled: !!myUserId,
    staleTime: 5 * 60_000,
  });

  const profile = useQuery({
    queryKey: ["profile", myUserId],
    queryFn: () => getProfile(myUserId),
  });

  useEffect(() => {
    loadIdentity().then((id) => {
      if (id) setPubkey(bytesToBase64(id.publicKey));
    });
    getPushStatus().then(setPushStatus);
    checkKeySync(myUserId)
      .then(setKeySync)
      .catch(() => setKeySync({ kind: "no-profile" }));
  }, [myUserId]);

  async function onSyncKeys() {
    setKeyBusy(true);
    setKeyMsg(null);
    try {
      await resyncDevice(myUserId);
      const fresh = await checkKeySync(myUserId);
      setKeySync(fresh);
      setKeyMsg("✓ Toestel opnieuw geregistreerd. Nieuwe berichten zullen ontsleutelen.");
    } catch (e: any) {
      setKeyMsg(e?.message ?? "Registratie mislukt.");
    } finally {
      setKeyBusy(false);
    }
  }

  async function onResetIdentity() {
    const ok = await confirm(
      "Reset device keys",
      "Je krijgt verse keys. Oude berichten op andere toestellen kan je niet meer ontsleutelen — Signal-stijl. Nieuwe berichten werken vanaf nu. Doorgaan?",
      { affirmativeLabel: "Reset", destructive: true }
    );
    if (!ok) return;
    setKeyBusy(true);
    setKeyMsg(null);
    try {
      const fresh = await resetDeviceIdentity(myUserId);
      setPubkey(bytesToBase64(fresh.publicKey));
      setKeySync({ kind: "ok", pubkey: bytesToBase64(fresh.publicKey) });
      setKeyMsg("✓ Nieuwe keys gegenereerd en gepubliceerd.");
    } catch (e: any) {
      setKeyMsg(e?.message ?? "Reset mislukt.");
    } finally {
      setKeyBusy(false);
    }
  }

  async function onTestPush() {
    if (pushStatus?.kind !== "ready") return;
    setPushBusy(true);
    setPushResult(null);
    const result = await sendTestPush(pushStatus.token);
    setPushResult(
      result.ok
        ? "Verstuurd via Expo Push. Check je toestel — kan een paar seconden duren."
        : `Niet gelukt: ${result.detail}`
    );
    setPushBusy(false);
  }


  /**
   * De plaat. Bijsnijden op 3:1 en niet vierkant: dat is de verhouding
   * waarin hij getoond wordt, en iemand een vierkant laten kiezen dat
   * daarna tot een strook wordt geknipt is de bijsnijder twee keer laten
   * doen — één keer voor niets.
   */
  async function onPickHero() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    await uploadPickedHero(result.assets[0].uri, result.assets[0].mimeType);
  }

  /** Apart van het kiezen, om dezelfde reden als bij de avatar hieronder. */
  async function uploadPickedHero(uri: string, mimeType?: string | null) {
    setHeroUploading(true);
    try {
      const bytes = await uriToBytes(uri);
      const newUrl = await uploadProfileHero(myUserId, bytes, mimeType ?? "image/jpeg");
      await updateMyProfile(myUserId, { hero_url: newUrl });
      await qc.invalidateQueries({ queryKey: ["profile", myUserId] });
    } catch {
      toast.error("De plaat kon niet geüpload worden.", {
        action: {
          label: "Opnieuw",
          onPress: () => uploadPickedHero(uri, mimeType),
        },
      });
    } finally {
      setHeroUploading(false);
    }
  }

  async function onPickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    await uploadPickedAvatar(result.assets[0].uri, result.assets[0].mimeType);
  }

  /**
   * De upload apart van het kiezen, en wel hierom: "Opnieuw" hoort de
   * mislukte handeling over te doen. Toen dit één functie was, opende die
   * knop de fotobibliotheek opnieuw — dan gooi je de foto die de gebruiker
   * net gekozen én bijgesneden heeft weg om hem hetzelfde nog eens te laten
   * doen. Dat is geen nieuwe poging, dat is opnieuw beginnen.
   */
  async function uploadPickedAvatar(uri: string, mimeType?: string | null) {
    setAvatarUploading(true);
    try {
      const bytes = await uriToBytes(uri);
      const newUrl = await uploadAvatar(myUserId, bytes, mimeType ?? "image/jpeg");
      await updateMyProfile(myUserId, { avatar_url: newUrl });
      await qc.invalidateQueries({ queryKey: ["profile", myUserId] });
    } catch {
      // Zonder dit draaide het schijfje, stopte het, en bleef dezelfde
      // avatar staan — de enige aanwijzing dat er iets mislukt was.
      toast.error("De foto kon niet geüpload worden.", {
        action: {
          label: "Opnieuw",
          onPress: () => uploadPickedAvatar(uri, mimeType),
        },
      });
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top"]}>
      {/* Eén scroller voor de hele pagina; de kop plakt bovenaan. */}
      <PageScroll
        wide={wide}
        progress={chrome.progress}
        onScroll={chrome.onScroll}
        scrollEventThrottle={chrome.scrollEventThrottle}
        compact
        // Naar beneden trekken om te verversen. Stond op de feed, de agenda
        // en de meldingen, en op deze drie niet — terwijl het gebaar hier
        // net zo hard verwacht wordt. `isFetching && !isLoading`: bij de
        // eerste keer laden dragen de skeletons het, dit is voor daarna.
        refreshControl={
          <RefreshControl
            refreshing={myPosts.isFetching && !myPosts.isLoading}
            onRefresh={() => {
              void myPosts.refetch();
              void profile.refetch();
            }}
            tintColor={feed.ink}
          />
        }
        contentStyle={{ paddingVertical: 20, paddingBottom: 60 }}
      >
        {/* ---- De kop: plaat, avatar, bio, links ---- */}
        {/*
            Stond hier uitgeschreven en op andermans profiel nóg een keer,
            met een eigen opbouw. Nu één onderdeel voor allebei; het
            verschil is alleen wat je mag — zie components/ProfileHeader.tsx.
        */}
        <ProfileHeader
          profile={profile.data}
          email={session?.user.email}
          heroBusy={heroUploading}
          avatarBusy={avatarUploading}
          onPickHero={onPickHero}
          onPickAvatar={onPickAvatar}
          onEditBio={() => router.push("/profile-edit")}
        />

        {/*
            Op een breed scherm staat het overzicht náást je vondsten en
            niet eronder: het is een samenvatting van hetzelfde, en een
            samenvatting die je pas ziet nadat je langs zestig tegels
            gescrold bent vat niets meer samen. Op een telefoon is er geen
            kolom naast, en dan gaat hij erbóven — nog steeds vóór de
            tegels, want dat is waar hij thuishoort.
        */}
        <View
          style={{
            // `column-reverse` op smal, en dat is geen truc: het overzicht
            // staat in de opmaak ná het raster omdat het op breed rechts
            // hoort, maar het hoort er vóór te staan als er geen kolom
            // naast is. RN kent geen `order`, dus de richting doet het.
            flexDirection: wide ? "row" : "column-reverse",
            gap: space.section,
            marginTop: space.section,
          }}
        >
          <View style={{ flex: wide ? 1 : undefined }}>
            <Text
              style={[
                feedType.kicker,
                { color: flameDeep, letterSpacing: 0.55, marginBottom: space.lg },
              ]}
            >
              JOUW VONDSTEN
            </Text>
            {/* "Plaats je eerste vondst vanaf de feed" noemde een scherm en
                gaf er geen ingang bij — terwijl dit de pagina over jouw werk
                is en de composer één tik verderop ligt. */}
            <PostGrid
              posts={myPosts.data}
              loading={myPosts.isLoading}
              // Onder élke tegel hier staat dezelfde naam: die van jou. Dan
              // is een naam op de tegel geen informatie maar een sluier
              // over de foto. Zie `bare` in components/PostGrid.tsx.
              bare
              emptyTitle="Je hebt nog niets gedeeld"
              emptyLabel="Een link die je bijbleef, een zin uit wat je las, een foto. Wat je hier deelt komt in de feed van je lincs."
              emptyAction={{
                label: "Deel je eerste vondst",
                onPress: () => router.push("/post-compose"),
              }}
            />
          </View>

          <View style={{ width: wide ? 300 : undefined }}>
            <InteractionSummaryCard
              data={interactions.data}
              loading={interactions.isLoading}
              error={interactions.isError ? interactions.error : undefined}
              onRetry={() => interactions.refetch()}
            />
          </View>
        </View>


        {/* ---- Profile actions ---- */}
        <RubricHead label="Profiel" style={{ marginTop: space.xxl }} />
        <Pressable
          onPress={() => router.push("/profile-edit")}
          className="flex-row items-center bg-paper-soft active:bg-paper px-4 py-4 mb-2"
        >
          <View className="w-9 h-9 bg-paper-warm items-center justify-center">
            <Ionicons name="create-outline" color={feed.ink} size={18} />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-ink font-semibold">Bewerk profiel</Text>
            <Text className="text-ink-muted text-xs mt-0.5">
              Pas je handle of weergavenaam aan
            </Text>
          </View>
          <Ionicons name="chevron-forward" color={feed.inkDim} size={18} />
        </Pressable>

        {/* ---- Geavanceerd (versleuteling + notificaties) ---- */}
        <Pressable
          onPress={() => setAdvancedOpen((v) => !v)}
          className="flex-row items-center mt-6 mb-1 px-1"
        >
          <Text className="text-xs uppercase tracking-wider text-ink-muted flex-1">
            Geavanceerd
          </Text>
          <Ionicons
            name={advancedOpen ? "chevron-up" : "chevron-down"}
            color={feed.inkDim}
            size={14}
          />
        </Pressable>

        {advancedOpen && <>

        <Text className="text-xs uppercase tracking-wider text-ink-muted mt-4 mb-3 px-1">
          Versleuteling
        </Text>
        <View className="bg-paper-soft p-5">
          <View className="flex-row items-center mb-3">
            <View className="w-9 h-9 bg-brand/20 items-center justify-center">
              <Ionicons name="lock-closed" color="#5B8DEF" size={18} />
            </View>
            <Text className="text-ink font-semibold ml-3">End-to-end versleuteld</Text>
          </View>
          <Text className="text-ink-soft text-sm leading-5">
            Berichten worden versleuteld met X25519 + XChaCha20-Poly1305. Je
            encryptie-sleutel is gekoppeld aan je account — elk apparaat
            waarop je inlogt kan automatisch berichten lezen.
          </Text>
          <View className="bg-paper-light border border-line-paper mt-4 p-3">
            <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
              Identity public key
            </Text>
            <Text className="text-ink text-xs font-mono" numberOfLines={2}>
              {pubkey ?? "—"}
            </Text>
          </View>

          {/* Sleutelstatus */}
          {keySync && keySync.kind === "ok" && (
            <View className="flex-row items-center mt-3">
              <Ionicons name="checkmark-circle" color="#22c55e" size={14} />
              <Text className="text-ink-muted text-xs ml-1.5">
                Sleutels actief — berichten worden correct ontsleuteld
              </Text>
            </View>
          )}
          {keySync && keySync.kind !== "ok" && (
            <View className="bg-red-100 border border-red-300 mt-3 p-3">
              <Text className="text-red-900 text-xs font-semibold mb-1">
                {keySync.kind === "no-keys"
                  ? "⚠ Geen encryptie-sleutels"
                  : "⚠ Geen profiel gevonden"}
              </Text>
              <Text className="text-red-900 text-xs leading-5">
                {keySync.kind === "no-keys"
                  ? "Klik 'Herstel sleutels' om de sleutels van de server te halen."
                  : "Profielrij ontbreekt. Probeer uit te loggen en opnieuw aan te melden."}
              </Text>
            </View>
          )}

          {/* Bugbord — één gedeelde lijst in plaats van los geklaag */}
          <Pressable
            onPress={() => router.push("/bugs")}
            className="flex-row items-center bg-paper-soft active:bg-paper px-4 py-3 mt-3"
          >
            <Ionicons name="bug-outline" color={feed.ink} size={18} />
            <View className="flex-1 ml-3">
              <Text className="text-ink font-semibold text-sm">Iets werkt niet</Text>
              <Text className="text-ink-muted text-xs mt-0.5">
                Meld het, of kijk of iemand je voor was
              </Text>
            </View>
            <Ionicons name="chevron-forward" color={feed.inkDim} size={16} />
          </Pressable>

          {/* Apparaat koppelen — QR-overdracht naar nieuw toestel */}
          <Pressable
            onPress={() => router.push("/device-link")}
            className="flex-row items-center bg-brand/10 active:bg-brand/20 px-4 py-3 mt-3"
          >
            <Ionicons name="qr-code-outline" color="#5B8DEF" size={18} />
            <View className="flex-1 ml-3">
              <Text className="text-brand font-semibold text-sm">
                Nieuw apparaat koppelen
              </Text>
              <Text className="text-ink-muted text-xs mt-0.5">
                QR-code — chats blijven leesbaar
              </Text>
            </View>
            <Ionicons name="chevron-forward" color="#5B8DEF" size={16} />
          </Pressable>

          <View className="flex-row gap-2 mt-2">
            <Pressable
              onPress={onSyncKeys}
              disabled={keyBusy || keySync?.kind === "ok" || keySync?.kind === "no-profile"}
              className={`flex-1 py-2.5 items-center ${
                !keyBusy && keySync?.kind !== "ok" && keySync?.kind !== "no-profile"
                  ? "bg-ink active:bg-ink-soft"
                  : "bg-paper-warm"
              }`}
            >
              <Text
                className={`font-semibold text-xs ${
                  !keyBusy && keySync?.kind !== "ok" && keySync?.kind !== "no-profile"
                    ? "text-cream"
                    : "text-ink-muted"
                }`}
              >
                Herstel sleutels
              </Text>
            </Pressable>
            <Pressable
              onPress={onResetIdentity}
              disabled={keyBusy}
              className="flex-1 py-2.5 items-center border border-red-300"
            >
              <Text className="text-red-700 font-semibold text-xs">
                Reset sleutels
              </Text>
            </Pressable>
          </View>
          {keyMsg && (
            <Text className="text-ink-soft text-xs mt-2 text-center">
              {keyMsg}
            </Text>
          )}
        </View>

        {/* ---- Push status ---- */}
        <Text className="text-xs uppercase tracking-wider text-ink-muted mt-6 mb-3 px-1">
          Notificaties
        </Text>

        <View className="bg-paper-soft p-5">
          <View className="flex-row items-center mb-2">
            <View className="w-9 h-9 bg-paper-warm items-center justify-center">
              <Ionicons
                name={pushStatus?.kind === "ready" ? "notifications" : "notifications-off-outline"}
                color={feed.ink}
                size={18}
              />
            </View>
            <Text className="text-ink font-semibold ml-3">
              {pushStatus?.kind === "ready" ? "Push actief" : "Push nog niet actief"}
            </Text>
          </View>
          <Text className="text-ink-soft text-xs leading-5">
            {pushStatusMessage(pushStatus)}
          </Text>
          {pushStatus?.kind === "ready" && (
            <>
              <View className="bg-paper-light border border-line-paper mt-3 p-3">
                <Text className="text-xs uppercase tracking-wider text-ink-muted mb-1">
                  Push token ({pushStatus.platform})
                </Text>
                <Text className="text-ink text-xs font-mono" numberOfLines={2}>
                  {pushStatus.token}
                </Text>
              </View>
              <Pressable
                onPress={onTestPush}
                disabled={pushBusy}
                className="mt-3 bg-ink active:bg-ink-soft py-2.5 items-center"
              >
                <Text className="text-cream font-semibold text-sm">
                  {pushBusy ? "Bezig…" : "Stuur test-notificatie"}
                </Text>
              </Pressable>
              {pushResult && (
                <Text className="text-ink-soft text-xs mt-2 text-center">
                  {pushResult}
                </Text>
              )}
            </>
          )}
        </View>

        </>}

        {/* ---- Alles wat je gedaan hebt ---- */}
        <ActivityHistory
          userId={myUserId}
          title="Jouw activiteit"
          emptyLabel="Zodra je iets deelt of ergens aan meedoet, staat het hier."
        />

        {/* ---- Sign out ---- */}
        <Pressable
          /**
           * Uitloggen vroeg niets. Eén tik en weg.
           *
           * Het was de enige destructieve handeling in de app zónder
           * bevestiging — en hij staat onderaan een scherm waar je met je
           * duim langs scrolt. In een end-to-end versleutelde app is dat
           * bovendien geen "even opnieuw inloggen": de sleutels van dit
           * toestel raak je niet kwijt, maar je bent er wel uit en moet
           * terug via de mail.
           */
          onPress={async () => {
            const ok = await confirm(
              "Uitloggen",
              "Je wordt uitgelogd op dit toestel. Om terug te komen heb je je e-mail of je wachtwoord nodig.",
              { affirmativeLabel: "Uitloggen", destructive: true }
            );
            if (ok) signOut();
          }}
          className="mt-8 border border-ink py-3 items-center"
        >
          <Text className="text-ink font-semibold">Uitloggen</Text>
        </Pressable>
      </PageScroll>
    </SafeAreaView>
  );
}

function pushStatusMessage(status: PushStatus | null): string {
  if (!status) return "Status wordt opgehaald…";
  switch (status.kind) {
    case "ready":
      return "Dit toestel kan push-notificaties ontvangen. Wanneer er een Edge Function deployt staat, krijg je een melding bij elk nieuw bericht of vriendschapsverzoek.";
    case "permission-denied":
      return "Je hebt notificaties geweigerd. Pas dit aan in je systeeminstellingen om pushes te ontvangen.";
    case "no-token":
      return "Toestel heeft geen push-token kunnen genereren. Probeer opnieuw in te loggen.";
    case "unsupported":
      return status.reason;
    default:
      return "";
  }
}
