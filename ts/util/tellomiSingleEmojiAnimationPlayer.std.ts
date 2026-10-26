// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tellomi (audit 4.2 UI): play TellomiSingleEmojiAnimation on an element and
 * remember, in memory only, which messages already played their appear
 * animation (scrolling back does not replay). Click always replays.
 * Aligns iOS TellomiSingleEmojiAnimationPlayer (#385) / Android (#424).
 */

import {
  TELLOMI_SINGLE_EMOJI_ANIM_DURATION_MS,
  TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES,
  TellomiSingleEmojiAnimTrigger,
  tellomiSingleEmojiShouldAnimate,
} from './tellomiSingleEmojiAnimation.std.ts';

export const TELLOMI_SINGLE_EMOJI_ANIM_NAME = 'tellomi-single-emoji-pop';

export class TellomiSingleEmojiAnimationPlayer {
  static readonly shared = new TellomiSingleEmojiAnimationPlayer();

  readonly #playedOnAppear = new Set<string>();

  hasPlayedOnAppear(messageId: string): boolean {
    return this.#playedOnAppear.has(messageId);
  }

  /**
   * Returns true when the appear animation should play now, and records it as played.
   */
  consumeAppear(
    messageId: string,
    jumbomojiCount: number | null | undefined,
    reduceMotion: boolean
  ): boolean {
    const shouldPlay = tellomiSingleEmojiShouldAnimate({
      jumbomojiCount,
      trigger: TellomiSingleEmojiAnimTrigger.Appeared,
      reduceMotion,
      alreadyPlayedOnAppear: this.hasPlayedOnAppear(messageId),
    });
    if (shouldPlay) {
      this.#playedOnAppear.add(messageId);
    }
    return shouldPlay;
  }

  shouldPlayOnTap(
    jumbomojiCount: number | null | undefined,
    reduceMotion: boolean
  ): boolean {
    return tellomiSingleEmojiShouldAnimate({
      jumbomojiCount,
      trigger: TellomiSingleEmojiAnimTrigger.Tapped,
      reduceMotion,
      alreadyPlayedOnAppear: true,
    });
  }

  /** Test-only: clear the shared appear set. */
  static resetSharedForTests(): void {
    TellomiSingleEmojiAnimationPlayer.shared.#playedOnAppear.clear();
  }
}

export function tellomiSingleEmojiReduceMotion(
  matchMedia:
    | ((query: string) => MediaQueryList)
    | undefined = globalThis.matchMedia
): boolean {
  try {
    return matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  } catch {
    return false;
  }
}

export type TellomiSingleEmojiAnimatable = {
  animate: (
    keyframes: Array<Record<string, string | number | null | undefined>>,
    options: {
      duration: number;
      easing: string;
      fill: 'none';
      id: string;
    }
  ) => { id: string; cancel: () => void };
  getAnimations: () => ReadonlyArray<{ id: string; cancel: () => void }>;
};

/** Build Web Animations keyframes matching TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES. */
export function tellomiSingleEmojiAnimFrames(): Array<
  Record<string, string | number | null | undefined>
> {
  return TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES.map(frame => ({
    offset: frame.relativeTime,
    transform: `scale(${frame.scale})`,
  }));
}

export function tellomiSingleEmojiAnimTiming(): {
  duration: number;
  easing: string;
  fill: 'none';
  id: string;
} {
  return {
    duration: TELLOMI_SINGLE_EMOJI_ANIM_DURATION_MS,
    easing: 'ease-out',
    fill: 'none',
    id: TELLOMI_SINGLE_EMOJI_ANIM_NAME,
  };
}

/** Cancel any in-flight pop on `el`. */
export function cancelTellomiSingleEmojiAnimation(
  el: TellomiSingleEmojiAnimatable
): void {
  for (const animation of el.getAnimations()) {
    if (animation.id === TELLOMI_SINGLE_EMOJI_ANIM_NAME) {
      animation.cancel();
    }
  }
}

/** Play (or replay) the pop on `el`. */
export function playTellomiSingleEmojiAnimation(
  el: TellomiSingleEmojiAnimatable
): { id: string; cancel: () => void } {
  cancelTellomiSingleEmojiAnimation(el);
  return el.animate(
    tellomiSingleEmojiAnimFrames(),
    tellomiSingleEmojiAnimTiming()
  );
}
