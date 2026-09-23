import Ionicons from "@expo/vector-icons/Ionicons";
import { useRef, useState, type ReactNode, type RefObject } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { bodyStyle, Button, Field, labelStyle, Note, PageTitle, Panel, Section, titleStyle } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import {
  color,
  friendColor,
  pageTint,
  RASTER,
  useScheme,
  useThemeSpec,
  type Hue,
  type LincinTheme,
} from "@/lib/design/theme";
import { CONTROL_H, sans, serif } from "@/lib/design/type";
import { usePageTitle } from "@/lib/page-title";

/**
 * Eén weg naar binnen.
 *
 * Er stonden drie: inloggen met wachtwoord, een account aanmaken (een
 * tabje ernaast), en een magic link eronder. Drie deuren op de eerste
 * pagina is drie keer kiezen voordat je iets gedaan hebt.
 *
 * Nu is het: e-mail, wachtwoord, Doorgaan. Kent de server het adres
 * niet, dan zegt de pagina dat en biedt hij aan om met precies deze
 * gegevens een account te maken — dat is het moment waarop die vraag
 * hoort, niet ervoor. "Wachtwoord vergeten" stuurt een link; daarna kies
 * je een nieuw wachtwoord bij Instellingen.
 *
 * Wachtwoordmanagers: `autoComplete` en `textContentType` staan op het
 * bestaande wachtwoord, zodat ze invullen. Bij het aanmaken via de
 * aanbieding wordt hetzelfde veld gebruikt; iOS en Chrome bewaren het
 * daarna gewoon.
 *
 * DE VORM. Er is hier nog geen sessie, dus geen `SubPage`: die hangt in
 * `LincinScreen`, met meldingen en een nieuwe bijdrage in de kop en op
 * desktop de rail met je profiel. Dit scherm bouwt dezelfde onderdelen
 * (kop, rubriek, veld, knop) op een los blad in de vorm van het thema —
 * dat is vóór het inloggen al bekend (`useThemeSpec`).
 */
type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  /** Adres onbekend of wachtwoord fout — bied aan om een account te maken. */
  | { kind: "no-account" }
  | { kind: "confirm-sent" }
  | { kind: "reset-sent" }
  | { kind: "error"; message: string };

export default function LoginScreen() {
  usePageTitle("Inloggen");
  const { signInWithPassword, signUp, sendPasswordReset, resendConfirmation } = useAuth();
  const th = useThemeSpec().id;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const passwordRef = useRef<TextInput>(null);

  const submitting = status.kind === "submitting";
  const clean = () => email.trim().toLowerCase();

  function emailError(): string | null {
    return email.includes("@") ? null : "Geef een geldig e-mailadres.";
  }

  /**
   * Inloggen. Klopt het niet, dan weet de server niet (en zegt hij niet)
   * of het adres onbekend is of het wachtwoord fout — dus bieden we
   * allebei aan: opnieuw proberen, of een account maken.
   */
  async function onContinue() {
    const err = emailError() ?? (password.length === 0 ? "Vul je wachtwoord in." : null);
    if (err) {
      setStatus({ kind: "error", message: err });
      return;
    }
    setStatus({ kind: "submitting" });
    const { error } = await signInWithPassword(clean(), password);
    if (!error) {
      setStatus({ kind: "idle" });
      return;
    }
    if (error.message === "Invalid login credentials") {
      setStatus({ kind: "no-account" });
      return;
    }
    setStatus({ kind: "error", message: error.message });
  }

  /** De acht-tekens-eis geldt alleen hier: bij het kiezen, niet bij het controleren. */
  async function onCreate() {
    if (password.length < 8) {
      setStatus({ kind: "error", message: "Kies een wachtwoord van minstens 8 tekens." });
      return;
    }
    setStatus({ kind: "submitting" });
    const { error, needsConfirmation, alreadyExists } = await signUp(clean(), password);
    if (error) {
      setStatus({
        kind: "error",
        message: error.message.includes("registered")
          ? "Er is al een account voor dit adres. Klopt je wachtwoord niet meer? Gebruik dan 'Wachtwoord vergeten'."
          : error.message,
      });
    } else if (alreadyExists) {
      setStatus({
        kind: "error",
        message:
          "Er is al een account voor dit adres. Klopt je wachtwoord niet meer? Gebruik dan 'Wachtwoord vergeten'.",
      });
    } else if (needsConfirmation) {
      setStatus({ kind: "confirm-sent" });
    } else {
      setStatus({ kind: "idle" });
    }
  }

  async function onResendConfirmation() {
    setStatus({ kind: "submitting" });
    const { error } = await resendConfirmation(clean());
    if (error) {
      setStatus({
        kind: "error",
        message: /rate limit|too many/i.test(error.message)
          ? "Te veel pogingen op dit adres. Probeer het over een uurtje opnieuw."
          : error.message,
      });
    } else {
      setStatus({ kind: "confirm-sent" });
    }
  }

  async function onForgotPassword() {
    const err = emailError();
    if (err) {
      setStatus({ kind: "error", message: err });
      return;
    }
    setStatus({ kind: "submitting" });
    const { error } = await sendPasswordReset(clean());
    if (error) setStatus({ kind: "error", message: error.message });
    else setStatus({ kind: "reset-sent" });
  }

  return (
    <Gate>
      <PageTitle kicker="Welkom" title="Lincin" sub="Link up. Versleuteld, voor je vrienden." />

      <Section pad>
        <Field
          label="E-mailadres"
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            if (status.kind !== "idle" && status.kind !== "submitting") setStatus({ kind: "idle" });
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          placeholder="jij@voorbeeld.be"
          editable={!submitting}
        />

        <PasswordField
          th={th}
          inputRef={passwordRef}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (status.kind === "error") setStatus({ kind: "idle" });
          }}
          visible={showPassword}
          onToggle={() => setShowPassword((s) => !s)}
          editable={!submitting}
          onSubmitEditing={onContinue}
        />

        {status.kind === "error" && <Note tone="red">{status.message}</Note>}

        {status.kind === "no-account" && (
          <Callout
            hue="ochre"
            title="Dat klopt niet"
            text={`We kennen ${email.trim()} niet, of het wachtwoord is fout. Nieuw hier? Dan maken we met dit adres en dit wachtwoord een account.`}
          >
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <Button label="Account aanmaken" icon="person-add-outline" small onPress={onCreate} disabled={submitting} />
              <Button label="Wachtwoord vergeten" tone="quiet" small onPress={onForgotPassword} disabled={submitting} />
            </View>
          </Callout>
        )}

        {status.kind === "confirm-sent" && (
          <Callout
            hue="blue"
            title="Bevestig je e-mail"
            text={`We stuurden een bevestigingslink naar ${email.trim()}. Klik erop, en kom dan hier terug om in te loggen.`}
          >
            <View style={{ flexDirection: "row" }}>
              <Button label="Niet ontvangen? Stuur opnieuw" small onPress={onResendConfirmation} disabled={submitting} />
            </View>
          </Callout>
        )}

        {status.kind === "reset-sent" && (
          <Callout
            hue="green"
            title="Check je inbox"
            text={`We stuurden een link naar ${email.trim()}. Klik erop om in te loggen; daarna kies je bij Instellingen een nieuw wachtwoord.`}
          />
        )}

        <Button
          label={submitting ? "Bezig…" : "Doorgaan"}
          tone="primary"
          busy={submitting}
          onPress={onContinue}
        />

        {/* Eén tekstlink, een rij van CONTROL_H hoog (§7: op web valt de
            hitSlop weg, dus de rij zelf moet raakbaar zijn). */}
        {status.kind !== "no-account" && (
          <Button label="Wachtwoord vergeten?" tone="quiet" small disabled={submitting} onPress={onForgotPassword} style={{ height: CONTROL_H }} />
        )}
      </Section>

      <Note center>End-to-end versleuteld. Lincin&apos;s servers zien enkel ciphertext.</Note>
    </Gate>
  );
}

// ---------------------------------------------------------------
// Het blad zonder sessie
// ---------------------------------------------------------------

/** De kleur van het blad: dezelfde als de kop (`PageTitle` valt terug op oranje). */
const GATE_HUE: Hue = "orange";

/**
 * Een los blad in de vorm van het thema, voor een scherm zonder sessie:
 * papier, in modern met de zachte kleurhaze eronder, een kolom van
 * hoogstens 520 in het midden, en het toetsenbord dat de pagina opschuift.
 * De marges en de naad zijn die van `SubPage`.
 */
function Gate({ children }: { children: ReactNode }) {
  const th = useThemeSpec().id;
  const insets = useSafeAreaInsets();
  const pad = th === "kleur" ? 18 : RASTER.seam;
  return (
    <View style={{ flex: 1, backgroundColor: color("paper") }}>
      {th === "modern" ? <Haze hue={GATE_HUE} /> : null}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center", paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: 520, alignSelf: "center", padding: pad, gap: th === "kleur" ? 16 : RASTER.seam }}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * De kleurhaze van modern: twee zachte vlekken in de kleur van het blad,
 * linksboven en rechtsonder. Alleen op web, net als in `LincinScreen`; op
 * native dragen de tegels de vorm.
 */
function Haze({ hue }: { hue: Hue }) {
  const scheme = useScheme();
  if (Platform.OS !== "web") return null;
  const fill = friendColor(hue, scheme).fill;
  const a = pageTint(fill, scheme, { light: 0.4, dark: 0.52 });
  const b = pageTint(fill, scheme, { light: 0.26, dark: 0.34 });
  return (
    <View
      style={[
        { pointerEvents: "none", position: "absolute", left: 0, top: 0, right: 0, bottom: 0 },
        {
          backgroundImage: [
            `radial-gradient(118% 60% at 12% -8%, ${a} 0%, transparent 62%)`,
            `radial-gradient(110% 60% at 100% 110%, ${b} 0%, transparent 66%)`,
          ].join(", "),
        } as object,
      ]}
    />
  );
}

/**
 * Een melding ín het formulier: "Dat klopt niet", "Check je inbox". Een
 * titel, een zin, en eventueel knoppen eronder.
 *
 *   kleur     een kader van 1.5 inkt
 *   magazine  een kleurvlak met de titel in serif, de tekst eronder op
 *             het tweede papier — kleur, zoals op de voorpagina
 *   modern    een tegel met een kleurstip voor de titel
 */
function Callout({ hue, title, text, children }: { hue: Hue; title: string; text: string; children?: ReactNode }) {
  const th = useThemeSpec().id;
  const scheme = useScheme();
  const fc = friendColor(hue, scheme);
  const body = (
    <>
      <Text style={bodyStyle(th, 13.5, color("ink", "inkDim"))}>{text}</Text>
      {children}
    </>
  );
  if (th === "magazine") {
    return (
      <View>
        <View style={{ backgroundColor: fc.fill, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14 }}>
          <Text style={{ ...serif(), fontSize: 28, lineHeight: 30, letterSpacing: -0.5, color: fc.ink }}>{title}</Text>
        </View>
        <View style={{ backgroundColor: color("paper"), padding: 16, gap: 12 }}>{body}</View>
      </View>
    );
  }
  return (
    <Panel style={{ padding: th === "modern" ? RASTER.tilePad : 14, gap: 10, backgroundColor: color("paper") }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {th === "modern" ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fc.fill }} /> : null}
        <Text style={th === "modern" ? { ...sans(500), fontSize: 16, lineHeight: 20, color: color("ink") } : titleStyle(th, 20)}>{title}</Text>
      </View>
      {body}
    </Panel>
  );
}

/**
 * Het wachtwoordveld: de vorm van `Field` uit de kit, met het oogje ín het
 * vak. Een eigen doos van CONTROL_H, geen `hitSlop`: die doet niets op web
 * (§7) en dit is een oogje van twintig punten.
 */
function PasswordField({
  th,
  inputRef,
  value,
  onChangeText,
  visible,
  onToggle,
  editable,
  onSubmitEditing,
}: {
  th: LincinTheme;
  inputRef: RefObject<TextInput | null>;
  value: string;
  onChangeText: (v: string) => void;
  visible: boolean;
  onToggle: () => void;
  editable: boolean;
  onSubmitEditing: () => void;
}) {
  const spec = useThemeSpec();
  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const letter = th === "magazine" ? { ...serif(), fontSize: 20 } : { ...sans(400), fontSize: 15 };
  return (
    <View style={{ gap: 6 }}>
      <Text style={labelStyle(th, 9, dim)}>Wachtwoord</Text>
      <View
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: th === "magazine" ? 0 : 14,
          borderRadius: th === "modern" ? 14 : 0,
          borderWidth: th === "kleur" ? spec.border : th === "magazine" ? 0 : 1,
          borderBottomWidth: th === "kleur" ? spec.border : 1,
          borderColor: th === "kleur" ? ink : color("ink", "postRule"),
          backgroundColor: th === "magazine" ? "transparent" : color("paper"),
        }}
      >
        <TextInput
          ref={inputRef}
          accessibilityLabel="Wachtwoord"
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry={!visible}
          autoComplete="current-password"
          textContentType="password"
          returnKeyType="go"
          placeholder="•••••••••"
          placeholderTextColor={dim}
          editable={editable}
          onSubmitEditing={onSubmitEditing}
          style={[
            letter,
            { flex: 1, minHeight: 46, color: ink },
            Platform.OS === "web" ? ({ outlineStyle: "none" } as object) : null,
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
          accessibilityState={{ checked: visible }}
          onPress={onToggle}
          style={{ width: CONTROL_H, height: CONTROL_H, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name={visible ? "eye-off-outline" : "eye-outline"} color={dim} size={20} />
        </Pressable>
      </View>
    </View>
  );
}
