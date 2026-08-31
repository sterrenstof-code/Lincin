import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import type { PostWithAuthor } from "@/lib/api/posts";
import { NL } from "@/lib/locale";

export function MemoryCard({ post }: { post: PostWithAuthor }) {
  const router = useRouter();
  const yearsAgo = new Date().getFullYear() - new Date(post.created_at).getFullYear();

  return (
    <Pressable
      onPress={() => router.push(`/post/${post.id}`)}
      className="bg-carbon overflow-hidden mb-3"
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
          <Text className="text-page text-xs uppercase tracking-wider font-semibold">
            Op deze dag
          </Text>
          <View className="bg-page-alt px-2 py-0.5">
            <Text className="text-page text-xs font-bold">{yearsAgo} jaar geleden</Text>
          </View>
        </View>
        {post.caption ? (
          <Text className="text-page text-sm" numberOfLines={2}>{post.caption}</Text>
        ) : (
          <Text className="text-page text-sm italic">Geen bijschrift</Text>
        )}
        <Text className="text-page text-xs mt-1">
          {new Date(post.created_at).toLocaleDateString(NL, {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </Text>
      </View>
    </Pressable>
  );
}
