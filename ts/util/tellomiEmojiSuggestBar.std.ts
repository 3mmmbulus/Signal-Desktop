// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tellomi (desktop audit 3.4 / F22): suggestion-bar pure logic.
 * Aligns with iOS TellomiEmojiSuggestBarModel (#384) and Android TellomiEmojiSuggestBarModel.
 */

import {
  TELLOMI_EMOJI_SUGGEST_MAX_RESULTS,
  tellomiEmojiSuggest,
  tellomiEmojiSuggestApply,
} from './tellomiEmojiSuggest.std.ts';

export const TELLOMI_EMOJI_SUGGEST_BAR_HEIGHT_PX = 40;

export type TellomiEmojiSuggestBarApplied = {
  text: string;
  replacedStart: number;
  replacedLength: number;
  cursor: number;
};

/** Emoji to show for the current text/cursor; empty → hide the bar. */
export function tellomiEmojiSuggestBarVisibleEmoji(
  text: string,
  selectionStart: number,
  selectionEnd: number
): ReadonlyArray<string> {
  const suggestion = tellomiEmojiSuggest(text, selectionStart, selectionEnd);
  if (suggestion == null) {
    return [];
  }
  const seen = new Set<string>();
  const out: Array<string> = [];
  for (const e of suggestion.emoji) {
    if (seen.has(e)) {
      continue;
    }
    seen.add(e);
    out.push(e);
    if (out.length === TELLOMI_EMOJI_SUGGEST_MAX_RESULTS) {
      break;
    }
  }
  return out;
}

/** Tap a suggestion: replace the query in `text`, or null if stale/unknown. */
export function tellomiEmojiSuggestBarApplying(
  emoji: string,
  text: string,
  selectionStart: number,
  selectionEnd: number
): TellomiEmojiSuggestBarApplied | null {
  const suggestion = tellomiEmojiSuggest(text, selectionStart, selectionEnd);
  if (suggestion == null || !suggestion.emoji.includes(emoji)) {
    return null;
  }
  const { text: out, cursor } = tellomiEmojiSuggestApply(
    suggestion,
    emoji,
    text
  );
  return {
    text: out,
    replacedStart: suggestion.replacementStart,
    replacedLength: suggestion.replacementLength,
    cursor,
  };
}
