// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

// Tellomi (M7, tellomi/tellomi#1185; spec docs/product/specs/message-status-and-read-receipts.md):
// one tick = the server has it, two ticks = read. "Delivered" is no longer drawn on the bubble or
// in the chat list (its time stays in the message details), read / viewed is hidden while our own
// read receipts are off (including reads that arrived before they were turned off), a text-only
// message waits 2 seconds before its sending spinner shows, and a message that arrived while read
// receipts were off never gets a read / viewed receipt. Display and receipt filtering only: no
// protocol, server or schema change. Same rules as Signal-iOS #358 / #359 and Signal-Android #411.

import type { MessageStatusType } from '../types/message/MessageStatus.std.ts';

export const TELLOMI_SENDING_INDICATOR_DELAY_MS = 2000;

/** The status the bubble and the chat list draw for a status computed the Signal way. */
export function tellomiDisplayStatus<T extends MessageStatusType | undefined>(
  status: T,
  readReceiptsEnabled: boolean
): T | 'sent' {
  if (status === 'delivered') {
    return 'sent';
  }
  if (!readReceiptsEnabled && (status === 'read' || status === 'viewed')) {
    return 'sent';
  }
  return status;
}

/**
 * When the sending spinner of a text-only message may show: 2 seconds after it was sent. If the
 * clock was set back (sent "in the future"), it waits at most 2 seconds from now.
 */
export function tellomiSendingIndicatorRevealTimestamp(
  sentAt: number,
  now: number
): number {
  return Math.min(sentAt, now) + TELLOMI_SENDING_INDICATOR_DELAY_MS;
}

/** How long, from `now`, the spinner stays hidden; 0 when it shows right away. */
export function tellomiSendingIndicatorDelay({
  status,
  isTextOnly,
  sentAt,
  now,
}: Readonly<{
  status: MessageStatusType | undefined;
  isTextOnly: boolean;
  sentAt: number | undefined;
  now: number;
}>): number {
  if (status !== 'sending' || !isTextOnly || sentAt == null) {
    return 0;
  }
  return Math.max(0, tellomiSendingIndicatorRevealTimestamp(sentAt, now) - now);
}

/**
 * "Text" is a message without a real attachment: plain text, a quoted reply, text with a link
 * preview and a long text (sent as a body attachment) all count as text. Stickers and any file,
 * image, video or voice attachment do not (spec §3.2).
 */
export function tellomiIsTextOnlyMessage(
  message: Readonly<{
    attachments?: ReadonlyArray<unknown> | null;
    sticker?: unknown;
  }>
): boolean {
  return !message.attachments?.length && message.sticker == null;
}

// --- Read receipts by arrival time (spec §3.4 rule 3) ---

export type TellomiReadReceiptChange = Readonly<{
  changedAt: number;
  enabled: boolean;
}>;

export const TELLOMI_READ_RECEIPT_HISTORY_LIMIT = 64;

/**
 * The history after the read receipt setting is written, or undefined when nothing is recorded:
 * the first write (no previous value) and a write that does not change the value are not
 * switches. Only the latest 64 switches are kept.
 */
export function tellomiNextReadReceiptHistory(
  history: ReadonlyArray<TellomiReadReceiptChange> | undefined,
  previous: boolean | undefined,
  next: boolean,
  now: number
): ReadonlyArray<TellomiReadReceiptChange> | undefined {
  if (previous === undefined || previous === next) {
    return undefined;
  }
  const all = [...(history ?? []), { changedAt: now, enabled: next }];
  return all.slice(-TELLOMI_READ_RECEIPT_HISTORY_LIMIT);
}

/**
 * Whether read receipts were on when a message arrived. Anything uncertain counts as off ("rather
 * not send"): with no history, the current setting; before the oldest switch kept, the opposite of
 * it, unless older switches were dropped. Takes the last switch not later than the arrival by time,
 * so a clock set back does not mix it up.
 */
export function tellomiWereReadReceiptsEnabledAt(
  history: ReadonlyArray<TellomiReadReceiptChange> | undefined,
  currentlyEnabled: boolean,
  receivedAt: number | undefined
): boolean {
  if (!history?.length) {
    return currentlyEnabled;
  }
  if (receivedAt == null) {
    return false;
  }
  let best: TellomiReadReceiptChange | undefined;
  let oldest: TellomiReadReceiptChange | undefined;
  for (const change of history) {
    if (oldest == null || change.changedAt < oldest.changedAt) {
      oldest = change;
    }
    if (
      change.changedAt <= receivedAt &&
      (best == null || change.changedAt >= best.changedAt)
    ) {
      best = change;
    }
  }
  if (best) {
    return best.enabled;
  }
  if (history.length >= TELLOMI_READ_RECEIPT_HISTORY_LIMIT) {
    return false;
  }
  return oldest ? !oldest.enabled : currentlyEnabled;
}

/**
 * Tellomi (M7 §3.1, tellomi/tellomi#1186): which status change animates while a bubble or a chat
 * list row stays on screen. One tick fades in when the server takes the message; the second
 * tick grows when it is read. Nothing animates when a message is first drawn (opening a chat,
 * scrolling back), so only a change seen live moves.
 */
export type TellomiStatusAnimation = 'sent' | 'read';

export function tellomiStatusAnimation(
  previous: MessageStatusType | undefined,
  next: MessageStatusType | undefined
): TellomiStatusAnimation | undefined {
  if (previous === next || previous == null || next == null) {
    return undefined;
  }
  const wasPending = previous === 'sending' || previous === 'paused';
  if (next === 'sent' && wasPending) {
    return 'sent';
  }
  if (
    (next === 'read' || next === 'viewed') &&
    (wasPending ||
      previous === 'sent' ||
      previous === 'delivered' ||
      previous === 'partial-sent')
  ) {
    return 'read';
  }
  return undefined;
}

/**
 * Tellomi (M7 §3.1, tellomi/tellomi#1186): the one-time tip after the first message this device
 * sends ("one tick: sent; two ticks: read"). Not for Note to Self, edits or story replies, where
 * the ticks do not mean the same.
 */
export function tellomiShouldShowChecksHint({
  alreadyShown,
  isNoteToSelf,
  isEdit,
  isStoryReply,
}: Readonly<{
  alreadyShown: boolean;
  isNoteToSelf: boolean;
  isEdit: boolean;
  isStoryReply: boolean;
}>): boolean {
  return !alreadyShown && !isNoteToSelf && !isEdit && !isStoryReply;
}
