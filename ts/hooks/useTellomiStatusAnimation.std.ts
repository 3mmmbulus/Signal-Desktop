// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { useRef } from 'react';
import type { MessageStatusType } from '../types/message/MessageStatus.std.ts';
import type { TellomiStatusAnimation } from '../util/tellomiMessageStatus.std.ts';
import { tellomiStatusAnimation } from '../util/tellomiMessageStatus.std.ts';

/**
 * Tellomi (M7 §3.1, tellomi/tellomi#1186): the status animation to play, only for a change seen
 * while this bubble / row stays mounted. It sticks until the next change so a re-render does not
 * drop the class halfway through (the CSS animation runs once).
 */
export function useTellomiStatusAnimation(
  status: MessageStatusType | undefined
): TellomiStatusAnimation | undefined {
  const previous = useRef(status);
  const animation = useRef<TellomiStatusAnimation | undefined>(undefined);
  // oxlint-disable-next-line react-hooks/refs
  if (previous.current !== status) {
    // oxlint-disable-next-line react-hooks/refs
    animation.current = tellomiStatusAnimation(previous.current, status);
    // oxlint-disable-next-line react-hooks/refs
    previous.current = status;
  }
  // oxlint-disable-next-line react-hooks/refs
  return animation.current;
}
