import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import {
  AuthNotice,
  AuthPage,
  AuthSub,
  AuthTitle,
  AuthTop,
  LinedField,
  OutlineButton,
  PrimaryButton,
} from "@/components/lincin/auth/AuthKit";
import { useAuth } from "@/lib/auth/provider";
import { restoreWithRecoveryCode, saveRecoveryBackup, startFresh, type KeyStatus } from "@/lib/auth/bootstrap";
import { loadIdentity } from "@/lib/crypto/keys";
import { generateRecoveryCode, normalizeRecoveryCode } from "@/lib/crypto/recovery";
import { color } from "@/lib/design/theme";
import { mono, sans } from "@/lib/design/type";
import { copyToClipboard } from "@/lib/share";

/**
 * Vóór de app: je sleutel moet op dit toestel staan, en er moet een kopie
 * met herstelcode op de server zijn (lib/auth/bootstrap.ts, 0094). Zonder
 * het eerste lees je niets; zonder het tweede ben je alles kwijt met je
 * toestel.
 */
export function KeyGate({ userId, status, onDone }: { userId: string; status: KeyStatus; onDone: () => void }) {
  if (status.state === "backup") return <BackupView userId={userId} onDone={onDone} />;
  if (status.state === "restore") return <RestoreView userId={userId} hasBackup={status.hasBackup} onDone={onDone} />;
  return null;
}

/**
 * De herstelcode tonen en de versleutelde kopie bewaren. Ook vanuit de
 * instellingen (`renew`): een nieuwe code maakt de oude ongeldig.
 */
export function BackupView({ userId, onDone, renew = false, onBack }: { userId: string; onDone: () => void; renew?: boolean; onBack?: () => void }) {
  const code = useMemo(() => generateRecoveryCode(), []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveRecoveryBackup(userId, code);
      onDone();
    } catch (e) {
      setError((e as Error)?.message ?? "Bewaren is niet gelukt. Probeer het opnieuw.");
      setBusy(false);
    }
  }

  return (
    <AuthPage>
      <AuthTop label={renew ? "Nieuwe herstelcode" : "Herstelcode"} onBack={onBack} />
      <View style={{ paddingTop: 28, paddingHorizontal: 24, gap: 10 }}>
        <AuthTitle>Bewaar je herstelcode.</AuthTitle>
        <AuthSub>
          Je gesprekken zijn versleuteld met een sleutel die alleen op je toestel staat. Met deze code haal je hem terug op een
          nieuw toestel. Wij kunnen hem niet lezen en niet voor je opvragen: zonder code en zonder ander toestel blijven oude
          berichten dicht.
        </AuthSub>
        {renew ? <AuthSub>Je vorige code werkt hierna niet meer.</AuthSub> : null}
      </View>

      <View style={{ marginTop: 22, marginHorizontal: 6, backgroundColor: color("ink"), paddingVertical: 22, paddingHorizontal: 20, gap: 12 }}>
        <Text style={[sans(500), { fontSize: 8.5, lineHeight: 11, letterSpacing: 8.5 * 0.2, textTransform: "uppercase", color: color("paper"), opacity: 0.7 }]}>
          Jouw herstelcode
        </Text>
        <Text selectable style={[mono(500), { fontSize: 22, lineHeight: 32, letterSpacing: 1, color: color("paper") }]}>
          {code}
        </Text>
      </View>

      <View style={{ marginTop: 6, marginHorizontal: 6, gap: 6 }}>
        <OutlineButton
          label="Kopieer"
          onPress={async () => setNote((await copyToClipboard(code)) ? "Gekopieerd. Zet hem in je wachtwoordbeheerder." : "Kopiëren lukte niet: schrijf hem over.")}
        />
      </View>
      <View style={{ marginTop: 14, marginHorizontal: 24, gap: 10 }}>
        {note ? <AuthNotice>{note}</AuthNotice> : null}
        {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
        <AuthSub>Bewaar hem in een wachtwoordbeheerder of op papier, niet in een chat.</AuthSub>
      </View>

      <View style={{ flex: 1, minHeight: 28 }} />
      <View style={{ marginHorizontal: 6, marginBottom: 24 }}>
        <PrimaryButton label="Ik heb hem bewaard" onPress={save} busy={busy} />
      </View>
    </AuthPage>
  );
}

function RestoreView({ userId, hasBackup, onDone }: { userId: string; hasBackup: boolean; onDone: () => void }) {
  const { signOut } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmFresh, setConfirmFresh] = useState(false);

  // Komt de sleutel via de QR van een ander toestel (/device-receive), dan
  // staat hij er gewoon: verder zonder iets te tikken.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    let fired = false;
    const t = setInterval(async () => {
      if (!fired && (await loadIdentity())) {
        fired = true;
        done.current();
      }
    }, 1500);
    return () => clearInterval(t);
  }, []);

  async function restore() {
    if (!normalizeRecoveryCode(code)) {
      setError("Een herstelcode heeft 24 tekens, in zes groepjes van vier.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (await restoreWithRecoveryCode(userId, code)) onDone();
      else setError("Deze code past niet. Kijk hem nog eens na.");
    } catch {
      setError("Herstellen is niet gelukt. Probeer het opnieuw.");
    } finally {
      setBusy(false);
    }
  }

  async function fresh() {
    setBusy(true);
    try {
      await startFresh(userId);
      onDone();
    } catch {
      setError("Dat lukte niet. Probeer het opnieuw.");
      setBusy(false);
    }
  }

  if (confirmFresh) {
    return (
      <AuthPage>
        <AuthTop label="Opnieuw beginnen" onBack={() => setConfirmFresh(false)} />
        <View style={{ paddingTop: 28, paddingHorizontal: 24, gap: 10 }}>
          <AuthTitle>Zonder je oude sleutel?</AuthTitle>
          <AuthSub>
            Je krijgt een nieuwe sleutel. Berichten van vroeger blijven dan voorgoed onleesbaar, op al je toestellen. Nieuwe
            berichten werken meteen weer.
          </AuthSub>
          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
        </View>
        <View style={{ flex: 1, minHeight: 28 }} />
        <View style={{ marginHorizontal: 6, marginBottom: 24, gap: 6 }}>
          <OutlineButton label="Terug" onPress={() => setConfirmFresh(false)} />
          <PrimaryButton label="Opnieuw beginnen" onPress={fresh} busy={busy} />
        </View>
      </AuthPage>
    );
  }

  return (
    <AuthPage>
      <AuthTop label="Nieuw toestel" />
      <View style={{ paddingTop: 28, paddingHorizontal: 24, gap: 10 }}>
        <AuthTitle>Haal je sleutel naar dit toestel.</AuthTitle>
        <AuthSub>
          Je gesprekken zijn versleuteld met een sleutel die niet op dit toestel staat.{" "}
          {hasBackup ? "Typ je herstelcode, of scan de QR-code van een toestel waarop je al bent ingelogd." : "Scan de QR-code van een toestel waarop je al bent ingelogd."}
        </AuthSub>
      </View>

      {hasBackup ? (
        <View style={{ marginTop: 26, marginHorizontal: 24, gap: 14 }}>
          <LinedField
            label="Herstelcode"
            value={code}
            onChangeText={(v) => {
              setCode(v);
              setError(null);
            }}
            placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            onSubmitEditing={restore}
          />
          {error ? <AuthNotice tone="error">{error}</AuthNotice> : null}
        </View>
      ) : null}

      <View style={{ flex: 1, minHeight: 28 }} />
      <View style={{ marginHorizontal: 6, gap: 6 }}>
        {hasBackup ? <PrimaryButton label="Herstel" onPress={restore} busy={busy} /> : null}
        <OutlineButton
          label={Platform.OS === "web" ? "QR of link van een ander toestel" : "Scan QR van een ander toestel"}
          onPress={() => router.push("/device-receive")}
        />
      </View>
      <View style={{ marginTop: 18, marginBottom: 28, paddingHorizontal: 24, flexDirection: "row", justifyContent: "space-between" }}>
        <Pressable accessibilityRole="button" onPress={() => setConfirmFresh(true)} hitSlop={10}>
          <AuthSub>Opnieuw beginnen</AuthSub>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => signOut()} hitSlop={10}>
          <AuthSub>Uitloggen</AuthSub>
        </Pressable>
      </View>
    </AuthPage>
  );
}
