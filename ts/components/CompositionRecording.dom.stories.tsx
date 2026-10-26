// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';
import { action } from '@storybook/addon-actions';
import type { Meta } from '@storybook/react';
import type { PeakType } from '../types/Audio.dom.tsx';
import type { Props } from './CompositionRecording.dom.tsx';
import { CompositionRecording } from './CompositionRecording.dom.tsx';

const { i18n } = window.SignalContext;

export default {
  title: 'components/CompositionRecording',
  component: CompositionRecording,
} satisfies Meta<Props>;

const PEAKS = new Array<PeakType>();
for (let i = 0; i < 200; i += 1) {
  PEAKS.push({
    value: (i / 50) % 1,
    index: i,
  });
}

const startedAt = Date.now();
function fakeElapsedMs(): number {
  return Date.now() - startedAt;
}

function sharedProps(
  overrides: Partial<Props> = {}
): Omit<Props, 'onCancel' | 'onSend'> {
  return {
    i18n,
    errorRecording: _ => action('error')(),
    saveDraftRecordingIfNeeded: action('saveDraftRecordingIfNeeded'),
    showToast: action('showToast'),
    hideToast: action('hideToast'),
    peaks: PEAKS,
    isPaused: false,
    onPause: action('onPause'),
    onResume: action('onResume'),
    getElapsedMs: fakeElapsedMs,
    ...overrides,
  };
}

export function Default(): JSX.Element {
  const [active, setActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const cancel = action('cancel');
  const send = action('send');

  const handleActivate = () => {
    setActive(true);
    setIsPaused(false);
  };

  const handleCancel = () => {
    cancel();
    setActive(false);
  };
  const handleSend = () => {
    send();
    setActive(false);
  };

  return (
    <>
      {!active && (
        <button type="button" onClick={handleActivate}>
          Activate
        </button>
      )}
      {active && (
        <CompositionRecording
          {...sharedProps({ isPaused })}
          onCancel={handleCancel}
          onSend={handleSend}
          onPause={() => setIsPaused(true)}
          onResume={() => setIsPaused(false)}
        />
      )}
    </>
  );
}

export function Visible(): JSX.Element {
  return (
    <CompositionRecording
      {...sharedProps()}
      onCancel={action('cancel')}
      onSend={action('send')}
    />
  );
}

export function Paused(): JSX.Element {
  return (
    <CompositionRecording
      {...sharedProps({ isPaused: true, getElapsedMs: () => 12_500 })}
      onCancel={action('cancel')}
      onSend={action('send')}
    />
  );
}
