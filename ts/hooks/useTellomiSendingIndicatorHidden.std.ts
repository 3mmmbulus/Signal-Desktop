// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useState } from 'react';
import type { MessageStatusType } from '../types/message/MessageStatus.std.ts';
import { tellomiSendingIndicatorDelay } from '../util/tellomiMessageStatus.std.ts';

/**
 * Tellomi (M7 §3.2): whether the sending spinner of a text-only message is still held back. It
 * keeps its place (drawn invisible) and shows 2 seconds after the message was sent; a message
 * the server takes within those 2 seconds goes straight from the time alone to one tick.
 */
export function useTellomiSendingIndicatorHidden({
  status,
  isTextOnly,
  sentAt,
}: Readonly<{
  status: MessageStatusType | undefined;
  isTextOnly: boolean;
  sentAt: number | undefined;
}>): boolean {
  const [, setRevealed] = useState(0);
  const delay = tellomiSendingIndicatorDelay({
    status,
    isTextOnly,
    sentAt,
    // oxlint-disable-next-line react/purity
    now: Date.now(),
  });

  useEffect(() => {
    if (delay <= 0) {
      return undefined;
    }
    const timer = setTimeout(() => setRevealed(n => n + 1), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return delay > 0;
}
