export const EMOTICON_MAP: [RegExp, string][] = [
  [/:-?\)/g,  "😊"], [/:-?D/g,   "😄"], [/:-?\(/g,  "😔"],
  [/;-?\)/g,  "😉"], [/:-?P/gi,  "😛"], [/:-?\*/g,  "😘"],
  [/:-?O/gi,  "😮"], [/:-?\|/g,  "😐"], [/>:-?\(/g, "😠"],
  [/:-?\//g,  "😕"], [/:'?\(/g,  "😢"], [/\^_?\^/g, "😊"],
  [/<3/g,     "❤️"], [/<\/3/g,   "💔"], [/B-?\)/g,  "😎"],
  [/:-?X/gi,  "🤐"], [/O:-?\)/g, "😇"], [/:-?S/gi,  "😖"],
];

export const EMOJI_SHORTCODES: { name: string; emoji: string }[] = [
  { name: "thumbsup", emoji: "👍" }, { name: "+1", emoji: "👍" },
  { name: "thumbsdown", emoji: "👎" }, { name: "-1", emoji: "👎" },
  { name: "heart", emoji: "❤️" }, { name: "red_heart", emoji: "❤️" },
  { name: "laughing", emoji: "😂" }, { name: "joy", emoji: "😂" }, { name: "lol", emoji: "😂" },
  { name: "rofl", emoji: "🤣" },
  { name: "smile", emoji: "😊" }, { name: "blush", emoji: "😊" },
  { name: "grin", emoji: "😁" }, { name: "wink", emoji: "😉" },
  { name: "stuck_out_tongue", emoji: "😛" }, { name: "tongue", emoji: "😛" },
  { name: "sunglasses", emoji: "😎" }, { name: "cool", emoji: "😎" },
  { name: "thinking", emoji: "🤔" },
  { name: "hushed", emoji: "😮" }, { name: "open_mouth", emoji: "😮" },
  { name: "cry", emoji: "😢" }, { name: "crying", emoji: "😢" },
  { name: "sob", emoji: "😭" }, { name: "scream", emoji: "😱" },
  { name: "angry", emoji: "😠" }, { name: "rage", emoji: "😡" },
  { name: "fire", emoji: "🔥" }, { name: "flame", emoji: "🔥" },
  { name: "tada", emoji: "🎉" }, { name: "party", emoji: "🎉" },
  { name: "eyes", emoji: "👀" }, { name: "wave", emoji: "👋" },
  { name: "pray", emoji: "🙏" }, { name: "100", emoji: "💯" },
  { name: "ok", emoji: "👌" }, { name: "ok_hand", emoji: "👌" },
  { name: "clap", emoji: "👏" }, { name: "muscle", emoji: "💪" },
  { name: "rocket", emoji: "🚀" }, { name: "star", emoji: "⭐" },
  { name: "sparkles", emoji: "✨" },
  { name: "check", emoji: "✅" }, { name: "white_check_mark", emoji: "✅" },
  { name: "x", emoji: "❌" }, { name: "no", emoji: "❌" },
  { name: "broken_heart", emoji: "💔" }, { name: "poop", emoji: "💩" },
  { name: "skull", emoji: "💀" }, { name: "dead", emoji: "💀" },
  { name: "exploding_head", emoji: "🤯" }, { name: "mind_blown", emoji: "🤯" },
  { name: "salute", emoji: "🫡" }, { name: "hug", emoji: "🤗" },
  { name: "shrug", emoji: "🤷" }, { name: "facepalm", emoji: "🤦" },
  { name: "chef_kiss", emoji: "🤌" }, { name: "raised_hands", emoji: "🙌" },
  { name: "heart_eyes", emoji: "😍" }, { name: "kiss", emoji: "😘" },
  { name: "yum", emoji: "😋" }, { name: "monocle", emoji: "🧐" },
  { name: "zipper_mouth", emoji: "🤐" }, { name: "sweat_smile", emoji: "😅" },
  { name: "flushed", emoji: "😳" }, { name: "pleading", emoji: "🥺" },
  { name: "pensive", emoji: "😔" }, { name: "sleeping", emoji: "😴" },
  { name: "nerd", emoji: "🤓" }, { name: "ghost", emoji: "👻" },
  { name: "alien", emoji: "👽" }, { name: "robot", emoji: "🤖" },
  { name: "cat", emoji: "🐱" }, { name: "dog", emoji: "🐶" },
  { name: "pizza", emoji: "🍕" }, { name: "beer", emoji: "🍺" },
  { name: "coffee", emoji: "☕" }, { name: "cake", emoji: "🎂" },
  { name: "trophy", emoji: "🏆" }, { name: "medal", emoji: "🥇" },
  { name: "music", emoji: "🎵" }, { name: "microphone", emoji: "🎤" },
  { name: "phone", emoji: "📱" }, { name: "computer", emoji: "💻" },
  { name: "email", emoji: "📧" }, { name: "bulb", emoji: "💡" },
  { name: "warning", emoji: "⚠️" }, { name: "lock", emoji: "🔒" },
  { name: "key", emoji: "🔑" }, { name: "moneybag", emoji: "💰" },
];

export function replaceEmoticons(text: string): string {
  let result = text;
  for (const [pattern, emoji] of EMOTICON_MAP) {
    result = result.replace(pattern, (match, offset, str) => {
      const after = str[offset + match.length];
      if (after === undefined || after === " " || /[\s.,!?]/.test(after)) return emoji;
      return match;
    });
  }
  return result;
}

export function emojiSuggestionsFor(query: string): { name: string; emoji: string }[] {
  if (query.length < 2) return [];
  const q = query.toLowerCase();
  return EMOJI_SHORTCODES.filter(({ name }) => name.includes(q)).slice(0, 8);
}
