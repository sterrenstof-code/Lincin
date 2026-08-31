import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { ActivityHistory } from "@/components/ActivityHistory";
import { PostGrid } from "@/components/PostGrid";
import { Avatar } from "@/components/Avatar";
import { PageScroll, useChromeScroll } from "@/components/AppChrome";
import { useWide } from "@/components/Editorial";
import { RubricHead } from "@/components/PageHead";
import { creamOnDark, feed, feedType, flameDeep, space } from "@/lib/design/type";
import { useAuth } from "@/lib/auth/provider";
import { getProfile, updateMyProfile, uploadAvatar } from "@/lib/api/profiles";
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

export default function ProfileScreen() {
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

  const username = profile.data?.username ?? "";
  const displayName = profile.data?.display_name;
  const heroName = displayName ?? username;
  const avatarUrl = profile.data?.avatar_url ?? null;

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
        contentStyle={{ paddingVertical: 20, paddingBottom: 60 }}
      >
        {/* ---- Hero on shell ---- */}
        <View className="items-center mt-2 mb-6">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Profielfoto wijzigen"
            onPress={onPickAvatar} className="relative">
            <Avatar name={heroName} avatarUrl={avatarUrl} size="hero" tint="warm" />
            <View className="absolute bottom-0 right-0 w-7 h-7 bg-ink border-2 border-shell items-center justify-center">
              {avatarUploading
                ? <ActivityIndicator size="small" color={creamOnDark.DEFAULT} />
                : <Ionicons name="camera" color={creamOnDark.DEFAULT} size={14} />
              }
            </View>
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
          <Text style={[feedType.label, { color: feed.inkDim, marginTop: space.xs }]}>
            {session?.user.email}
          </Text>
          {profile.data?.bio ? (
            <Text className="text-ink-soft text-sm leading-5 text-center mt-3 px-6" style={{ maxWidth: 460 }}>
              {profile.data.bio}
            </Text>
          ) : (
            <Pressable onPress={() => router.push("/profile-edit")} className="mt-3">
              <Text className="text-ink-muted text-xs underline">Voeg een bio toe</Text>
            </Pressable>
          )}
        </View>

        {/* ---- Alles wat je gedeeld hebt ---- */}
        {/*
            Hier stond het "Link up"-blok: scan een linc, deel je linc,
            nodig iemand uit. Dat hoort bij Vrienden — daar staan die drie
            knoppen ook al — en niet op de pagina over je account. Wat hier
            wél hoort is je eigen werk: het raster van je vondsten, met
            dezelfde beweging naar de volledige plaat als vanuit de feed.
        */}
        <Text
          style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55, marginBottom: space.lg }]}
        >
          JOUW VONDSTEN
        </Text>
        <PostGrid
          posts={myPosts.data}
          loading={myPosts.isLoading}
          emptyLabel="Je hebt nog niets gedeeld. Plaats je eerste vondst vanaf de feed."
        />

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
          onPress={signOut}
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
