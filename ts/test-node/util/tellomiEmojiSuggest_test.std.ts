// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  TELLOMI_EMOJI_SUGGEST_MAX_RESULTS,
  TELLOMI_EMOJI_SUGGEST_TABLE,
  tellomiEmojiSuggest,
  tellomiEmojiSuggestApply,
  type TellomiEmojiSuggestion,
} from '../../util/tellomiEmojiSuggest.std.ts';

function s(
  text: string,
  cursor: number = text.length
): TellomiEmojiSuggestion | null {
  return tellomiEmojiSuggest(text, cursor, cursor);
}

describe('tellomiEmojiSuggest', () => {
  it('colonPrefixQuery', () => {
    const r = s('hi :smi');
    assert.isNotNull(r);
    assert.strictEqual(r?.query, 'smi');
    assert.strictEqual(r?.emoji[0], '😄');
    assert.strictEqual(r?.replacementStart, 3);
    assert.strictEqual(r?.replacementLength, 4);
  });

  it('colonQueryNeedsTwoChars', () => {
    assert.isNull(s(':s'));
    assert.isNotNull(s(':lo'));
  });

  it('colonQueryNotAfterWordOrUrl', () => {
    assert.isNull(s('http:lo'));
    assert.isNull(s('a::lo'));
    assert.isNull(s('https://love'));
  });

  it('wholeEnglishWord', () => {
    const r = s('I am OK');
    assert.isNotNull(r);
    assert.strictEqual(r?.query, 'ok');
    assert.deepStrictEqual(r?.emoji, ['👌', '🆗']);
    assert.strictEqual(r?.replacementStart, 5);
    assert.strictEqual(r?.replacementLength, 2);
    assert.isNull(s('smi'));
  });

  it('chineseLongestSuffix', () => {
    const r = s('祝你生日快乐');
    assert.isNotNull(r);
    assert.strictEqual(r?.query, '生日快乐');
    assert.strictEqual(r?.replacementStart, 2);
    assert.strictEqual(r?.replacementLength, 4);
    assert.strictEqual(s('哈哈哈')?.query, '哈哈');
    assert.strictEqual(s('太好')?.query, '好');
  });

  it('noSuggestionMidWordOrWithSelection', () => {
    assert.isNull(s('okay', 2));
    assert.isNull(s('好的呀', 2));
    assert.isNull(tellomiEmojiSuggest('ok', 0, 2));
    assert.isNull(s(''));
    assert.isNull(s('ok '));
  });

  it('cursorInMiddleBeforeSpace', () => {
    const r = s('lol and more', 3);
    assert.isNotNull(r);
    assert.strictEqual(r?.query, 'lol');
  });

  it('resultsDedupedAndCapped', () => {
    assert.isNull(s(':l'));
    assert.isNull(s(':c'));
    const love = s(':lo');
    assert.isNotNull(love);
    assert.strictEqual(new Set(love?.emoji).size, love?.emoji.length);
    assert.isAtMost(
      love?.emoji.length ?? 99,
      TELLOMI_EMOJI_SUGGEST_MAX_RESULTS
    );
  });

  it('applyReplacesQueryAndMovesCursor', () => {
    const text = '好的 :smi';
    const r = s(text);
    assert.isNotNull(r);
    if (!r) {
      throw new Error('expected a suggestion');
    }
    const { text: out, cursor } = tellomiEmojiSuggestApply(r, '😄', text);
    assert.strictEqual(out, '好的 😄');
    assert.strictEqual(cursor, out.length);
  });

  it('emojiTableHasNoEmptyRowsOrDuplicateKeywords', () => {
    const kws = TELLOMI_EMOJI_SUGGEST_TABLE.map(([kw]) => kw);
    assert.strictEqual(new Set(kws).size, kws.length);
    assert.isTrue(
      TELLOMI_EMOJI_SUGGEST_TABLE.every(([, row]) => row.length > 0)
    );
  });
});
