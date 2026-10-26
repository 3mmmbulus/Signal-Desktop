// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { getMidnight } from '../types/NotificationProfile.std.ts';

/**
 * Tellomi (desktop audit 7.2): local-midnight helpers for jump-to-date.
 * A day is identified by the local calendar date of the message timestamp
 * (same basis as TimelineDateHeader / isSameDay).
 */
export function startOfLocalDayMs(timestamp: number): number {
  return getMidnight(timestamp);
}

/**
 * Pick the SQL lower bound for "first message on or after this day":
 * local midnight of the chosen calendar day.
 */
export function jumpLowerBoundMs(dayTimestamp: number): number {
  return startOfLocalDayMs(dayTimestamp);
}

/**
 * Tellomi (desktop audit 7.2 r2): fold message timestamps into a Set of local
 * midnights for days that have messages (iOS TellomiConversationDays).
 */
export function buildDaysWithMessagesSet(
  timestamps: ReadonlyArray<number>
): Set<number> {
  const out = new Set<number>();
  for (const ts of timestamps) {
    out.add(startOfLocalDayMs(ts));
  }
  return out;
}

/** True when the local day of [dayTimestamp] has at least one message. */
export function isJumpDayAvailable(
  dayTimestamp: number,
  daysWithMessages: ReadonlySet<number>
): boolean {
  return daysWithMessages.has(startOfLocalDayMs(dayTimestamp));
}
