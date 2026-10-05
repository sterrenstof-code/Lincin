import { useQueryClient } from "@tanstack/react-query";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { AuthNotice, AuthPage, AuthSub, AuthTitle, AuthTop, AuthWordmark, OutlineButton, PrimaryButton } from "@/components/lincin/auth/AuthKit";
import { looksLikeFriendToken, normalizeFriendCode, redeemFriendCode, type RedeemResult } from "@/lib/api/friend-codes";
import { useAuth } from "@/lib/auth/provider";
import { usePageTitle } from "@/lib/page-title";
import { rememberPendingFriendCode } from "@/lib/pending-invite";

/**
 * `/c/{code}` — de link bij een vriendcode (0082, 0093).
 *
 * Met een sessie: meteen inwisselen. Met het token uit een gedeelde link
 * zijn jullie dan lincs; met de korte code gaat er een verzoek. Zonder sessie:
 * de code onthouden (`rememberPendingFriendCode`) en naar het welkom; na
 * het aanmelden pakt `app/index.tsx` hem weer op en komt hij hier terug.
 */
export default function FriendCodeScreen() {
  usePageTitle("Linc");
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code = normalizeFriendCode(typeof raw === "string" ? raw : "");
  const { session, loading } = useAuth();
  const qc = useQueryClient();
  const [result, setResult] = useState<RedeemResult | { status: "error"; message: string } | null>(null);

  useEffect(() => {
    if (loading || !session || !code) return;
    let alive = true;
    redeemFriendCode(code)
      .then((r) => {
        if (!alive) return;
        setResult(r);
        if (r.status === "ok" || r.status === "requested") qc.invalidateQueries({ queryKey: ["friendships"] });
      })
      .catch((e) => alive && setResult({ status: "error", message: e?.message ?? "Er ging iets mis." }));
    return () => {
      alive = false;
    };
  }, [loading, session, code, qc]);

  if (loading) return null;
  if (!session) {
    if (code) rememberPendingFriendCode(code);
    return <Redirect href="/(auth)/welcome" />;
  }

  const home = () => router.replace("/(app)/feed");
  const friend = result?.status === "ok" || result?.status === "requested" ? result.friend : null;
  const requested = result?.status === "requested";
  const friendName = friend ? friend.display_name || friend.username : "";

  return (
    <AuthPage>
      <AuthTop label={looksLikeFriendToken(code) ? "Linc" : `Code · ${code}`} onBack={home} />
      <View style={{ paddingTop: 28, paddingHorizontal: 24, gap: 10 }}>
        <AuthWordmark size={40} />
        {result === null ? <AuthTitle>Even kijken…</AuthTitle> : null}
        {friend && requested ? (
          <>
            <AuthTitle>Verzoek gestuurd naar {friendName}.</AuthTitle>
            <AuthSub>Zodra {friendName} het aanvaardt, zijn jullie lincs.</AuthSub>
          </>
        ) : null}
        {friend && !requested ? (
          <>
            <AuthTitle>Jij en {friendName} zijn nu lincs.</AuthTitle>
            <AuthSub>Wat {friendName} deelt, staat vanaf nu in je editie — en andersom.</AuthSub>
          </>
        ) : null}
        {result?.status === "own" ? <AuthTitle>Dit is je eigen code.</AuthTitle> : null}
        {result?.status === "not_found" ? (
          <>
            <AuthTitle>Deze code kennen we niet.</AuthTitle>
            <AuthSub>Kijk hem nog eens na: twee letters, een streepje en vier cijfers.</AuthSub>
          </>
        ) : null}
        {result?.status === "not_allowed" ? <AuthTitle>Dit lukt niet.</AuthTitle> : null}
        {result?.status === "rate_limited" ? (
          <>
            <AuthTitle>Even geduld.</AuthTitle>
            <AuthSub>Te veel codes geprobeerd. Probeer het over een uurtje opnieuw.</AuthSub>
          </>
        ) : null}
        {result?.status === "error" ? <AuthNotice tone="error">{result.message}</AuthNotice> : null}
      </View>

      <View style={{ flex: 1, minHeight: 28 }} />
      <View style={{ marginHorizontal: 6, marginBottom: 24, gap: 6 }}>
        {friend ? <OutlineButton label={`Naar ${friendName}`} onPress={() => router.replace(`/user/${encodeURIComponent(friend.username)}`)} /> : null}
        <PrimaryButton label="Naar je editie" onPress={home} disabled={result === null} />
      </View>
    </AuthPage>
  );
}
