// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useEffect, useState, type JSX } from 'react';
import { useEscapeHandling } from '../hooks/useEscapeHandling.dom.ts';
import type {
  HideToastAction,
  ShowToastAction,
} from '../state/ducks/toast.preload.ts';
import type { PeakType } from '../types/Audio.dom.tsx';
import { ErrorDialogAudioRecorderType } from '../types/AudioRecorder.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import type { AnyToast } from '../types/Toast.dom.tsx';
import { ToastType } from '../types/Toast.dom.tsx';
import { DurationInSeconds, SECOND } from '../util/durations/index.std.ts';
import { tw } from '../axo/tw.dom.tsx';
import { durationToPlaybackText } from '../util/durationToPlaybackText.std.ts';
import { RecordingComposer } from './RecordingComposer.dom.tsx';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';
import { AxoIconButton } from '../axo/AxoIconButton.dom.tsx';
import {
  tellomiVoicePauseAction,
  tellomiVoicePauseLabelKey,
  tellomiVoicePauseSymbol,
} from '../util/tellomiVoicePauseUI.std.ts';

export type Props = Readonly<{
  i18n: LocalizerType;
  onCancel: () => void;
  onSend: () => void;
  errorRecording: (e: ErrorDialogAudioRecorderType) => unknown;
  errorDialogAudioRecorderType?: ErrorDialogAudioRecorderType;
  peaks: ReadonlyArray<PeakType>;
  saveDraftRecordingIfNeeded: () => void;
  showToast: ShowToastAction;
  hideToast: HideToastAction;
  /** Tellomi (audit 3.3): mid-take pause state. */
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  /** Tellomi: effective elapsed ms (paused intervals excluded). */
  getElapsedMs: () => number;
}>;

export function CompositionRecording({
  i18n,
  onCancel,
  onSend,
  errorRecording,
  errorDialogAudioRecorderType,
  peaks,
  saveDraftRecordingIfNeeded,
  showToast,
  hideToast,
  isPaused,
  onPause,
  onResume,
  getElapsedMs,
}: Props): JSX.Element {
  useEscapeHandling(onCancel);

  // switched to another app
  useEffect(() => {
    window.addEventListener('blur', saveDraftRecordingIfNeeded);
    return () => {
      window.removeEventListener('blur', saveDraftRecordingIfNeeded);
    };
  }, [saveDraftRecordingIfNeeded]);

  useEffect(() => {
    const toast: AnyToast = { toastType: ToastType.VoiceNoteLimit };
    showToast(toast);

    return () => hideToast(toast);
  }, [showToast, hideToast]);

  const [duration, setDuration] = useState(() => getElapsedMs() / SECOND);
  const [drift, setDrift] = useState(0);

  // Tellomi (audit 3.3): tick only while actively recording; freeze while paused.
  useEffect(() => {
    if (isPaused) {
      // Do not sync setDuration here (oxlint set-state-in-effect); last tick already froze it.
      return;
    }

    const timeoutId = setTimeout(() => {
      const newDurationMs = getElapsedMs();
      setDrift(newDurationMs % SECOND);
      setDuration(newDurationMs / SECOND);

      if (
        DurationInSeconds.fromMillis(newDurationMs) >= DurationInSeconds.HOUR
      ) {
        errorRecording(ErrorDialogAudioRecorderType.Timeout);
      }
    }, SECOND - drift);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
    duration,
    drift,
    errorRecording,
    getElapsedMs,
    isPaused,
  ]);

  const handleTogglePause = useCallback(() => {
    if (tellomiVoicePauseAction(isPaused) === 'resume') {
      onResume();
    } else {
      onPause();
    }
  }, [isPaused, onPause, onResume]);

  let confirmationDialog: JSX.Element | undefined;
  if (errorDialogAudioRecorderType === ErrorDialogAudioRecorderType.Timeout) {
    confirmationDialog = (
      <AxoConfirmDialog.Root
        open
        onOpenChange={onCancel}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:voiceRecordingInterruptedMax')}
      >
        <AxoConfirmDialog.Cancel>{i18n('icu:discard')}</AxoConfirmDialog.Cancel>
        <AxoConfirmDialog.Action variant="strong-primary" onClick={onSend}>
          {i18n('icu:sendAnyway')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    );
  } else if (
    errorDialogAudioRecorderType === ErrorDialogAudioRecorderType.ErrorRecording
  ) {
    confirmationDialog = (
      <AxoConfirmDialog.Root
        open
        onOpenChange={onCancel}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n('icu:voiceNoteError')}
      >
        <AxoConfirmDialog.Cancel>{i18n('icu:ok')}</AxoConfirmDialog.Cancel>
      </AxoConfirmDialog.Root>
    );
  }

  const pauseLabel = i18n(tellomiVoicePauseLabelKey(isPaused));

  return (
    <RecordingComposer i18n={i18n} onCancel={onCancel} onSend={onSend}>
      <div
        className={
          isPaused
            ? 'CompositionRecording__microphone CompositionRecording__microphone--paused'
            : 'CompositionRecording__microphone'
        }
      />
      <div className="CompositionRecording__timer">
        {durationToPlaybackText(duration)}
      </div>
      <AxoIconButton.Root
        variant="implied-secondary"
        size="sm"
        symbol={tellomiVoicePauseSymbol(isPaused)}
        label={pauseLabel}
        tooltip={false}
        onClick={handleTogglePause}
      />
      <div
        className={tw(
          'shrink-0 grow overflow-hidden',
          'flex flex-row-reverse items-center gap-0.5',
          'bg-surface-message-incoming',
          'h-full basis-0 rounded-sm'
        )}
      >
        {peaks.toReversed().map(({ value, index }) => {
          return (
            <b
              key={index}
              style={{ height: `${value * 100}%` }}
              className={tw(
                'rounded-sm bg-(--axo-color-label-placeholder) p-px'
              )}
            />
          );
        })}
      </div>

      {confirmationDialog}
    </RecordingComposer>
  );
}
