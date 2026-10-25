// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { DataWriter } from '../sql/Client.preload.ts';
import { readSyncJobQueue } from '../jobs/readSyncJobQueue.preload.ts';
import { createLogger } from '../logging/log.std.ts';
import { drop } from './drop.std.ts';
import type { ReactionResultType } from '../sql/Interface.std.ts';

const log = createLogger('markReactionsReadForMessages');

// Tellomi (desktop audit 6.2 r2): Telegram-style reaction read. A reaction is
// read only once the message it is on has actually been on screen. Only reaction
// read state (and its read sync to our own linked devices) is touched here;
// message read status and read receipts to the sender are never sent from here.
export async function markReactionsReadForMessages(
  conversationId: string,
  messageIds: ReadonlyArray<string>
): Promise<Array<ReactionResultType>> {
  if (!messageIds.length) {
    return [];
  }

  const readReactions =
    await DataWriter.getUnreadReactionsForMessagesAndMarkRead({
      conversationId,
      messageIds,
    });
  if (!readReactions.length) {
    return readReactions;
  }

  const readSyncs = new Map<
    string,
    {
      messageId: string;
      senderAci: ReactionResultType['targetAuthorAci'];
      timestamp: number;
    }
  >();
  for (const reaction of readReactions) {
    const key = `${reaction.targetAuthorAci}/${reaction.targetTimestamp}`;
    if (!readSyncs.has(key)) {
      readSyncs.set(key, {
        messageId: reaction.messageId,
        senderAci: reaction.targetAuthorAci,
        timestamp: reaction.targetTimestamp,
      });
    }
  }

  log.info(
    `${conversationId}: ${readReactions.length} reactions read on ` +
      `${readSyncs.size} visible messages`
  );

  if (window.ConversationController.doWeHaveOtherDevices()) {
    drop(readSyncJobQueue.add({ readSyncs: [...readSyncs.values()] }));
  }

  window.ConversationController.get(conversationId)?.throttledUpdateUnread();

  return readReactions;
}
