// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  TELLOMI_SINGLE_EMOJI_ANIM_DURATION_MS,
  TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES,
} from '../../util/tellomiSingleEmojiAnimation.std.ts';
import {
  TellomiSingleEmojiAnimationPlayer,
  cancelTellomiSingleEmojiAnimation,
  playTellomiSingleEmojiAnimation,
  tellomiSingleEmojiAnimFrames,
  tellomiSingleEmojiAnimTiming,
  tellomiSingleEmojiReduceMotion,
} from '../../util/tellomiSingleEmojiAnimationPlayer.std.ts';

describe('tellomiSingleEmojiAnimationPlayer', () => {
  beforeEach(() => {
    TellomiSingleEmojiAnimationPlayer.resetSharedForTests();
  });

  it('appearPlaysOncePerMessage', () => {
    const player = new TellomiSingleEmojiAnimationPlayer();
    assert.isTrue(player.consumeAppear('a', 1, false));
    assert.isFalse(player.consumeAppear('a', 1, false));
    assert.isTrue(player.consumeAppear('b', 1, false));
  });

  it('nonSingleEmojiAndReduceMotionNeverRecorded', () => {
    const player = new TellomiSingleEmojiAnimationPlayer();
    assert.isFalse(player.consumeAppear('a', 2, false));
    assert.isFalse(player.consumeAppear('a', null, false));
    assert.isFalse(player.consumeAppear('a', 1, true));
    assert.isFalse(player.hasPlayedOnAppear('a'));
  });

  it('tapAlwaysReplaysUnlessReduceMotion', () => {
    const player = new TellomiSingleEmojiAnimationPlayer();
    player.consumeAppear('a', 1, false);
    assert.isTrue(player.shouldPlayOnTap(1, false));
    assert.isTrue(player.shouldPlayOnTap(1, false));
    assert.isFalse(player.shouldPlayOnTap(1, true));
    assert.isFalse(player.shouldPlayOnTap(3, false));
  });

  it('animFramesMatchKeyframes', () => {
    const frames = tellomiSingleEmojiAnimFrames();
    assert.strictEqual(
      frames.length,
      TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES.length
    );
    assert.strictEqual(frames[0]?.offset, 0);
    assert.strictEqual(frames[frames.length - 1]?.offset, 1);
    assert.strictEqual(frames[frames.length - 1]?.transform, 'scale(1)');
    const timing = tellomiSingleEmojiAnimTiming();
    assert.strictEqual(timing.duration, TELLOMI_SINGLE_EMOJI_ANIM_DURATION_MS);
  });

  it('reduceMotionReadsMatchMedia', () => {
    assert.isTrue(
      tellomiSingleEmojiReduceMotion(
        () => ({ matches: true }) as MediaQueryList
      )
    );
    assert.isFalse(
      tellomiSingleEmojiReduceMotion(
        () => ({ matches: false }) as MediaQueryList
      )
    );
    assert.isFalse(tellomiSingleEmojiReduceMotion(undefined));
  });

  it('playAndCancelOnDuckTypedElement', () => {
    const animations: Array<{ id: string; cancel: () => void }> = [];
    const el = {
      animate: (
        _keyframes: Array<Record<string, string | number | null | undefined>>,
        options: { id: string }
      ) => {
        const animation = {
          id: options.id,
          cancel: () => {
            const idx = animations.indexOf(animation);
            if (idx >= 0) {
              animations.splice(idx, 1);
            }
          },
        };
        animations.push(animation);
        return animation;
      },
      getAnimations: () => animations.slice(),
    };
    const first = playTellomiSingleEmojiAnimation(el);
    assert.strictEqual(first.id, 'tellomi-single-emoji-pop');
    assert.strictEqual(animations.length, 1);
    playTellomiSingleEmojiAnimation(el);
    assert.strictEqual(animations.length, 1);
    cancelTellomiSingleEmojiAnimation(el);
    assert.strictEqual(animations.length, 0);
  });
});
