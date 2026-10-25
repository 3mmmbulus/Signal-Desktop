// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tellomi (M7 §3.1, tellomi/tellomi#1186, PM 2026-10-25): messages that may trigger the one-time
 * tip about the ticks. The send job adds a message before sending it, only when it is not Note
 * to Self, an edit or a story reply; the bubble reports when it sees that message turn sent on
 * screen. Kept in memory only: a message sent off screen just never triggers the tip.
 */
const MAX_CANDIDATES = 100;
const candidates = new Set<string>();
let onSeen: ((messageId: string) => void) | undefined;

export function tellomiAddChecksHintCandidate(messageId: string): void {
  candidates.delete(messageId);
  candidates.add(messageId);
  while (candidates.size > MAX_CANDIDATES) {
    const oldest = candidates.values().next().value;
    if (oldest == null) {
      break;
    }
    candidates.delete(oldest);
  }
}

export function tellomiRemoveChecksHintCandidate(messageId: string): void {
  candidates.delete(messageId);
}

export function tellomiClearChecksHintCandidates(): void {
  candidates.clear();
}

export function tellomiSetChecksHintHandler(
  handler: ((messageId: string) => void) | undefined
): void {
  onSeen = handler;
}

/** Called by the bubble when it sees `messageId` first turn sent while on screen. */
export function tellomiChecksHintFirstSentSeen(messageId: string): boolean {
  if (!candidates.has(messageId)) {
    return false;
  }
  candidates.delete(messageId);
  onSeen?.(messageId);
  return true;
}
