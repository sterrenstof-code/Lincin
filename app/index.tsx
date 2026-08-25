import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useAuth } from "@/lib/auth/provider";
import { desk, feed } from "@/lib/design/type";

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-desk">
        <ActivityIndicator color={desk.ink} />
      </View>
    );
  }

  return session ? <Redirect href="/(app)/feed" /> : <Redirect href="/(auth)/login" />;
}
