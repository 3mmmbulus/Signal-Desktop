// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Tellomi (desktop audit 1.3 / F19): right-click own group message — Info menu item
 * shows 「已读 N/M」 / Read N/M, still opens message details. Aligns Android #425 /
 * iOS #377 (`TellomiReadByMenuTitle`). Local receipts only; no protocol change.
 * M7: when our own read receipts are off, return undefined → keep Info.
 */

import {
  SendStatus,
  type SendStateByConversationId,
} from '../messages/MessageSendState.std.ts';

export type TellomiReadByCounts = Readonly<{
  read: number;
  total: number;
}>;

/**
 * Count real recipients: skip Skipped; Read and Viewed both count as read.
 * Failed is included in total (same as Android / iOS).
 */
export function tellomiReadByCounts(
  statuses: Iterable<SendStatus>
): TellomiReadByCounts {
  let read = 0;
  let total = 0;
  for (const status of statuses) {
    if (status === SendStatus.Skipped) {
      continue;
    }
    total += 1;
    if (status === SendStatus.Read || status === SendStatus.Viewed) {
      read += 1;
    }
  }
  return { read, total };
}

/**
 * Counts for the context-menu Info label, or undefined to keep 「Info」.
 * Excludes ourConversationId from recipients (MessageDetail does the same for groups).
 */
export function tellomiReadByMenuCounts({
  isGroup,
  isOutgoing,
  readReceiptsEnabled,
  sendStateByConversationId,
  ourConversationId,
}: Readonly<{
  isGroup: boolean;
  isOutgoing: boolean;
  readReceiptsEnabled: boolean;
  sendStateByConversationId: SendStateByConversationId | undefined;
  ourConversationId: string | undefined;
}>): TellomiReadByCounts | undefined {
  if (!isGroup || !isOutgoing || !readReceiptsEnabled) {
    return undefined;
  }
  if (!sendStateByConversationId) {
    return undefined;
  }

  const statuses: Array<SendStatus> = [];
  for (const [id, state] of Object.entries(sendStateByConversationId)) {
    if (ourConversationId != null && id === ourConversationId) {
      continue;
    }
    statuses.push(state.status);
  }

  const counts = tellomiReadByCounts(statuses);
  if (counts.total <= 0) {
    return undefined;
  }
  return counts;
}
