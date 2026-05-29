import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";

import { Avatar } from "@/components/Avatar";
import { ScreenContainer } from "@/components/ScreenContainer";
import { useAuth } from "@/lib/auth/provider";
import { getProfile, updateMyProfile, uploadAvatar } from "@/lib/api/profiles";
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
import { getPushStatus, sendTestPush, type PushStatus } from "@/lib/push";
import { buildAddFriendUrl, copyToClipboard, shareText } from "@/lib/share";

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const myUserId = session!.user.id;

  const [pubkey, setPubkey] = useState<string | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [pushStatus, setPushStatus] = useState<PushStatus | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);
  const [keySync, setKeySync] = useState<KeySyncStatus | null>(null);
  const [keyBusy, setKeyBusy] = useState(false);
  const [keyMsg, setKeyMsg] = useState<string | null>(null);

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

  function flashCopyHint(text: string) {
    setCopyHint(text);
    setTimeout(() => setCopyHint(null), 1600);
  }

  const username = profile.data?.username ?? "";
  const displayName = profile.data?.display_name;
  const heroName = displayName ?? username;
  const avatarUrl = profile.data?.avatar_url ?? null;
  const addUrl = username ? buildAddFriendUrl(username) : "";

  async function onPickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAvatarUploading(true);
    try {
      const bytes = await uriToBytes(asset.uri);
      const mime = asset.mimeType ?? "image/jpeg";
      const newUrl = await uploadAvatar(myUserId, bytes, mime);
      await updateMyProfile(myUserId, { avatar_url: newUrl });
      await qc.invalidateQueries({ queryKey: ["profile", myUserId] });
    } catch (e: any) {
      console.warn("avatar upload", e?.message ?? e);
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onCopyHandle() {
    if (!username) return;
    const ok = await copyToClipboard(`@${username}`);
    if (ok) flashCopyHint("Handle gekopieerd");
  }

  async function onCopyUrl() {
    if (!addUrl) return;
    const ok = await copyToClipboard(addUrl);
    if (ok) flashCopyHint("Link gekopieerd");
  }

  async function onShareUrl() {
    if (!addUrl) return;
    const result = await shareText({
      title: "Voeg me toe op Lincin",
      message: `Voeg me toe op Lincin: ${addUrl}`,
    });
    if (result === "copied") flashCopyHint("Link gekopieerd");
  }

  return (
    <SafeAreaView className="flex-1 bg-shell" edges={["top"]}>
      <ScreenContainer>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        {/* ---- Hero on shell ---- */}
        <View className="items-center mt-2 mb-6">
          <Pressable onPress={onPickAvatar} className="relative">
            <Avatar name={heroName} avatarUrl={avatarUrl} size="hero" tint="warm" />
            <View className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-ink border-2 border-shell items-center justify-center">
              {avatarUploading
                ? <ActivityIndicator size="small" color="#F5E8D3" />
                : <Ionicons name="camera" color="#F5E8D3" size={14} />
              }
            </View>
          </Pressable>
          {displayName ? (
            <Text className="text-2xl font-bold tracking-tight text-cream mt-3">
              {displayName}
            </Text>
          ) : null}
          <Text className="text-cream-soft text-base mt-0.5">
            @{username || "…"}
          </Text>
          <Text className="text-cream-muted text-xs mt-1">
            {session?.user.email}
          </Text>
        </View>

        {/* ---- Flame highlight: share link ---- */}
        <View className="bg-flame rounded-3xl p-6 mb-3">
          <Text className="text-xs uppercase tracking-wider text-cream/80 mb-1">
            Link up
          </Text>
          <Text className="text-2xl font-bold tracking-tight text-cream mb-4">
            Deel je Lincin-link
          </Text>
          {addUrl ? (
            <Text className="text-cream/90 text-sm font-mono mb-5" numberOfLines={1}>
              {addUrl}
            </Text>
          ) : null}
          <View className="flex-row gap-2">
            <Pressable
              onPress={onShareUrl}
              className="flex-1 bg-ink active:bg-ink-soft rounded-full px-5 py-3 flex-row items-center justify-center"
            >
              <Ionicons name="share-outline" color="#F5E8D3" size={18} />
              <Text className="text-cream font-semibold ml-2">Deel link</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push("/qr-code")}
              className="bg-cream active:bg-cream-soft rounded-full w-12 h-12 items-center justify-center"
            >
              <Ionicons name="qr-code-outline" color="#1A1714" size={20} />
            </Pressable>
          </View>
        </View>

        {/* ---- Secondary share actions ---- */}
        <View className="flex-row gap-3 mb-3">
          <Pressable
            onPress={onCopyHandle}
            className="flex-1 flex-row items-center justify-center bg-paper-soft active:bg-paper rounded-2xl px-4 py-3.5"
          >
            <Ionicons name="at-outline" color="#1A1714" size={18} />
            <Text className="text-ink font-semibold ml-2">Kopieer @</Text>
          </Pressable>
          <Pressable
            onPress={onCopyUrl}
            className="flex-1 flex-row items-center justify-center bg-paper-soft active:bg-paper rounded-2xl px-4 py-3.5"
          >
            <Ionicons name="link-outline" color="#1A1714" size={18} />
            <Text className="text-ink font-semibold ml-2">Kopieer link</Text>
          </Pressable>
        </View>

        {copyHint && (
          <View className="items-center mb-3">
            <View className="bg-paper-warm rounded-full px-3 py-1">
              <Text className="text-ink text-xs font-medium">✓ {copyHint}</Text>
            </View>
          </View>
        )}

        {/* ---- Profile actions ---- */}
        <Text className="text-xs uppercase tracking-wider text-cream-muted mt-6 mb-3 px-1">
          Profiel
        </Text>
        <Pressable
          onPress={() => router.push("/profile-edit")}
          className="flex-row items-center bg-paper-soft active:bg-paper rounded-2xl px-4 py-4 mb-2"
        >
          <View className="w-9 h-9 rounded-full bg-paper-warm items-center justify-center">
            <Ionicons name="create-outline" color="#1A1714" size={18} />
          </View>
          <View className="flex-1 ml-3">
            <Text className="text-ink font-semibold">Bewerk profiel</Text>
            <Text className="text-ink-muted text-xs mt-0.5">
              Pas je handle of weergavenaam aan
            </Text>
          </View>
          <Ionicons name="chevron-forward" color="#8A7E6C" size={18} />
        </Pressable>

        {/* ---- Geavanceerd (versleuteling + notificaties) ---- */}
        <Pressable
          onPress={() => setAdvancedOpen((v) => !v)}
          className="flex-row items-center mt-6 mb-1 px-1"
        >
          <Text className="text-xs uppercase tracking-wider text-cream-muted flex-1">
            Geavanceerd
          </Text>
          <Ionicons
            name={advancedOpen ? "chevron-up" : "chevron-down"}
            color="#8A7E6C"
            size={14}
          />
        </Pressable>

        {advancedOpen && <>

        <Text className="text-xs uppercase tracking-wider text-cream-muted mt-4 mb-3 px-1">
          Versleuteling
        </Text>
        <View className="bg-paper-soft rounded-2xl p-5">
          <View className="flex-row items-center mb-3">
            <View className="w-9 h-9 rounded-full bg-brand/20 items-center justify-center">
              <Ionicons name="lock-closed" color="#5B8DEF" size={18} />
            </View>
            <Text className="text-ink font-semibold ml-3">End-to-end versleuteld</Text>
          </View>
          <Text className="text-ink-soft text-sm leading-5">
            Berichten worden versleuteld met X25519 + XChaCha20-Poly1305. Je
            encryptie-sleutel is gekoppeld aan je account — elk apparaat
            waarop je inlogt kan automatisch berichten lezen.
          </Text>
          <View className="bg-paper-light border border-line-paper rounded-xl mt-4 p-3">
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
            <View className="bg-red-100 border border-red-300 rounded-xl mt-3 p-3">
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

          {/* Apparaat koppelen — QR-overdracht naar nieuw toestel */}
          <Pressable
            onPress={() => router.push("/device-link" as any)}
            className="flex-row items-center bg-brand/10 active:bg-brand/20 rounded-2xl px-4 py-3 mt-3"
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
              className={`flex-1 rounded-full py-2.5 items-center ${
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
              className="flex-1 rounded-full py-2.5 items-center border border-red-300"
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
        <Text className="text-xs uppercase tracking-wider text-cream-muted mt-6 mb-3 px-1">
          Notificaties
        </Text>

        <View className="bg-paper-soft rounded-2xl p-5">
          <View className="flex-row items-center mb-2">
            <View className="w-9 h-9 rounded-full bg-paper-warm items-center justify-center">
              <Ionicons
                name={pushStatus?.kind === "ready" ? "notifications" : "notifications-off-outline"}
                color="#1A1714"
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
              <View className="bg-paper-light border border-line-paper rounded-xl mt-3 p-3">
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
                className="mt-3 bg-ink active:bg-ink-soft rounded-full py-2.5 items-center"
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

        {/* ---- Sign out ---- */}
        <Pressable
          onPress={signOut}
          className="mt-8 border border-cream-muted rounded-full py-3 items-center"
        >
          <Text className="text-cream font-semibold">Uitloggen</Text>
        </Pressable>
      </ScrollView>
      </ScreenContainer>
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
