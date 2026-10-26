// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tellomi (Telegram desktop audit 3.3 / F12): voice-recording pause/continue clock.
 * Counts only time spent actually recording; paused intervals do not advance.
 * Pure value object — callers pass `nowMs` so unit tests stay deterministic.
 * Behaviour matches iOS/Android TellomiVoicePauseClock (reference only; no code copy).
 */
export type TellomiVoicePauseState =
  | { type: 'idle' }
  | { type: 'recording'; sinceMs: number }
  | { type: 'paused' }
  | { type: 'stopped' };

export class TellomiVoicePauseClock {
  #state: TellomiVoicePauseState = { type: 'idle' };
  /** Accumulated recorded ms from prior segments (excludes the active segment). */
  #accumulatedMs = 0;

  get state(): TellomiVoicePauseState {
    return this.#state;
  }

  get accumulatedMs(): number {
    return this.#accumulatedMs;
  }

  get isRecording(): boolean {
    return this.#state.type === 'recording';
  }

  get isPaused(): boolean {
    return this.#state.type === 'paused';
  }

  /** Start recording (only from idle). */
  start(nowMs: number): boolean {
    if (this.#state.type !== 'idle') {
      return false;
    }
    this.#state = { type: 'recording', sinceMs: nowMs };
    return true;
  }

  /** Pause (only while recording). */
  pause(nowMs: number): boolean {
    if (this.#state.type !== 'recording') {
      return false;
    }
    this.#accumulatedMs += Math.max(0, nowMs - this.#state.sinceMs);
    this.#state = { type: 'paused' };
    return true;
  }

  /** Resume (only while paused). */
  resume(nowMs: number): boolean {
    if (this.#state.type !== 'paused') {
      return false;
    }
    this.#state = { type: 'recording', sinceMs: nowMs };
    return true;
  }

  /** Stop; returns total elapsed ms, or undefined if idle/already stopped. */
  stop(nowMs: number): number | undefined {
    if (this.#state.type === 'idle' || this.#state.type === 'stopped') {
      return undefined;
    }
    const total = this.elapsed(nowMs);
    this.#accumulatedMs = total;
    this.#state = { type: 'stopped' };
    return total;
  }

  /** Effective recorded duration up to nowMs. */
  elapsed(nowMs: number): number {
    if (this.#state.type === 'recording') {
      return this.#accumulatedMs + Math.max(0, nowMs - this.#state.sinceMs);
    }
    return this.#accumulatedMs;
  }

  /** Drop state back to idle (cancel / reuse). */
  forceReset(): void {
    this.#state = { type: 'idle' };
    this.#accumulatedMs = 0;
  }

  /** Reset and immediately start a fresh take. */
  forceResetAndStart(nowMs: number): void {
    this.forceReset();
    this.start(nowMs);
  }
}
