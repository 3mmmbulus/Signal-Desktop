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

/** Exclusive end: start of the next local day. */
export function endOfLocalDayMs(timestamp: number): number {
  const start = startOfLocalDayMs(timestamp);
  const next = new Date(start);
  next.setDate(next.getDate() + 1);
  return next.getTime();
}

/**
 * Pick the SQL lower bound for "first message on or after this day":
 * local midnight of the chosen calendar day.
 */
export function jumpLowerBoundMs(dayTimestamp: number): number {
  return startOfLocalDayMs(dayTimestamp);
}
