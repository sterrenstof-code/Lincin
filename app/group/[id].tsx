import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Avatar } from "@/components/Avatar";
import { Button, Field, IconBtn, ListRow, Note, Section, SubPage } from "@/components/lincin/SubPage";
import { useAuth } from "@/lib/auth/provider";
import { confirm } from "@/lib/confirm";
import {
  getChatRow,
  leaveChat,
  listChatMembers,
  removeChatMember,
  renameChat,
  uploadGroupAvatar,
  type ChatMemberRow,
} from "@/lib/api/chats";
import { sendMessage } from "@/lib/api/messages";
import { getProfile } from "@/lib/api/profiles";
import { uriToBytes } from "@/lib/crypto/file";
import { color, hueFor, RASTER, useThemeSpec } from "@/lib/design/theme";
import { usePageTitle } from "@/lib/page-title";

/**
 * Groep info, in de vorm van het thema (components/lincin/SubPage).
 *
 * De kop is de groep zelf: naam, aantal leden, en de groepsfoto ernaast.
 * Daaronder de leden als rijen, en onderaan Verlaat groep. De eigenaar
 * kan de naam en de foto wijzigen, leden toevoegen en verwijderen.
 */

export default function GroupInfoScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { session } = useAuth();
  const myUserId = session!.user.id;
  const { id } = useLocalSearchParams<{ id: string }>();
  const chatId = id!;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [localAvatarUrl, setLocalAvatarUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chat = useQuery({
    queryKey: ["chat-row", chatId],
    queryFn: () => getChatRow(chatId),
    enabled: !!chatId,
  });

  // De naam van de groep zodra die er is; tot dan de schermnaam, zodat er
  // nooit "undefined" in de tab staat.
  usePageTitle(chat.data?.name?.trim() || "Groep info");

  const members = useQuery({
    queryKey: ["chat-members", chatId],
    queryFn: () => listChatMembers(chatId),
    enabled: !!chatId,
  });

  useEffect(() => {
    if (chat.data?.name) setNameDraft(chat.data.name);
  }, [chat.data?.name]);

  const myRole = (members.data ?? []).find((m) => m.user_id === myUserId)?.role;
  const isOwner = myRole === "owner";
  const isGroup = chat.data?.type === "group";

  const groupAvatarUrl = localAvatarUrl ?? chat.data?.avatar_url ?? null;

  async function onPickGroupAvatar() {
    if (!isOwner) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setAvatarUploading(true);
    try {
      const bytes = await uriToBytes(asset.uri);
      const url = await uploadGroupAvatar(chatId, myUserId, bytes, asset.mimeType ?? "image/jpeg");
      setLocalAvatarUrl(url);
      await qc.invalidateQueries({ queryKey: ["chat-row", chatId] });
      await qc.invalidateQueries({ queryKey: ["chats"] });
      // Stuur systeemmelding in de chat
      const myProf = await getProfile(myUserId);
      const actorName = myProf?.display_name ?? myProf?.username ?? "Iemand";
      sendMessage({ chatId, senderId: myUserId, system: { event: "group_avatar_updated", actorName } }).catch(() => {});
    } catch (e: any) {
      setError(e?.message ?? "Kon groepsfoto niet uploaden.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function onSaveName() {
    if (!isOwner) return;
    setSavingName(true);
    setError(null);
    try {
      await renameChat(chatId, nameDraft);
      await qc.invalidateQueries({ queryKey: ["chat-row", chatId] });
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      setEditingName(false);
    } catch (e: any) {
      setError(e?.message ?? "Kon naam niet wijzigen.");
    } finally {
      setSavingName(false);
    }
  }

  async function onRemove(member: ChatMemberRow) {
    if (!isOwner || member.user_id === myUserId) return;
    const name = member.profile?.display_name ?? member.profile?.username ?? "Lid";
    const confirmed = await confirm(
      "Lid verwijderen",
      `Wil je ${name} uit de groep verwijderen?`,
      { affirmativeLabel: "Verwijderen", destructive: true }
    );
    if (!confirmed) return;
    try {
      await removeChatMember(chatId, member.user_id);
      await qc.invalidateQueries({ queryKey: ["chat-members", chatId] });
    } catch (e: any) {
      setError(e?.message ?? "Kon lid niet verwijderen.");
    }
  }

  async function onLeave() {
    const confirmed = await confirm(
      "Verlaat groep",
      `Je verlaat "${chat.data?.name ?? "deze groep"}". Je kan oude berichten niet meer ophalen.`,
      { affirmativeLabel: "Verlaten", destructive: true }
    );
    if (!confirmed) return;
    try {
      await leaveChat(chatId, myUserId);
      await qc.invalidateQueries({ queryKey: ["chats", myUserId] });
      router.replace("/(app)/chats");
    } catch (e: any) {
      setError(e?.message ?? "Kon groep niet verlaten.");
    }
  }

  const th = useThemeSpec().id;
  const memberList = members.data ?? [];
  const name = chat.data?.name?.trim() || "Groep";

  // De groepsfoto: vierkant in kleur en magazine, afgerond in modern. De
  // eigenaar tikt erop om hem te wijzigen.
  const photo = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Groepsfoto wijzigen"
      onPress={onPickGroupAvatar}
      disabled={!isOwner}
      style={{
        width: 88,
        height: 88,
        borderRadius: th === "modern" ? RASTER.tileRadius : 0,
        overflow: "hidden",
        backgroundColor: color("ink", "postRule"),
        alignItems: "center",
        justifyContent: "center",
        borderWidth: th === "kleur" ? 1.5 : 0,
        borderColor: color("ink"),
      }}
    >
      {groupAvatarUrl ? (
        <Image source={{ uri: groupAvatarUrl, cacheKey: groupAvatarUrl.split("?")[0] }} cachePolicy="disk" style={{ width: 88, height: 88 }} contentFit="cover" />
      ) : (
        <Ionicons name="people" color={color("ink")} size={30} />
      )}
      {isOwner ? (
        <View style={{ position: "absolute", right: 0, bottom: 0, width: 28, height: 28, borderRadius: th === "kleur" ? 0 : 14, backgroundColor: color("ink"), alignItems: "center", justifyContent: "center" }}>
          {avatarUploading ? <ActivityIndicator size="small" color={color("paper")} /> : <Ionicons name="camera" color={color("paper")} size={13} />}
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <SubPage
      title={editingName ? "Groepsnaam" : chat.isLoading ? "…" : name}
      kicker="Groep"
      sub={`${memberList.length} ${memberList.length === 1 ? "lid" : "leden"}`}
      back={`/chat/${chatId}`}
      tab="chats"
      hue={hueFor(chatId)}
      keyboard
      right={photo}
    >
      {editingName ? (
        <Section pad>
          <Field label="Groepsnaam" value={nameDraft} onChangeText={setNameDraft} maxLength={64} autoFocus onSubmitEditing={onSaveName} returnKeyType="done" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              label="Annuleer"
              grow
              onPress={() => {
                setEditingName(false);
                setNameDraft(chat.data?.name ?? "");
                setError(null);
              }}
            />
            <Button label={savingName ? "Bezig…" : "Bewaren"} tone="primary" grow busy={savingName} onPress={onSaveName} />
          </View>
        </Section>
      ) : isOwner && isGroup ? (
        <View style={{ flexDirection: "row" }}>
          <Button label="Naam wijzigen" icon="pencil" small onPress={() => setEditingName(true)} />
        </View>
      ) : null}

      {!editingName && error ? <Note tone="red">{error}</Note> : null}

      <Section
        label={`Leden · ${memberList.length}`}
        action={isOwner && isGroup ? { label: "Voeg toe", icon: "person-add-outline", onPress: () => router.push(`/group-add/${chatId}`) } : undefined}
      >
        {members.isLoading ? (
          <ListRow title="Laden…" first />
        ) : (
          memberList.map((m, i) => (
            <MemberRow
              key={m.user_id}
              member={m}
              first={i === 0}
              isMe={m.user_id === myUserId}
              canRemove={isOwner && isGroup && m.user_id !== myUserId}
              onPress={() => m.profile?.username && router.push(`/user/${m.profile.username}`)}
              onRemove={() => onRemove(m)}
            />
          ))
        )}
      </Section>

      <Button label="Verlaat groep" icon="exit-outline" tone="danger" onPress={onLeave} />
      <Note center>Je oude berichten worden ontoegankelijk omdat je toestel ze niet meer kan ontsleutelen voor nieuwe sleutels.</Note>
    </SubPage>
  );
}

function MemberRow({
  member,
  first,
  isMe,
  canRemove,
  onPress,
  onRemove,
}: {
  member: ChatMemberRow;
  first: boolean;
  isMe: boolean;
  canRemove: boolean;
  onPress: () => void;
  onRemove: () => void;
}) {
  const name = member.profile?.display_name ?? member.profile?.username ?? "Onbekend";
  return (
    <ListRow
      first={first}
      title={name}
      badge={isMe ? "Jij" : member.role === "owner" ? "Eigenaar" : undefined}
      sub={`@${member.profile?.username ?? "?"}${isMe && member.role === "owner" ? " · eigenaar" : ""}`}
      left={<Avatar name={name} avatarUrl={member.profile?.avatar_url} size="md" />}
      onPress={onPress}
      right={canRemove ? <IconBtn icon="remove" label={`${name} uit de groep verwijderen`} tone="danger" onPress={onRemove} /> : null}
    />
  );
}
