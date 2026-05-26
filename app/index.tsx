import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth/provider";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-shell">
        <ActivityIndicator color="#F5E8D3" />
      </View>
    );
  }

  return session ? <Redirect href="/(app)/feed" /> : <Redirect href="/(auth)/login" />;
}
