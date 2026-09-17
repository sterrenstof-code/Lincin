import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Platform, TextInput, View } from "react-native";

import { updatePost, type PostWithAuthor } from "@/lib/api/posts";
import { color, line } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { invalidatePostCaches } from "@/lib/post-cache";

import { BORDER, Btn, Mono } from "./ui";

/**
 * Je eigen bijdrage bewerken: de titel, de zin eronder en de tekst.
 *
 * Dezelfde drie velden als bij Nieuwe bijdrage, in dezelfde letters, zodat
 * verbeteren eruitziet als schrijven. Onderaan `Annuleer` en `Bewaar`.
 * Gedeeld door de bladzijde op de telefoon en op desktop.
 */
export function EditPost({ post, onDone }: { post: PostWithAuthor; onDone: () => void }) {
  const t = useT();
  const qc = useQueryClient();
  const [title, setTitle] = useState(post.source_title ?? "");
  const [caption, setCaption] = useState(post.caption ?? "");
  const [body, setBody] = useState(post.body_text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await updatePost(post.id, { source_title: title, caption, body_text: body });
      await Promise.all([qc.invalidateQueries({ queryKey: ["post", post.id] }), invalidatePostCaches(qc)]);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed);
      setSaving(false);
    }
  }

  const noOutline = Platform.OS === "web" ? ({ outlineWidth: 0 } as object) : null;
  const ink = color("ink");
  const dim = color("ink", "inkDim");

  return (
    <View style={{ gap: 14 }}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder={t.titlePh}
        placeholderTextColor={dim}
        autoCapitalize="characters"
        style={[lincinType.cardTitle, { fontSize: 26, lineHeight: 30, minHeight: 48, borderBottomWidth: BORDER, borderBottomColor: line(), color: ink }, noOutline]}
      />
      <TextInput
        value={caption}
        onChangeText={setCaption}
        placeholder={t.captionPh}
        placeholderTextColor={dim}
        multiline
        style={[lincinType.quote, { minHeight: 44, paddingVertical: 8, borderBottomWidth: BORDER, borderBottomColor: line(), color: ink }, noOutline]}
      />
      <TextInput
        value={body}
        onChangeText={setBody}
        placeholder={t.textPh}
        placeholderTextColor={dim}
        multiline
        textAlignVertical="top"
        style={[lincinType.body, { minHeight: 140, padding: 12, borderWidth: BORDER, borderColor: line(), color: ink }, noOutline]}
      />
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
