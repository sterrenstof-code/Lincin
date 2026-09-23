import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";

import { bodyStyle, Button, Field, Panel, Section, SubPage, titleStyle } from "@/components/lincin/SubPage";
import { sendEmailInvite } from "@/lib/api/invites";
import { color, friendColor, RASTER, useScheme, useThemeSpec } from "@/lib/design/theme";
import { serif } from "@/lib/design/type";
import { safeBack } from "@/lib/nav";
import { usePageTitle } from "@/lib/page-title";

/**
 * Iemand uitnodigen via e-mail, in de vorm van het thema
 * (components/lincin/SubPage). Eén veld en één knop; is de mail weg, dan
 * staat er een bevestiging met "Nog iemand" en "Klaar" — in magazine als
 * groen kleurvlak, zoals een spread op de voorpagina.
 */
export default function InviteEmailScreen() {
  usePageTitle("Iemand uitnodigen");
  const router = useRouter();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "sending" | "sent" | { kind: "error"; message: string }
  >("idle");

  const submitting = status === "sending";

  async function onSubmit() {
    const clean = email.trim().toLowerCase();
    if (!clean.includes("@")) {
      setStatus({ kind: "error", message: "Geef een geldig e-mailadres." });
      return;
    }
    setStatus("sending");
    try {
      await sendEmailInvite(clean);
      await qc.invalidateQueries({ queryKey: ["pending-invites"] });
      setStatus("sent");
    } catch (e: any) {
      setStatus({ kind: "error", message: e?.message ?? "Onbekende fout" });
    }
  }

  return (
    <SubPage
      title="Nodig ze uit via e-mail"
      kicker="Vriend nog niet op Lincin?"
      sub="We sturen hen een uitnodiging om hun eigen Lincin-account te maken. Zodra ze aanmelden, zijn jullie automatisch vrienden."
      back="/(app)/friends"
      tab="you"
      hue="blue"
      keyboard
    >
      <Section label="Uitnodiging" pad>
        <Field
          label="E-mailadres"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="vriend@voorbeeld.be"
          editable={!submitting}
          onSubmitEditing={onSubmit}
          error={typeof status === "object" && status.kind === "error" ? status.message : null}
        />
        {status === "sent" ? null : (
          <Button
            label={submitting ? "Bezig…" : "Stuur uitnodiging"}
            tone="primary"
            icon="paper-plane-outline"
            busy={submitting}
            onPress={onSubmit}
          />
        )}
      </Section>

      {status === "sent" ? (
        <Sent
          email={email}
          onAgain={() => {
            setEmail("");
            setStatus("idle");
          }}
          onDone={() => safeBack(router, "/(app)/friends")}
        />
      ) : null}
    </SubPage>
  );
}

/**
 * De bevestiging. Kleur: een kader; modern: een tegel; magazine: een
 * groen kleurvlak met de kop in serif, de knoppen eronder op papier.
 */
function Sent({ email, onAgain, onDone }: { email: string; onAgain: () => void; onDone: () => void }) {
  const th = useThemeSpec().id;
  const fc = friendColor("green", useScheme());
  const dim = color("ink", "inkDim");
  const text = `${email} kreeg een mail om een account aan te maken. Zodra ze inloggen, verschijnen ze in je vrienden-lijst.`;
  const buttons = (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <Button label="Nog iemand uitnodigen" grow onPress={onAgain} />
      <Button label="Klaar" tone="primary" grow onPress={onDone} />
    </View>
  );
  if (th === "magazine") {
    return (
      <View style={{ gap: RASTER.seam }}>
        <View style={{ backgroundColor: fc.fill, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 20, gap: 8 }}>
          <Text style={{ ...serif(), fontSize: 34, lineHeight: 34, letterSpacing: -0.8, color: fc.ink }}>Uitnodiging verstuurd</Text>
          <Text style={{ ...serif(true), fontSize: 17, lineHeight: 22, color: fc.ink, opacity: 0.86 }}>{text}</Text>
        </View>
        <Panel style={{ padding: 16 }}>{buttons}</Panel>
      </View>
    );
  }
  return (
    <Panel style={{ padding: th === "modern" ? RASTER.tilePad : 16, gap: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        {th === "modern" ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: fc.fill }} /> : null}
        <Text style={titleStyle(th, th === "modern" ? 20 : 22)}>Uitnodiging verstuurd</Text>
      </View>
      <Text style={bodyStyle(th, 13.5, dim)}>{text}</Text>
      <View style={{ marginTop: 4 }}>{buttons}</View>
    </Panel>
  );
}
