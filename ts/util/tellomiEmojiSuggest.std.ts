// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tellomi (desktop audit 3.4 / F22): typing-time emoji suggestions — pure logic.
 * Aligns with iOS TellomiEmojiSuggest (#378) and Android TellomiEmojiSuggest (#423).
 * Behaviour references Telegram; table and rules are Tellomi-owned (no protocol change).
 *
 * Rules:
 * - Cursor before a `:` + ≥2 ASCII word chars (e.g. `:smi`): prefix-match keywords; replace `:smi`.
 * - Cursor after a whole English keyword (whitespace/punct bounded): exact match; replace the word.
 * - Cursor after Han run: longest 1–4 char suffix that equals a keyword; replace that suffix.
 * - No suggestion mid-word, with a selection, after `::`, or URL-ish `http:`.
 * - Results deduped, table order, capped at MAX_RESULTS.
 */

export const TELLOMI_EMOJI_SUGGEST_MAX_RESULTS = 8;
const TELLOMI_EMOJI_SUGGEST_MIN_COLON_QUERY_LENGTH = 2;

export type TellomiEmojiSuggestion = {
  /** UTF-16 index into `text` (JS string index). */
  replacementStart: number;
  replacementLength: number;
  query: string;
  emoji: ReadonlyArray<string>;
};

/** Keyword → emoji. Lowercase English + Chinese; order is priority. */
export const TELLOMI_EMOJI_SUGGEST_TABLE: ReadonlyArray<
  readonly [string, ReadonlyArray<string>]
> = [
  ['smile', ['😄', '😊', '🙂']],
  ['laugh', ['😂', '🤣']],
  ['lol', ['😂', '🤣']],
  ['love', ['❤️', '😍', '🥰']],
  ['heart', ['❤️', '💕']],
  ['kiss', ['😘', '💋']],
  ['cry', ['😢', '😭']],
  ['sad', ['😢', '😞']],
  ['angry', ['😠', '😡']],
  ['ok', ['👌', '🆗']],
  ['yes', ['👍']],
  ['no', ['🙅', '👎']],
  ['thanks', ['🙏']],
  ['thumbsup', ['👍']],
  ['clap', ['👏']],
  ['fire', ['🔥']],
  ['party', ['🎉', '🥳']],
  ['cool', ['😎']],
  ['think', ['🤔']],
  ['sleep', ['😴']],
  ['wow', ['😮', '🤩']],
  ['cat', ['🐱']],
  ['dog', ['🐶']],
  ['coffee', ['☕️']],
  ['beer', ['🍺']],
  ['cake', ['🎂']],
  ['sun', ['☀️']],
  ['rain', ['🌧️']],
  ['哈哈', ['😂', '🤣', '😄']],
  ['笑', ['😄', '😂']],
  ['爱', ['❤️', '😍']],
  ['爱你', ['😘', '❤️']],
  ['哭', ['😭', '😢']],
  ['难过', ['😢', '😞']],
  ['生气', ['😠', '😡']],
  ['好的', ['👌', '👍']],
  ['好', ['👍', '👌']],
  ['谢谢', ['🙏', '😊']],
  ['赞', ['👍']],
  ['鼓掌', ['👏']],
  ['厉害', ['👍', '🔥']],
  ['生日快乐', ['🎂', '🎉']],
  ['晚安', ['😴', '🌙']],
  ['早安', ['☀️', '😊']],
  ['思考', ['🤔']],
  ['咖啡', ['☕️']],
  ['啤酒', ['🍺']],
  ['猫', ['🐱']],
  ['狗', ['🐶']],
];

const MAX_HAN_KEYWORD_LENGTH = 4;

function tellomiEmojiSuggestIsAsciiWord(cp: number): boolean {
  if (cp > 0x7f) {
    return false;
  }
  const ch = String.fromCharCode(cp);
  return /[0-9A-Za-z_]/.test(ch);
}

function tellomiEmojiSuggestIsHan(cp: number): boolean {
  return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf);
}

function isWordCodePoint(cp: number): boolean {
  if (tellomiEmojiSuggestIsHan(cp)) {
    return false;
  }
  return /\p{L}|\p{N}/u.test(String.fromCodePoint(cp));
}

function isBoundary(cp: number): boolean {
  const ch = String.fromCodePoint(cp);
  if (/\s/u.test(ch) || tellomiEmojiSuggestIsHan(cp)) {
    return true;
  }
  if (cp === 0x3a /* : */ || cp === 0x2f /* / */) {
    return false;
  }
  return /\p{P}/u.test(ch);
}

function codePointsOf(text: string): Array<number> {
  return Array.from(text, ch => ch.codePointAt(0) ?? 0);
}

function utf16LengthOfCodePoints(cps: ReadonlyArray<number>): number {
  let n = 0;
  for (const cp of cps) {
    n += cp > 0xffff ? 2 : 1;
  }
  return n;
}

function collect(match: (keyword: string) => boolean): Array<string> {
  const out: Array<string> = [];
  for (const [keyword, row] of TELLOMI_EMOJI_SUGGEST_TABLE) {
    if (!match(keyword)) {
      continue;
    }
    for (const e of row) {
      if (!out.includes(e)) {
        out.push(e);
        if (out.length === TELLOMI_EMOJI_SUGGEST_MAX_RESULTS) {
          return out;
        }
      }
    }
  }
  return out;
}

export function tellomiEmojiSuggest(
  text: string,
  selectionStart: number,
  selectionEnd: number
): TellomiEmojiSuggestion | null {
  if (selectionStart !== selectionEnd) {
    return null;
  }
  if (selectionStart < 0 || selectionStart > text.length) {
    return null;
  }
  const cursor = selectionStart;
  if (cursor < text.length) {
    const next = text.codePointAt(cursor);
    if (
      next != null &&
      (isWordCodePoint(next) || tellomiEmojiSuggestIsHan(next))
    ) {
      return null;
    }
  }
  const before = text.slice(0, cursor);
  const scalars = codePointsOf(before);

  // 1) `:query`
  let i = scalars.length;
  while (i > 0 && tellomiEmojiSuggestIsAsciiWord(scalars[i - 1] ?? 0)) {
    i -= 1;
  }
  const wordLen = scalars.length - i;
  if (wordLen > 0) {
    const wordCps = scalars.slice(i);
    const word = String.fromCodePoint(...wordCps).toLowerCase();
    const utf16Len = utf16LengthOfCodePoints(wordCps);
    if (i > 0 && scalars[i - 1] === 0x3a /* : */) {
      const colonIdx = i - 1;
      const precededOk =
        colonIdx === 0 || isBoundary(scalars[colonIdx - 1] ?? 0);
      if (
        !precededOk ||
        wordLen < TELLOMI_EMOJI_SUGGEST_MIN_COLON_QUERY_LENGTH
      ) {
        return null;
      }
      const emoji = collect(
        kw =>
          kw.startsWith(word) &&
          Array.from(kw).every(ch =>
            tellomiEmojiSuggestIsAsciiWord(ch.codePointAt(0) ?? 0)
          )
      );
      if (emoji.length === 0) {
        return null;
      }
      return {
        replacementStart: cursor - utf16Len - 1,
        replacementLength: utf16Len + 1,
        query: word,
        emoji,
      };
    }
    // 2) whole English word
    if (!(i === 0 || isBoundary(scalars[i - 1] ?? 0))) {
      return null;
    }
    const emoji = collect(kw => kw === word);
    if (emoji.length === 0) {
      return null;
    }
    return {
      replacementStart: cursor - utf16Len,
      replacementLength: utf16Len,
      query: word,
      emoji,
    };
  }

  // 3) Chinese: longest complete keyword suffix in the trailing Han run.
  let h = scalars.length;
  while (
    h > 0 &&
    tellomiEmojiSuggestIsHan(scalars[h - 1] ?? 0) &&
    scalars.length - h < MAX_HAN_KEYWORD_LENGTH
  ) {
    h -= 1;
  }
  if (h >= scalars.length) {
    return null;
  }
  for (let start = h; start < scalars.length; start += 1) {
    const candidateCps = scalars.slice(start);
    const candidate = String.fromCodePoint(...candidateCps);
    const emoji = collect(kw => kw === candidate);
    if (emoji.length > 0) {
      const len = utf16LengthOfCodePoints(candidateCps);
      return {
        replacementStart: cursor - len,
        replacementLength: len,
        query: candidate,
        emoji,
      };
    }
  }
  return null;
}

/** Apply a picked emoji: new text + new cursor (UTF-16). */
export function tellomiEmojiSuggestApply(
  suggestion: TellomiEmojiSuggestion,
  emoji: string,
  text: string
): { text: string; cursor: number } {
  const start = suggestion.replacementStart;
  const end = start + suggestion.replacementLength;
  const out = text.slice(0, start) + emoji + text.slice(end);
  return { text: out, cursor: start + emoji.length };
}
