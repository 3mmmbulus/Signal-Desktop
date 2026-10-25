// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';
import type { MessageStatusType } from '../types/message/MessageStatus.std.ts';
import { tellomiIsFirstSentTransition } from '../util/tellomiMessageStatus.std.ts';
import { tellomiChecksHintFirstSentSeen } from '../util/tellomiChecksHintCandidates.std.ts';

function isOnScreen(element: HTMLElement | null): boolean {
  if (element == null || document.visibilityState !== 'visible') {
    return false;
  }
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    return false;
  }
  const scroller = element.closest('.module-timeline__messages');
  const bounds = scroller
    ? scroller.getBoundingClientRect()
    : { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };
  return (
    rect.bottom > bounds.top &&
    rect.top < bounds.bottom &&
    rect.right > bounds.left &&
    rect.left < bounds.right
  );
}

/**
 * Tellomi (M7 §3.1, tellomi/tellomi#1186, PM 2026-10-25): report when our own message turns sent
 * (one tick or straight to two) while its bubble stays mounted and is on screen. A bubble that is
 * first drawn already sent (opening a chat, scrolling back) never reports.
 */
export function useTellomiChecksHintTrigger(
  messageId: string,
  status: MessageStatusType | undefined,
  isOutgoing: boolean,
  elementRef: RefObject<HTMLElement | null>
): void {
  const previous = useRef(status);
  useEffect(() => {
    const before = previous.current;
    previous.current = status;
    if (
      isOutgoing &&
      tellomiIsFirstSentTransition(before, status) &&
      isOnScreen(elementRef.current)
    ) {
      tellomiChecksHintFirstSentSeen(messageId);
    }
  }, [messageId, status, isOutgoing, elementRef]);
}
