import { useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View, type TextStyle } from "react-native";

import { SafeImage } from "@/components/SafeImage";
import { updatePost, updatePostPhotos, type EditPhoto, type PostWithAuthor } from "@/lib/api/posts";
import { color, line } from "@/lib/design/theme";
import { lincinType, mono } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { MAX_PHOTOS } from "@/lib/lincin/compose";
import { invalidatePostCaches } from "@/lib/post-cache";

import { BORDER, Btn, Mono } from "./ui";

/**
 * Je eigen bijdrage bewerken: de foto's, de titel en de tekst.
 *
 * Dezelfde velden als bij Nieuwe bijdrage, in dezelfde letters, zodat
 * verbeteren eruitziet als schrijven. Alleen wat de bijdrage ook echt
 * draagt staat erin: een foto-bijdrage houdt haar tekst in het onderschrift
 * en krijgt dus geen tweede, leeg tekstvak; een tekst-bijdrage wel.
 * De tekstvakken groeien mee, zodat je ziet wat je bewerkt.
 * Gedeeld door de bladzijde op de telefoon en op desktop.
 */
export function EditPost({ post, onDone }: { post: PostWithAuthor; onDone: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const [title, setTitle] = useState(post.source_title ?? "");
  const [caption, setCaption] = useState(post.caption ?? "");
  const [body, setBody] = useState(post.body_text ?? "");
  const [photos, setPhotos] = useState<EditPhoto[]>(() => initialPhotos(post));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPhotos = !!post.image_path;
  const showBody = !!post.body_text?.trim() || (!hasPhotos && (post.kind === "note" || post.kind === "fragment"));
  const photosChanged = hasPhotos && !samePhotos(initialPhotos(post), photos);

  async function addPhotos() {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.9,
      allowsMultipleSelection: room > 1,
      selectionLimit: room,
      orderedSelection: true,
    });
    const picked = result.canceled ? [] : (result.assets ?? []).map((a) => a.uri).filter(Boolean);
    if (picked.length) setPhotos((p) => [...p, ...picked.map((uri) => ({ path: null, uri }))].slice(0, MAX_PHOTOS));
  }

  function move(i: number, d: number) {
    setPhotos((p) => {
      const j = i + d;
      if (j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      if (photosChanged) await updatePostPhotos(post, photos);
      await updatePost(post.id, showBody ? { source_title: title, caption, body_text: body } : { source_title: title, caption });
      await Promise.all([qc.invalidateQueries({ queryKey: ["post", post.id] }), invalidatePostCaches(qc)]);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
      setSaving(false);
    }
  }

  const ink = color("ink");
  const dim = color("ink", "inkDim");
  const small = { ...mono(600), fontSize: 11, lineHeight: 14, color: ink } as TextStyle;

  return (
    <View style={{ gap: 14 }}>
      {hasPhotos ? (
        <View style={{ gap: 6 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {photos.map((photo, i) => (
              <View key={photo.path ?? photo.uri} style={{ width: 104, borderWidth: BORDER, borderColor: line() }}>
                <SafeImage uri={photo.uri} cacheKey={photo.path ?? undefined} style={{ width: "100%", height: 104 }} contentFit="cover" />
                {i === 0 ? (
                  <Text style={[small, { position: "absolute", top: 4, left: 4, fontSize: 9, backgroundColor: color("paper"), paddingHorizontal: 4 }]}>OMSLAG</Text>
                ) : null}
                <View style={{ flexDirection: "row", borderTopWidth: BORDER, borderTopColor: line() }}>
                  <PhotoBtn label="‹" hint="Eerder" onPress={() => move(i, -1)} disabled={i === 0} style={small} />
                  <PhotoBtn
                    label="✕"
                    hint="Haal deze foto weg"
                    onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}
                    disabled={photos.length <= 1}
                    style={small}
                  />
                  <PhotoBtn label="›" hint="Later" onPress={() => move(i, 1)} disabled={i === photos.length - 1} style={small} />
                </View>
              </View>
            ))}
            {photos.length < MAX_PHOTOS ? (
              <Pressable
                accessibilityRole="button"
                onPress={addPhotos}
                style={{ width: 104, height: 104 + 28 + BORDER * 2, borderWidth: BORDER, borderStyle: "dashed", borderColor: ink, alignItems: "center", justifyContent: "center" }}
              >
                <Text style={small}>+ {t.addPhoto}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t.titlePh}
        placeholderTextColor={dim}
        autoCapitalize="characters"
        style={[lincinType.cardTitle, { fontSize: 26, lineHeight: 30, minHeight: 48, borderBottomWidth: BORDER, borderBottomColor: line(), color: ink }, noOutline]}
      />
      <GrowingInput
        value={caption}
        onChangeText={setCaption}
        placeholder={hasPhotos ? t.textPh : t.captionPh}
        style={[lincinType.quote, { paddingVertical: 8, borderBottomWidth: BORDER, borderBottomColor: line(), color: ink }]}
        minHeight={44}
      />
      {showBody ? (
        <GrowingInput
          value={body}
          onChangeText={setBody}
          placeholder={t.textPh}
          style={[lincinType.body, { padding: 12, borderWidth: BORDER, borderColor: line(), color: ink }]}
          minHeight={140}
        />
      ) : null}
      {error ? (
        <Mono variant="micro" tone="red" style={{ textTransform: "none" }}>
          {error}
        </Mono>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Btn label={t.cancel} flex={1} onPress={onDone} disabled={saving} />
        <Btn label={saving ? t.saving : t.save} fill flex={1.6} onPress={save} disabled={saving} />
      </View>
    </View>
  );
}

const noOutline = Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null;

/** Een tekstvak dat meegroeit met wat erin staat, in plaats van binnenin te scrollen. */
function GrowingInput({
  value,
  onChangeText,
  placeholder,
  style,
  minHeight,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  style: object[];
  minHeight: number;
}) {
  const [height, setHeight] = useState(minHeight);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={color("ink", "inkDim")}
      multiline
      textAlignVertical="top"
      onContentSizeChange={(e) => setHeight(Math.max(minHeight, Math.ceil(e.nativeEvent.contentSize.height) + BORDER * 2))}
      style={[...style, { height, minHeight, overflow: "hidden" }, noOutline]}
    />
  );
}

function PhotoBtn({ label, hint, onPress, disabled, style }: { label: string; hint: string; onPress: () => void; disabled: boolean; style: TextStyle }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={onPress}
      disabled={disabled}
      style={{ flex: 1, height: 28, alignItems: "center", justifyContent: "center", opacity: disabled ? 0.25 : 1 }}
    >
      <Text style={style}>{label}</Text>
    </Pressable>
  );
}

function initialPhotos(post: PostWithAuthor): EditPhoto[] {
  if (post.album_paths?.length && post.album_urls?.length === post.album_paths.length) {
    return post.album_paths.map((path, i) => ({ path, uri: post.album_urls![i] }));
  }
  return post.image_path && post.image_url ? [{ path: post.image_path, uri: post.image_url }] : [];
}

function samePhotos(a: EditPhoto[], b: EditPhoto[]): boolean {
  return a.length === b.length && a.every((p, i) => p.path !== null && p.path === b[i].path);
}
