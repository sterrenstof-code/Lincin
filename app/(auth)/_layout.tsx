import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/lib/auth/provider";

export default function AuthLayout() {
  const { session, loading } = useAuth();

  // Eens er een session is, weg met de auth-routes — laat /index.tsx beslissen
  // of de user naar /set-password of /(app)/feed moet.
  if (!loading && session) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#0A0A0B" },
      }}
    />
  );
}
