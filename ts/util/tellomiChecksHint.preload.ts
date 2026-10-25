// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { itemStorage } from '../textsecure/Storage.preload.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import { tellomiShouldShowChecksHint } from './tellomiMessageStatus.std.ts';

const STORAGE_KEY = 'tellomi-checks-hint-shown';
let shownThisSession = false;

/**
 * Tellomi (M7 §3.1, tellomi/tellomi#1186): after the first message this device sends, tell once
 * what the ticks mean. Remembered on this device; never shown again after that.
 */
export async function maybeShowTellomiChecksHint(
  options: Readonly<{
    isNoteToSelf: boolean;
    isEdit: boolean;
    isStoryReply: boolean;
  }>
): Promise<void> {
  const alreadyShown = shownThisSession || itemStorage.get(STORAGE_KEY, false);
  if (!tellomiShouldShowChecksHint({ alreadyShown, ...options })) {
    return;
  }
  shownThisSession = true;
  await itemStorage.put(STORAGE_KEY, true);
  window.reduxActions?.toast?.showToast({
    toastType: ToastType.TellomiChecksHint,
  });
}
