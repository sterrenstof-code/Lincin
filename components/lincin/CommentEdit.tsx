import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Platform, Pressable, Text, TextInput, View, type StyleProp, type TextStyle } from "react-native";

import { updateEntityComment, type EntityComment } from "@/lib/api/entity-comments";
import { color, useThemeSpec } from "@/lib/design/theme";
import { lincinType } from "@/lib/design/type";
import { useT } from "@/lib/i18n";
import { useToast } from "@/lib/toast";

import { useComposeSuggest, EmojiSuggestions } from "./ComposeBar";
import { MentionSuggestions } from "./MentionSuggest";

/**
 * De tekst van een comment, en voor je eigen comment: hem aanpassen.
 *
 * Onder de tekst staat "bewerkt" als hij ooit aangepast werd (dat zet de
 * database, 0080), en bij je eigen comment een knopje "Bewerk". Dat zet de
 * tekst om in een invoerveld met dezelfde letter, met Bewaar en Annuleer
 * eronder; Enter bewaart, Escape annuleert (op web). @-namen en emoji
 * werken er net zo als in de gewone invoer.
 *
 * Eén onderdeel voor de telefoon (`CommentRow`) en het brede scherm
 * (`DesktopPost`), zodat bewerken op beide hetzelfde dóét; de aanroeper
 * geeft alleen de letter mee.
 */
export function CommentText({
  comment: c,
  own,
  textStyle,
}: {
  comment: EntityComment;
  own: boolean;
  textStyle: StyleProp<TextStyle>;
}) {
  const t = useT();
  const qc = useQueryClient();
  const toast = useToast();
  const round = useThemeSpec().id !== "kleur";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [saving, setSaving] = useState(false);
  /** De hoogte van de tekst in het veld, zodat het meegroeit. */
  const [inputH, setInputH] = useState<number | undefined>(undefined);
  const suggest = useComposeSuggest(draft, setDraft);

  const canSave = !saving && (draft.trim().length > 0 || !!c.image_path) && draft.trim() !== c.body;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    try {
      await updateEntityComment(c.id, draft);
      await qc.invalidateQueries({ queryKey: ["entity-comments", c.entity_type, c.entity_id] });
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Bewaren lukte niet");
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(c.body);
    setEditing(false);
  }

  const dim = color("ink", "inkDim");
  const small = [lincinType.meta, { textTransform: "none" as const, color: dim }];

  if (editing) {
    return (
      <View style={{ gap: 6 }}>
        <TextInput
          value={draft}
          onChangeText={suggest.onChangeText}
          onKeyPress={(e) => {
            const ne = e.nativeEvent as { key: string; shiftKey?: boolean };
            if (Platform.OS === "web" && ne.key === "Escape") return cancel();
            // Op web: Enter bewaart, Shift+Enter is een nieuwe regel. Een
            // open suggestie gaat voor — Tab neemt die, Enter bewaart nog niet.
            if (Platform.OS === "web" && ne.key === "Enter" && !ne.shiftKey) {
              (e as { preventDefault?: () => void }).preventDefault?.();
              return void save();
            }
            suggest.onKeyPress(e as never);
          }}
          // Meerdere regels: een comment is vaak langer dan één regel, en
          // op één regel schoof de tekst zijwaarts weg terwijl je typte.
          multiline
          scrollEnabled={false}
          onContentSizeChange={(e) => {
            // Alleen bij een echte verandering: op web is de gemeten hoogte
            // die van het veld zelf, en elke extra pixel hier zou het veld
            // opnieuw doen groeien — een lus zonder einde.
            const h = Math.ceil(e.nativeEvent.contentSize.height);
            setInputH((prev) => (prev !== undefined && Math.abs(prev - h) <= 1 ? prev : h));
          }}
          returnKeyType="done"
          autoFocus
          maxLength={500}
          editable={!saving}
          style={[
            textStyle,
            {
              paddingVertical: 4,
              textAlignVertical: "top",
              height: inputH,
              overflow: "hidden",
              borderBottomWidth: 1,
              borderBottomColor: color("ink"),
              ...(Platform.OS === "web" ? ({ outlineWidth: 0, outlineStyle: "none" } as object) : null),
            },
          ]}
        />
        <View style={{ marginHorizontal: -20 }}>
          <EmojiSuggestions list={suggest.list} onPick={suggest.apply} round={round} pad={20} />
          <MentionSuggestions list={suggest.mention.list} onPick={suggest.mention.apply} round={round} pad={20} />
        </View>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <Pressable accessibilityRole="button" onPress={save} disabled={!canSave} hitSlop={6} style={{ opacity: canSave ? 1 : 0.4 }}>
            <Text style={[lincinType.meta, { textTransform: "none", color: color("ink") }]}>{saving ? t.saving : t.save}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={cancel} hitSlop={6}>
            <Text style={small}>{t.cancel}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <>
      {c.body ? <Text style={textStyle}>{c.body}</Text> : null}
      {c.edited_at || own ? (
        <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
          {c.edited_at ? <Text style={small}>{t.edited}</Text> : null}
          {own ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.editPost}
              onPress={() => {
                setDraft(c.body);
                setEditing(true);
              }}
              hitSlop={6}
            >
              <Text style={small}>{t.editPost}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </>
  );
}
