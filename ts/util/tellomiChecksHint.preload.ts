// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { itemStorage } from '../textsecure/Storage.preload.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import { tellomiShouldShowChecksHint } from './tellomiMessageStatus.std.ts';
import {
  tellomiAddChecksHintCandidate,
  tellomiClearChecksHintCandidates,
  tellomiRemoveChecksHintCandidate,
  tellomiSetChecksHintHandler,
} from './tellomiChecksHintCandidates.std.ts';

const STORAGE_KEY = 'tellomi-checks-hint-shown';
let shownThisSession = false;

function alreadyShown(): boolean {
  return shownThisSession || itemStorage.get(STORAGE_KEY, false);
}

/**
 * Tellomi (M7 §3.1, tellomi/tellomi#1186, PM 2026-10-25): before sending, note a message that may
 * explain the ticks. The tip itself shows only when that message turns sent (one tick or straight
 * to two) while its bubble is on screen; see MessageMetadata. Once per device.
 */
export function noteTellomiChecksHintCandidate(
  messageId: string,
  options: Readonly<{
    isNoteToSelf: boolean;
    isEdit: boolean;
    isStoryReply: boolean;
  }>
): void {
  if (
    !tellomiShouldShowChecksHint({ alreadyShown: alreadyShown(), ...options })
  ) {
    // An edit re-sends an existing message: it must not count as that message's first send
    tellomiRemoveChecksHintCandidate(messageId);
    return;
  }
  tellomiAddChecksHintCandidate(messageId);
}

tellomiSetChecksHintHandler(() => {
  if (alreadyShown()) {
    tellomiClearChecksHintCandidates();
    return;
  }
  shownThisSession = true;
  tellomiClearChecksHintCandidates();
  void itemStorage.put(STORAGE_KEY, true);
  window.reduxActions?.toast?.showToast({
    toastType: ToastType.TellomiChecksHint,
  });
});
