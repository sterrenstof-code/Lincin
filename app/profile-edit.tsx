import Ionicons from "@expo/vector-icons/Ionicons";
import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, TextInput, View, type TextInputProps } from "react-native";

import { Avatar } from "@/components/Avatar";
import { CharCount } from "@/components/CharCount";
import { FormatBar } from "@/components/FormatBar";
import { bodyStyle, Button, Field, IconBtn, labelStyle, Note, Section, SubPage } from "@/components/lincin/SubPage";
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
import { color, hueFor, useThemeSpec, type LincinTheme } from "@/lib/design/theme";
import { sans, serif } from "@/lib/design/type";
import { humanizeError } from "@/lib/errors";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";

/**
 * Je profiel bewerken, in de vorm van het thema (components/lincin/SubPage).
 *
 * Een zusje van Instellingen: dezelfde kop, dezelfde rubrieken. De kop is
 * jij zelf — "Profiel bewerken", je handle eronder, en je profielfoto
 * ernaast, die je aantikt om hem te wijzigen (zoals de groepsfoto op
 * Groep info). Daaronder wie je bent, je links, Bewaren, en apart de
 * beveiliging: je wachtwoord heeft een eigen knop, want het wordt niet
 * met de rest bewaard.
 */
export default function ProfileEditScreen() {
  usePageTitle("Profiel bewerken");
  const router = useRouter();
  const qc = useQueryClient();
  const { session, setPassword } = useAuth();
  const myUserId = session!.user.id;
  const th = useThemeSpec().id;

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

  const ready = !loading && !loadError;
  const dim = color("ink", "inkDim");

  // De profielfoto naast de kop, zoals de groepsfoto op Groep info: vierkant
  // kader in kleur, los in magazine en modern. Tik om te wijzigen.
  const photo = ready ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Profielfoto wijzigen"
      onPress={onPickAvatar}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Avatar name={displayName || username} avatarUrl={avatarUrl} size="hero" />
      <View
        style={{
          position: "absolute",
          right: -2,
          bottom: -2,
          width: 28,
          height: 28,
          borderRadius: th === "kleur" ? 0 : 14,
          backgroundColor: color("ink"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="camera" color={color("paper")} size={13} />
      </View>
    </Pressable>
  ) : null;

  return (
    <SubPage
      title="Profiel bewerken"
      kicker="Jij"
      sub={ready && username ? `@${username}` : undefined}
      back="/(app)/profile"
      tab="you"
      hue={hueFor(myUserId)}
      keyboard
      right={photo}
    >
      {loading ? (
        <View style={{ paddingVertical: 48, alignItems: "center" }}>
          <ActivityIndicator color={dim} />
        </View>
      ) : loadError ? (
        /* Geen leeg formulier tonen dat je profiel kan wissen zodra je op
           Bewaren drukt — zie de laadhaak. */
        <Note tone="red">{loadError}</Note>
      ) : (
        <>
          <Section label="Wie je bent" pad>
            <HandleField
              th={th}
              error={usernameError}
              value={username}
              onChangeText={(t) => setUsername(t.toLowerCase())}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="kies een handle"
              maxLength={32}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => displayNameRef.current?.focus()}
            />
            <Field
              ref={displayNameRef}
              label="Weergavenaam — optioneel"
              hint="Dit zien je vrienden in chats en op je vondsten."
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="bv. Tom"
              maxLength={48}
              returnKeyType="done"
              onSubmitEditing={() => {
                if (canSave) void onSave();
              }}
            />
          </Section>

          {/* De bio draagt opmaak sinds 0054: dezelfde balk als boven de
              tekst van een vondst. Platte tekst is geldige markdown, dus
              bestaande bio's lezen ongewijzigd door. */}
          <Section label="Bio — optioneel" pad>
            <FormatBar
              value={bio}
              selection={bioSelection}
              onChange={(next) => {
                setBio(next.text);
                setForcedBioSelection(next.selection);
              }}
            />
            <View>
              <Field
                accessibilityLabel="Bio"
                value={bio}
                onChangeText={setBio}
                onSelectionChange={(e) => {
                  setBioSelection(e.nativeEvent.selection);
                  if (forcedBioSelection) setForcedBioSelection(null);
                }}
                selection={forcedBioSelection ?? undefined}
                placeholder="Waar ben je mee bezig?"
                multiline
                maxLength={280}
                hint="Een paar regels over jezelf, bovenaan je profiel. Selecteer tekst en tik B of I, of typ **vet** en *cursief*."
                style={{ minHeight: 88 }}
              />
              <CharCount value={bio} max={280} />
            </View>
          </Section>

          <Section
            label={`Links — optioneel · ${links.length}/${MAX_PROFILE_LINKS}`}
            action={
              links.length < MAX_PROFILE_LINKS
                ? { label: "Voeg toe", icon: "add", onPress: () => setLinks((prev) => [...prev, { label: "", url: "" }]) }
                : undefined
            }
            pad
          >
            <Note>{`Waar je heen wijst — hoogstens ${MAX_PROFILE_LINKS}. Zonder naam gebruiken we het adres.`}</Note>
            {links.map((link, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1, minWidth: 0, gap: 8 }}>
                  <Field
                    label={`Link ${i + 1}`}
                    value={link.label}
                    onChangeText={(t) =>
                      setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, label: t } : l)))
                    }
                    placeholder="Naam"
                    maxLength={48}
                    accessibilityLabel={`Naam van link ${i + 1}`}
                  />
                  <Field
                    value={link.url}
                    onChangeText={(t) =>
                      setLinks((prev) => prev.map((l, j) => (j === i ? { ...l, url: t } : l)))
                    }
                    placeholder="voorbeeld.be"
                    autoCapitalize="none"
                    autoCorrect={false}
                    keyboardType="url"
                    maxLength={200}
                    accessibilityLabel={`Adres van link ${i + 1}`}
                  />
                </View>
                <View style={{ paddingTop: 26 }}>
                  <IconBtn
                    icon="close"
                    label={`Link ${i + 1} verwijderen`}
                    onPress={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                  />
                </View>
              </View>
            ))}
          </Section>

          {error ? <Note tone="red">{error}</Note> : null}

          <Button
            label={saving ? "Bezig…" : "Bewaren"}
            tone="primary"
            icon="checkmark"
            busy={saving}
            disabled={!canSave}
            onPress={onSave}
          />

          {/* ---- Wachtwoord: een eigen knop, los van Bewaren ---- */}
          <Section label="Beveiliging" pad>
            <View style={{ gap: 4 }}>
              <Text style={th === "magazine" ? { ...serif(), fontSize: 24, lineHeight: 27, color: color("ink") } : { ...sans(500), fontSize: 16, lineHeight: 20, color: color("ink") }}>
                Wachtwoord
              </Text>
              <Text style={bodyStyle(th, 13, dim)}>
                Waarmee je inlogt. Na &quot;Wachtwoord vergeten&quot; kies je hier een nieuw; je blijft
                overal ingelogd.
              </Text>
            </View>
            <Field
              label="Nieuw wachtwoord"
              value={password}
              onChangeText={setPwd}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="min. 8 tekens"
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => confirmRef.current?.focus()}
              error={password.length > 0 && password.length < 8 ? "Minstens 8 tekens." : null}
            />
            <Field
              ref={confirmRef}
              label="Bevestig"
              value={passwordConfirm}
              onChangeText={setPwdConfirm}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="new-password"
              textContentType="newPassword"
              placeholder="herhaal je wachtwoord"
              returnKeyType="done"
              onSubmitEditing={() => {
                if (passwordValid) void onSavePassword();
              }}
              error={
                !(password.length > 0 && password.length < 8) &&
                passwordConfirm.length > 0 &&
                password !== passwordConfirm
                  ? "De bevestiging is niet hetzelfde."
                  : null
              }
            />
            <View style={{ flexDirection: "row" }}>
              <Button
                label={pwdSaving ? "Bezig…" : "Wachtwoord opslaan"}
                icon="lock-closed-outline"
                busy={pwdSaving}
                disabled={!passwordValid}
                onPress={onSavePassword}
              />
            </View>
            {pwdResult?.ok === true ? <Note tone="ink">Wachtwoord ingesteld.</Note> : null}
            {pwdResult && pwdResult.ok === false ? <Note tone="red">{pwdResult.message}</Note> : null}
          </Section>
        </>
      )}
    </SubPage>
  );
}

/**
 * De gebruikersnaam: een veld met een vaste "@" ervoor. Dezelfde vorm als
 * `Field` uit de kit — kader van 1.5 (kleur), een lijn eronder
 * (magazine), een afgerond vlak (modern) — maar met het apenstaartje ín
 * het vak, zodat je ziet dat het een handle is.
 */
function HandleField({
  th,
  error,
  ...input
}: TextInputProps & { th: LincinTheme; error?: string | null }) {
  const spec = useThemeSpec();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const letter = th === "magazine" ? { ...serif(), fontSize: 20 } : { ...sans(400), fontSize: 15 };
  return (
    <View style={{ gap: 6 }}>
      <Text style={labelStyle(th, 9, dim)}>Gebruikersnaam</Text>
      <View
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: th === "magazine" ? 0 : 14,
          borderRadius: th === "modern" ? 14 : 0,
          borderWidth: th === "kleur" ? spec.border : th === "magazine" ? 0 : 1,
          borderBottomWidth: th === "kleur" ? spec.border : 1,
          borderColor: error ? color("red") : th === "kleur" ? ink : color("ink", "postRule"),
          backgroundColor: th === "magazine" ? "transparent" : color("paper"),
        }}
      >
        <Text style={[letter, { color: dim }]}>@</Text>
        <TextInput
          accessibilityLabel="Gebruikersnaam"
          placeholderTextColor={dim}
          {...input}
          style={[
            letter,
            { flex: 1, minHeight: 46, paddingLeft: 3, color: ink },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
          ]}
        />
      </View>
      {error ? (
        <Text style={[labelStyle(th, 9, color("red")), { textTransform: "none", letterSpacing: 0.3 }]}>{error}</Text>
      ) : (
        <Text style={bodyStyle(th, 12, dim)}>
          3–32 tekens. Kleine letters, cijfers, punt of underscore.
        </Text>
      )}
    </View>
  );
}
