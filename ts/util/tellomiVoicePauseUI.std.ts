// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tellomi (Telegram desktop audit 3.3 / F12): pause/resume control helpers.
 * Pure UI decision helpers — icon symbol, i18n key, and toggle action.
 * Behaviour matches iOS/Android TellomiVoicePauseUI (reference only).
 */

export type TellomiVoicePauseAction = 'pause' | 'resume';

export type TellomiVoicePauseSymbol = 'pause-fill' | 'play-fill';

export type TellomiVoicePauseI18nKey =
  | 'icu:TellomiVoicePause__pause_recording'
  | 'icu:TellomiVoicePause__resume_recording';

export function tellomiVoicePauseAction(
  isPaused: boolean
): TellomiVoicePauseAction {
  return isPaused ? 'resume' : 'pause';
}

export function tellomiVoicePauseSymbol(
  isPaused: boolean
): TellomiVoicePauseSymbol {
  return isPaused ? 'play-fill' : 'pause-fill';
}

export function tellomiVoicePauseLabelKey(
  isPaused: boolean
): TellomiVoicePauseI18nKey {
  return isPaused
    ? 'icu:TellomiVoicePause__resume_recording'
    : 'icu:TellomiVoicePause__pause_recording';
}
