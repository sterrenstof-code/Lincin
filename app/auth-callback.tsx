import { Redirect, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { Button } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import { color } from "@/lib/design/theme";
import { serif } from "@/lib/design/type";

/**
 * Waar een inloglink op de telefoon landt (`lincin://auth-callback`).
 * De sessie zelf zet `lib/auth/native-links.ts` (via de AuthProvider);
 * dit scherm wacht daarop en gaat dan verder. Komt er na een paar
 * seconden niets, dan was de link verlopen of al gebruikt.
 */
export default function AuthCallback() {
  const { session } = useAuth();
  const router = useRouter();
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setLate(true), 8000);
    return () => clearTimeout(t);
  }, []);
  if (session) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18, padding: 32, backgroundColor: color("paper") }}>
      {late ? (
        <>
          <Text style={[serif(true), { fontSize: 22, lineHeight: 28, textAlign: "center", color: color("ink") }]}>
            Deze link werkt niet meer. Vraag een nieuwe aan of log in met je wachtwoord.
          </Text>
          <Button label="Naar inloggen" tone="primary" onPress={() => router.replace("/login" as never)} />
        </>
      ) : (
        <ActivityIndicator color={color("ink")} />
      )}
    </View>
  );
}
