import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { PostWithAuthor } from "@/lib/api/posts";

export function MemoryCard({ post }: { post: PostWithAuthor }) {
  const router = useRouter();
  const yearsAgo = new Date().getFullYear() - new Date(post.created_at).getFullYear();

  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}` as any)}
      className="bg-flame rounded-3xl overflow-hidden mb-3"
    >
      {post.image_url && (
        <Image
          source={{ uri: post.image_url }}
          style={{ width: "100%", height: 200 }}
          contentFit="cover"
        />
      )}
      <View className="p-4">
        <View className="flex-row items-center gap-2 mb-1">
          <Text className="text-cream/80 text-xs uppercase tracking-wider font-semibold">
            Op deze dag
          </Text>
          <View className="bg-cream/20 rounded-full px-2 py-0.5">
            <Text className="text-cream text-xs font-bold">{yearsAgo} jaar geleden</Text>
          </View>
        </View>
        {post.caption ? (
          <Text className="text-cream text-sm" numberOfLines={2}>{post.caption}</Text>
        ) : (
          <Text className="text-cream/70 text-sm italic">Geen bijschrift</Text>
        )}
        <Text className="text-cream/60 text-xs mt-1">
          {new Date(post.created_at).toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>
      </View>
    </Pressable>
  );
}
