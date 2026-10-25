// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { createContext, useContext } from 'react';

/**
 * Tellomi (desktop audit 7.2): click handlers for timeline date headers.
 * - isFloating true (stuck header): jump straight to that day's first message
 * - isFloating false (inline header): open the jump-to-date calendar dialog
 */
export type TellomiJumpToDateContextType = Readonly<{
  onTapDateHeader: (timestamp: number, isFloating: boolean) => void;
}>;

export const TellomiJumpToDateContext =
  createContext<TellomiJumpToDateContextType | null>(null);

export function useTellomiJumpToDate(): TellomiJumpToDateContextType | null {
  return useContext(TellomiJumpToDateContext);
}
