// Copyright 2016 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createLogger } from '../logging/log.std.ts';
import { requestMicrophonePermissions } from '../util/requestMicrophonePermissions.dom.ts';
import type { WorkletMessageType } from '../types/AudioRecorder.std.ts';
import * as Bytes from '../Bytes.std.ts';
import { TellomiVoicePauseClock } from '../util/tellomiVoicePauseClock.std.ts';

const log = createLogger('audioRecorder');

let contextPromise: Promise<AudioContext> | undefined;

async function initContext(): Promise<AudioContext> {
  const context = new AudioContext();
  await context.audioWorklet.addModule('bundles/workers/mp3Encoder.js');
  return context;
}

type State = Readonly<
  | {
      type: 'idle';
    }
  | {
      type: 'initializing';
    }
  | {
      type: 'running';
      source: MediaStreamAudioSourceNode;
      promise: Promise<Uint8Array<ArrayBuffer>>;
      worklet: AudioWorkletNode;
    }
>;

export class AudioRecorder {
  #state: State = { type: 'idle' };
  /** Tellomi (audit 3.3): pause clock — only counts actively recording time. */
  readonly #pauseClock = new TellomiVoicePauseClock();
  #paused = false;

  static async warmup(): Promise<void> {
    if (contextPromise == null) {
      contextPromise = initContext();
    }
    await contextPromise;
  }

  isPaused(): boolean {
    return this.#paused;
  }

  /** Effective recorded duration in ms (paused intervals excluded). */
  elapsedMs(nowMs: number = Date.now()): number {
    return this.#pauseClock.elapsed(nowMs);
  }

  /**
   * Tellomi (audit 3.3): pause encoding by disconnecting the mic source from
   * the worklet. Keeps the MediaStream alive so resume can continue the same
   * take. Does not suspend the shared AudioContext.
   */
  pause(): boolean {
    if (this.#state.type !== 'running' || this.#paused) {
      return false;
    }
    this.#state.source.disconnect();
    this.#paused = true;
    return this.#pauseClock.pause(Date.now());
  }

  /** Tellomi (audit 3.3): reconnect mic → worklet and continue the same take. */
  resume(): boolean {
    if (this.#state.type !== 'running' || !this.#paused) {
      return false;
    }
    this.#state.source.connect(this.#state.worklet);
    this.#paused = false;
    return this.#pauseClock.resume(Date.now());
  }

  async start(onPeak: (peak: number) => void): Promise<boolean> {
    if (this.#state.type !== 'idle') {
      throw new Error('Already started');
    }

    this.#state = { type: 'initializing' };
    this.#paused = false;
    this.#pauseClock.forceReset();

    const hasMicrophonePermission = await requestMicrophonePermissions(false);
    if (!hasMicrophonePermission) {
      log.info(
        'Recorder/start: Microphone permission was denied, new audio recording not allowed.'
      );
      this.#state = { type: 'idle' };
      return false;
    }

    // oxlint-disable-next-line typescript/await-thenable
    await window.reduxActions.globalModals.ensureSystemMediaPermissions(
      'microphone',
      'voiceNote'
    );

    // Cache global context so that we don't have to initialize worker twice
    if (contextPromise == null) {
      contextPromise = initContext();
    }
    const context = await contextPromise;

    const worklet = new AudioWorkletNode(context, 'mp3-encoder', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
    });

    const { promise, resolve } =
      Promise.withResolvers<Uint8Array<ArrayBuffer>>();
    const chunks = new Array<Uint8Array<ArrayBuffer>>();
    worklet.port.onmessage = ({ data }: { data: WorkletMessageType }) => {
      if (data.type === 'chunk') {
        chunks.push(data.chunk);
        return;
      }
      if (data.type === 'complete') {
        this.#state = { type: 'idle' };
        this.#paused = false;
        chunks.push(data.finalFrame);

        const result = Bytes.concatenate(chunks);

        // Replace the original placeholder header with the one that has
        // full audio duration (necessary for VBR encoding).
        result.set(data.lametagFrame);

        resolve(result);
        return;
      }
      if (data.type === 'peak') {
        // Tellomi: ignore peaks while paused (defensive — source is disconnected).
        if (!this.#paused) {
          onPeak(data.peak);
        }
        return;
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: { ideal: 1 },
      },
    });

    const source = context.createMediaStreamSource(stream);
    source.connect(worklet);

    this.#state = {
      type: 'running',
      source,
      promise,
      worklet,
    };
    this.#pauseClock.forceResetAndStart(Date.now());

    return true;
  }

  async stop(): Promise<Uint8Array<ArrayBuffer> | undefined> {
    if (this.#state.type !== 'running') {
      return undefined;
    }

    // If paused, reconnect is unnecessary — just stop. Clock still records
    // the accumulated duration for callers that care.
    this.#pauseClock.stop(Date.now());
    this.#paused = false;

    this.#state.worklet.port.postMessage({
      type: 'stop',
    });

    // This terminates microphone access
    this.#state.source.mediaStream.getTracks().forEach(track => track.stop());
    this.#state.source.disconnect();

    return this.#state.promise;
  }
}
