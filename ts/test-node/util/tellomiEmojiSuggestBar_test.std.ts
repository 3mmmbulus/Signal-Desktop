// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { tellomiEmojiSuggest } from '../../util/tellomiEmojiSuggest.std.ts';
import {
  tellomiEmojiSuggestBarApplying,
  tellomiEmojiSuggestBarVisibleEmoji,
  tellomiEmojiSuggestShouldSuppressUpstreamPopper,
} from '../../util/tellomiEmojiSuggestBar.std.ts';

describe('tellomiEmojiSuggestBar', () => {
  it('noSuggestionsHidesBar', () => {
    assert.deepStrictEqual(
      tellomiEmojiSuggestBarVisibleEmoji('hello there', 11, 11),
      []
    );
    assert.deepStrictEqual(tellomiEmojiSuggestBarVisibleEmoji('', 0, 0), []);
  });

  it('colonQueryShowsAtMostEight', () => {
    const text = 'hi :smi';
    const emoji = tellomiEmojiSuggestBarVisibleEmoji(
      text,
      text.length,
      text.length
    );
    assert.isAbove(emoji.length, 0);
    assert.isAtMost(emoji.length, 8);
    assert.strictEqual(new Set(emoji).size, emoji.length);
  });

  it('rangeSelectionShowsNothing', () => {
    const text = 'hi :smi';
    assert.deepStrictEqual(tellomiEmojiSuggestBarVisibleEmoji(text, 3, 7), []);
  });

  it('applyingReplacesQueryAndMovesCursor', () => {
    const text = 'hi :smi';
    const first = tellomiEmojiSuggestBarVisibleEmoji(
      text,
      text.length,
      text.length
    )[0];
    assert.isString(first);
    if (typeof first !== 'string') {
      throw new Error('expected a visible emoji');
    }
    const result = tellomiEmojiSuggestBarApplying(
      first,
      text,
      text.length,
      text.length
    );
    assert.isNotNull(result);
    assert.strictEqual(result?.text, `hi ${first}`);
    assert.strictEqual(result?.replacedStart, 3);
    assert.strictEqual(result?.replacedLength, 4);
    assert.strictEqual(result?.cursor, `hi ${first}`.length);
  });

  it('applyingUnknownEmojiOrStaleTextIsNull', () => {
    const text = 'hi :smi';
    assert.isNull(
      tellomiEmojiSuggestBarApplying('🦖🦖', text, text.length, text.length)
    );
    assert.isNull(tellomiEmojiSuggestBarApplying('😄', 'hi there', 8, 8));
  });

  it('barModelVisibleMatchesSuggestion', () => {
    assert.isNotNull(tellomiEmojiSuggest('ok', 2, 2));
    assert.deepStrictEqual(
      tellomiEmojiSuggestBarVisibleEmoji('ok', 2, 2),
      [...(tellomiEmojiSuggest('ok', 2, 2)?.emoji ?? [])]
        .filter((e, i, a) => a.indexOf(e) === i)
        .slice(0, 8)
    );
  });

  it('colonQueryWithTellomiMatchSuppressesUpstreamPopper', () => {
    const text = 'hi :smi';
    assert.isTrue(
      tellomiEmojiSuggestShouldSuppressUpstreamPopper(
        text,
        text.length,
        text.length
      )
    );
    assert.isAbove(
      tellomiEmojiSuggestBarVisibleEmoji(text, text.length, text.length).length,
      0
    );
  });

  it('colonQueryWithoutTellomiMatchKeepsUpstreamPopper', () => {
    // Not in Tellomi keyword table; upstream EmojiCompletion may still show.
    const text = ':zzzznotakeyword';
    assert.isFalse(
      tellomiEmojiSuggestShouldSuppressUpstreamPopper(
        text,
        text.length,
        text.length
      )
    );
    assert.deepStrictEqual(
      tellomiEmojiSuggestBarVisibleEmoji(text, text.length, text.length),
      []
    );
  });

  it('englishAndHanSuppressWhenBarVisible', () => {
    assert.isTrue(tellomiEmojiSuggestShouldSuppressUpstreamPopper('ok', 2, 2));
    assert.isTrue(
      tellomiEmojiSuggestShouldSuppressUpstreamPopper('哈哈', 2, 2)
    );
    assert.isFalse(
      tellomiEmojiSuggestShouldSuppressUpstreamPopper('hello there', 11, 11)
    );
  });
});
