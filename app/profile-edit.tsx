import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Avatar } from "@/components/Avatar";
import { CharCount } from "@/components/CharCount";
import { Arrow, BoxButton, Meta, Rule, Sheet, useWide } from "@/components/Editorial";
import { FieldError, FormError } from "@/components/FormError";
import { FormatBar } from "@/components/FormatBar";
import { IconButton } from "@/components/IconButton";
import { useAuth } from "@/lib/auth/provider";
import {
  getProfile,
  MAX_PROFILE_LINKS,
  normalizeLinks,
  updateMyProfile,
  uploadAvatar,
  validateUsername,
  type ProfileLink,
} from "@/lib/api/profiles";
import { uriToBytes } from "@/lib/crypto/file";
import { feed, feedType, flameDeep } from "@/lib/design/type";
import { humanizeError } from "@/lib/errors";
import { safeBack } from "@/lib/nav";

/**
 * Je profiel bewerken — op het blad, niet op het werkblad.
 *
 * Dit was een §8-scherm (DESIGN.md): zwart werkblad, een gevuld lavendel
 * paneel, velden met een eigen vulling, de avatar gecentreerd als een
 * pasfoto. Nu dezelfde opbouw als het deelscherm: een lavendel blad, een
 * kop met kruisje en één gevulde knop, kickers in flame-deep, en velden
 * die niet meer zijn dan een regel met een lijn eronder (§4). De
 * profielfoto staat links, want links uitgelijnd leest als een pagina die
 * begint en gecentreerd als een aankondiging (§8).
 */
export default function ProfileEditScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const wide = useWide();
  const { session, setPassword } = useAuth();
  const myUserId = session!.user.id;

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  /**
   * Waar de cursor staat in de bio, en waar hij na een opmaakknop hóórt te
   * staan. Twee stukjes staat en niet één, want ze bewegen de andere kant
   * op — dezelfde opbouw als in de composer (`app/post-compose.tsx`).
   */
  const [bioSelection, setBioSelection] = useState({ start: 0, end: 0 });
  const [forcedBioSelection, setForcedBioSelection] = useState<
    { start: number; end: number } | null
  >(null);
  const [links, setLinks] = useState<ProfileLink[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [pendingAvatar, setPendingAvatar] = useState<{ uri: string; mimeType: string } | null>(null);
  const displayNameRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [loading, setLoading] = useState(true);
  /** Waarom het formulier er niet is; zie de laadhaak hieronder. */
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [password, setPwd] = useState("");
  const [passwordConfirm, setPwdConfirm] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdResult, setPwdResult] = useState<
    null | { ok: true } | { ok: false; message: string }
  >(null);

  /**
   * Je profiel ophalen — en waarom een mislukking hier gevaarlijk is.
   *
   * Kwam er `null` terug (een rij die de RLS niet teruggeeft, een net
   * aangemaakt account), dan verscheen het formulier eerder met lege
   * velden. Die velden zíjn de invoer: op "Bewaren" drukken overschreef
   * dan je echte gegevens met niets. Vandaar drie standen in plaats van
   * twee, en "Bewaren" bestaat alleen in de derde.
   */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const p = await getProfile(myUserId);
        if (cancelled) return;
        if (!p) {
          setLoadError(
            "Je profiel kon niet gelezen worden. Bewaren zou nu je bestaande gegevens overschrijven, dus dat kan even niet."
          );
          return;
        }
        setUsername(p.username);
        setDisplayName(p.display_name ?? "");
        setBio(p.bio ?? "");
        setLinks(p.links ?? []);
        setAvatarUrl(p.avatar_url);
      } catch (e: unknown) {
        if (cancelled) return;
        setLoadError(
          humanizeError(e, "profile-edit", "Je profiel kon niet geladen worden. Probeer het opnieuw.")
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [myUserId]);

  async function onPickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    const mime = asset.mimeType ?? "image/jpeg";
    setPendingAvatar({ uri: asset.uri, mimeType: mime });
    setAvatarUrl(asset.uri); // lokale voorvertoning meteen
  }

  const usernameError =
    username.length > 0 ? validateUsername(username.toLowerCase()) : null;
  const canSave = !saving && username.length >= 3 && !usernameError;

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      let newAvatarUrl: string | null | undefined = undefined;
      if (pendingAvatar) {
        const bytes = await uriToBytes(pendingAvatar.uri);
        newAvatarUrl = await uploadAvatar(myUserId, bytes, pendingAvatar.mimeType);
      }
      await updateMyProfile(myUserId, {
        username: username.toLowerCase(),
        display_name: displayName,
        bio: bio.trim() ? bio.trim() : null,
        links: normalizeLinks(links),
        ...(newAvatarUrl !== undefined && { avatar_url: newAvatarUrl }),
      });
      await qc.invalidateQueries({ queryKey: ["profile", myUserId] });
      safeBack(router, "/(app)/profile");
    } catch (e: any) {
      setError(e?.message ?? "Kon profiel niet opslaan.");
    } finally {
      setSaving(false);
    }
  }

  const passwordValid =
    password.length >= 8 && password === passwordConfirm && !pwdSaving;

  async function onSavePassword() {
    if (!passwordValid) return;
    setPwdSaving(true);
    setPwdResult(null);
    const { error } = await setPassword(password);
    if (error) {
      setPwdResult({ ok: false, message: error.message });
    } else {
      setPwdResult({ ok: true });
      setPwd("");
      setPwdConfirm("");
    }
    setPwdSaving(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-feed-lav" edges={["top", "left", "right"]}>
      <Sheet flex>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Kop — dezelfde als op het deelscherm: kruisje, titel, één knop. */}
          <View className="flex-row items-center px-6 py-4">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sluiten"
              onPress={() => safeBack(router, "/(app)/profile")}
              hitSlop={10}
            >
              <Ionicons name="close" color={feed.ink} size={22} />
            </Pressable>
            <View className="flex-1 ml-4">
              <Meta tone="feed" strong>Profiel bewerken</Meta>
            </View>
            {saving ? (
              <ActivityIndicator size="small" color={feed.inkDim} />
            ) : loading || loadError ? null : (
              <BoxButton tone="feed" label="Bewaren" filled disabled={!canSave} onPress={onSave} />
            )}
          </View>
          <Rule tone="feed" strong />

          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={feed.inkDim} />
            </View>
          ) : loadError ? (
            /* Geen leeg formulier tonen dat je profiel kan wissen zodra je op
               Bewaren drukt — zie de laadhaak. */
            <View className="px-6 pt-7">
              <FormError>{loadError}</FormError>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 96 }}>
              <View style={wide ? { maxWidth: 720 } : undefined}>
                {/* De profielfoto: links, als een rij die je aantikt. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Profielfoto wijzigen"
                  onPress={onPickAvatar}
                  className="flex-row items-center px-6 py-5 active:bg-feed-panel"
                >
                  <Avatar name={displayName || username} avatarUrl={avatarUrl} size="hero" />
                  <View className="flex-1 ml-5">
                    <Text style={[feedType.tile, { color: feed.ink }]}>Profielfoto</Text>
                    <View className="mt-0.5">
                      <Meta tone="feed" dim>Tik om te wijzigen</Meta>
                    </View>
                  </View>
                  <Arrow tone="feed" dim />
                </Pressable>
                <Rule tone="feed" />

                <Field label="Gebruikersnaam">
                  <View className="flex-row items-center">
                    <Text style={[feedType.tile, { color: feed.inkDim, paddingVertical: 11 }]}>@</Text>
                    <TextInput
                      value={username}
                      onChangeText={(t) => setUsername(t.toLowerCase())}
                      autoCapitalize="none"
                      autoCorrect={false}
                      placeholder="kies een handle"
                      placeholderTextColor={feed.inkDim}
                      maxLength={32}
                      returnKeyType="next"
                      submitBehavior="submit"
                      onSubmitEditing={() => displayNameRef.current?.focus()}
                      style={[INPUT, feedType.tile, { flex: 1, paddingLeft: 4 }]}
                    />
                  </View>
                </Field>
                <Hint error={usernameError}>3–32 tekens. Kleine letters, cijfers, punt of underscore.</Hint>

                <Field label="Weergavenaam — optioneel">
                  <TextInput
                    ref={displayNameRef}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="bv. Tom"
                    placeholderTextColor={feed.inkDim}
                    maxLength={48}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (canSave) void onSave();
                    }}
                    style={[INPUT, feedType.body]}
                  />
                </Field>
                <Hint>Dit zien je vrienden in chats en op je vondsten.</Hint>

                {/* De bio draagt opmaak sinds 0054: dezelfde balk als boven
                    de tekst van een vondst. Platte tekst is geldige
                    markdown, dus bestaande bio's lezen ongewijzigd door. */}
                <Field label="Bio — optioneel">
                  <FormatBar
                    value={bio}
                    selection={bioSelection}
                    onChange={(next) => {
                      setBio(next.text);
                      setForcedBioSelection(next.selection);
                    }}
                  />
                  <TextInput
                    value={bio}
                    onChangeText={setBio}
                    onSelectionChange={(e) => {
                      setBioSelection(e.nativeEvent.selection);
                      if (forcedBioSelection) setForcedBioSelection(null);
                    }}
                    selection={forcedBioSelection ?? undefined}
                    placeholder="Waar ben je mee bezig?"
                    placeholderTextColor={feed.inkDim}
                    multiline
                    maxLength={280}
                    style={[INPUT, feedType.body, { minHeight: 88, textAlignVertical: "top" }]}
                  />
                  <CharCount value={bio} max={280} />
                </Field>
                <Hint>
                  Een paar regels over jezelf, bovenaan je profiel. Selecteer tekst en tik B of I,
                  of typ **vet** en *cursief*.
                </Hint>

                {/* ---- Links ---- */}
                <View className="px-6 pt-7">
                  <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>
                    LINKS — OPTIONEEL
                  </Text>
                  <View className="mt-1">
                    <Meta tone="feed" dim>
                      {`Waar je heen wijst — hoogstens ${MAX_PROFILE_LINKS}. Zonder naam gebruiken we het adres.`}
                    </Meta>
                  </View>
                </View>
                {links.map((link, i) => (
                  <View key={i} className="flex-row items-start px-6 pt-4">
                    <View className="flex-1">
                      <TextInput
                        value={link.label}
                        onChangeText={(t) =>
                          setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, label: t } : l)))
                        }
                        placeholder="Naam"
                        placeholderTextColor={feed.inkDim}
                        maxLength={48}
                        accessibilityLabel={`Naam van link ${i + 1}`}
                        style={[INPUT, feedType.body]}
                      />
                      <Rule tone="feed" />
                      <TextInput
                        value={link.url}
                        onChangeText={(t) =>
                          setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, url: t } : l)))
                        }
                        placeholder="voorbeeld.be"
                        placeholderTextColor={feed.inkDim}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        maxLength={200}
                        accessibilityLabel={`Adres van link ${i + 1}`}
                        style={[INPUT, feedType.body]}
                      />
                      <Rule tone="feed" />
                    </View>
                    <View className="ml-2 mt-2">
                      <IconButton
                        name="close"
                        label={`Link ${i + 1} verwijderen`}
                        onPress={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                        size={16}
                        color={feed.inkDim}
                      />
                    </View>
                  </View>
                ))}
                {links.length < MAX_PROFILE_LINKS ? (
                  <View className="mt-3">
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Link toevoegen"
                      onPress={() => setLinks((prev) => [...prev, { label: "", url: "" }])}
                      className="flex-row items-center px-6 py-5 active:bg-feed-panel"
                    >
                      <Text style={[feedType.tile, { color: feed.ink, flex: 1 }]}>Link toevoegen</Text>
                      <Arrow tone="feed" dim />
                    </Pressable>
                    <Rule tone="feed" />
                  </View>
                ) : null}

                {error ? (
                  <View className="mx-6 mt-7 px-4 py-3" style={{ borderLeftWidth: 2, borderLeftColor: feed.ink }}>
                    <Text style={[feedType.body, { color: feed.ink }]}>{error}</Text>
                  </View>
                ) : null}

                {/* ---- Wachtwoord ---- */}
                <View className="px-6 pt-10">
                  <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>
                    BEVEILIGING
                  </Text>
                  <Text style={[feedType.tile, { color: feed.ink, marginTop: 6 }]}>Wachtwoord</Text>
                  <View className="mt-1">
                    <Meta tone="feed" dim>
                      Waarmee je inlogt. Na &quot;Wachtwoord vergeten&quot; kies je hier een nieuw; je blijft
                      overal ingelogd.
                    </Meta>
                  </View>
                </View>
                <Field label="Nieuw wachtwoord">
                  <TextInput
                    value={password}
                    onChangeText={setPwd}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    placeholder="min. 8 tekens"
                    placeholderTextColor={feed.inkDim}
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => confirmRef.current?.focus()}
                    style={[INPUT, feedType.body]}
                  />
                </Field>
                <Field label="Bevestig">
                  <TextInput
                    ref={confirmRef}
                    value={passwordConfirm}
                    onChangeText={setPwdConfirm}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    placeholder="herhaal je wachtwoord"
                    placeholderTextColor={feed.inkDim}
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (passwordValid) void onSavePassword();
                    }}
                    style={[INPUT, feedType.body]}
                  />
                </Field>
                {password.length > 0 && password.length < 8 ? (
                  <Hint error="Minstens 8 tekens." />
                ) : passwordConfirm.length > 0 && password !== passwordConfirm ? (
                  <Hint error="De bevestiging is niet hetzelfde." />
                ) : null}
                <View className="px-6 pt-6">
                  <BoxButton
                    tone="feed"
                    label={pwdSaving ? "Bezig…" : "Wachtwoord opslaan"}
                    disabled={!passwordValid}
                    onPress={onSavePassword}
                  />
                </View>
                {pwdResult?.ok === true ? (
                  <View className="px-6 pt-4">
                    <Meta tone="feed" strong>Wachtwoord ingesteld.</Meta>
                  </View>
                ) : null}
                {pwdResult && pwdResult.ok === false ? (
                  <View className="px-6 pt-4">
                    <FormError>{pwdResult.message}</FormError>
                  </View>
                ) : null}
              </View>
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Sheet>
    </SafeAreaView>
  );
}

/** Eén invoerveld: geen vulling, geen kader — de lijn eronder komt van `Field`. */
const INPUT = {
  color: feed.ink,
  paddingVertical: 11,
  ...(Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : {}),
} as const;

/** Een veld: kicker, invoer, lijn — dezelfde als op het deelscherm. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="px-6 pt-7">
      <Text style={[feedType.kicker, { color: flameDeep, letterSpacing: 0.55 }]}>
        {label.toUpperCase()}
      </Text>
      {children}
      <Rule tone="feed" />
    </View>
  );
}

/** De regel onder een veld: uitleg, of de fout die de uitleg vervangt. */
function Hint({ children, error }: { children?: string; error?: string | null }) {
  if (error) {
    return (
      <View className="px-6">
        <FieldError>{error}</FieldError>
      </View>
    );
  }
  if (!children) return null;
  return (
    <View className="px-6 pt-2">
      <Meta tone="feed" dim>{children}</Meta>
    </View>
  );
}
