// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tellomi (audit 4.2): pure decision + keyframes for a short "pop" when a
 * message is exactly one jumbo emoji. Aligns iOS TellomiSingleEmojiAnimation
 * (#380+#385) / Android (#424). Behaviour reference only; no third-party code.
 */

export type TellomiSingleEmojiKeyframe = Readonly<{
  /** Relative time, 0…1. */
  relativeTime: number;
  /** Scale relative to the final size. */
  scale: number;
}>;

/** Total pop duration in milliseconds. */
export const TELLOMI_SINGLE_EMOJI_ANIM_DURATION_MS = 450;

/** Scale keyframes: grow from 0.6, overshoot to 1.15, settle at 1.0. */
export const TELLOMI_SINGLE_EMOJI_ANIM_KEYFRAMES: ReadonlyArray<TellomiSingleEmojiKeyframe> =
  [
    { relativeTime: 0.0, scale: 0.6 },
    { relativeTime: 0.55, scale: 1.15 },
    { relativeTime: 0.8, scale: 0.95 },
    { relativeTime: 1.0, scale: 1.0 },
  ];

export enum TellomiSingleEmojiAnimTrigger {
  /** Message first appears on screen (newly sent or received). */
  Appeared = 'appeared',
  /** User clicked the emoji bubble. */
  Tapped = 'tapped',
}

/**
 * @param jumbomojiCount `Emoji.getJumboEmojiCount(text)`; null if not jumbomoji.
 * @param trigger why the animation would play.
 * @param reduceMotion `prefers-reduced-motion: reduce`.
 * @param alreadyPlayedOnAppear whether the appear animation already ran for this message.
 */
export function tellomiSingleEmojiShouldAnimate(options: {
  jumbomojiCount: number | null | undefined;
  trigger: TellomiSingleEmojiAnimTrigger;
  reduceMotion: boolean;
  alreadyPlayedOnAppear: boolean;
}): boolean {
  const { jumbomojiCount, trigger, reduceMotion, alreadyPlayedOnAppear } =
    options;
  if (jumbomojiCount !== 1) {
    return false;
  }
  if (reduceMotion) {
    return false;
  }
  if (trigger === TellomiSingleEmojiAnimTrigger.Appeared) {
    return !alreadyPlayedOnAppear;
  }
  return true;
}
