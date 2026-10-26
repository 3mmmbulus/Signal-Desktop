// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  TELLOMI_SINGLE_EMOJI_ANIM_DURATION_MS,
  TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES,
  TellomiSingleEmojiAnimTrigger,
  tellomiSingleEmojiShouldAnimate,
} from '../../util/tellomiSingleEmojiAnimation.std.ts';

describe('tellomiSingleEmojiAnimation', () => {
  it('onlySingleEmojiAnimates', () => {
    assert.isFalse(
      tellomiSingleEmojiShouldAnimate({
        jumbomojiCount: null,
        trigger: TellomiSingleEmojiAnimTrigger.Appeared,
        reduceMotion: false,
        alreadyPlayedOnAppear: false,
      })
    );
    assert.isFalse(
      tellomiSingleEmojiShouldAnimate({
        jumbomojiCount: 0,
        trigger: TellomiSingleEmojiAnimTrigger.Tapped,
        reduceMotion: false,
        alreadyPlayedOnAppear: false,
      })
    );
    assert.isTrue(
      tellomiSingleEmojiShouldAnimate({
        jumbomojiCount: 1,
        trigger: TellomiSingleEmojiAnimTrigger.Appeared,
        reduceMotion: false,
        alreadyPlayedOnAppear: false,
      })
    );
    assert.isFalse(
      tellomiSingleEmojiShouldAnimate({
        jumbomojiCount: 2,
        trigger: TellomiSingleEmojiAnimTrigger.Tapped,
        reduceMotion: false,
        alreadyPlayedOnAppear: false,
      })
    );
    assert.isFalse(
      tellomiSingleEmojiShouldAnimate({
        jumbomojiCount: 5,
        trigger: TellomiSingleEmojiAnimTrigger.Appeared,
        reduceMotion: false,
        alreadyPlayedOnAppear: false,
      })
    );
  });

  it('reduceMotionDisables', () => {
    assert.isFalse(
      tellomiSingleEmojiShouldAnimate({
        jumbomojiCount: 1,
        trigger: TellomiSingleEmojiAnimTrigger.Appeared,
        reduceMotion: true,
        alreadyPlayedOnAppear: false,
      })
    );
    assert.isFalse(
      tellomiSingleEmojiShouldAnimate({
        jumbomojiCount: 1,
        trigger: TellomiSingleEmojiAnimTrigger.Tapped,
        reduceMotion: true,
        alreadyPlayedOnAppear: false,
      })
    );
  });

  it('appearPlaysOnceTapAlwaysReplays', () => {
    assert.isFalse(
      tellomiSingleEmojiShouldAnimate({
        jumbomojiCount: 1,
        trigger: TellomiSingleEmojiAnimTrigger.Appeared,
        reduceMotion: false,
        alreadyPlayedOnAppear: true,
      })
    );
    assert.isTrue(
      tellomiSingleEmojiShouldAnimate({
        jumbomojiCount: 1,
        trigger: TellomiSingleEmojiAnimTrigger.Tapped,
        reduceMotion: false,
        alreadyPlayedOnAppear: true,
      })
    );
  });

  it('keyframesShape', () => {
    assert.strictEqual(TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES[0]?.relativeTime, 0);
    const last =
      TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES[
        TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES.length - 1
      ];
    assert.strictEqual(last?.relativeTime, 1);
    assert.strictEqual(last?.scale, 1);
    const times = TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES.map(k => k.relativeTime);
    assert.deepStrictEqual(
      times,
      [...times].sort((a, b) => a - b)
    );
    assert.isAbove(TELLOMI_SINGLE_EMOJI_ANIM_DURATION_MS, 0);
    assert.isAtMost(TELLOMI_SINGLE_EMOJI_ANIM_DURATION_MS, 600);
  });
});
