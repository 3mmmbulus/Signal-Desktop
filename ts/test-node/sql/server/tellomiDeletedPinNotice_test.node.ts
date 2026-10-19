// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { cwd } from 'node:process';

import type { WritableDB } from '../../../sql/Interface.std.ts';
import { DataReader, setupTests } from '../../../sql/Server.node.ts';
import { ReadStatus } from '../../../messages/MessageReadStatus.std.ts';
import { SeenStatus } from '../../../MessageSeenStatus.std.ts';
import { getTellomiPinNoticeDeletedProps } from '../../../util/tellomiPinNoticeActions.std.ts';
import { createDB, insertData } from '../helpers.node.ts';

// ADR-0081 §九 P5 (erel 2026-10-19, after how Telegram behaves): a pin's chat event deleted for everyone is gone from
// the chat — the chat list shows the last message before it, and it no longer counts as unread.
describe('Tellomi: a pin notice deleted for everyone (sql)', () => {
  let db: WritableDB;

  beforeEach(() => {
    db = createDB();
    setupTests(db, { userDataPath: cwd() });
    insertData(db, 'conversations', [{ id: 'c1' }]);
  });

  afterEach(() => {
    db.close();
  });

  function message(
    id: string,
    receivedAt: number,
    attributes: Record<string, unknown>
  ) {
    const json = {
      id,
      conversationId: 'c1',
      received_at: receivedAt,
      sent_at: receivedAt,
      timestamp: receivedAt,
      ...attributes,
    };
    insertData(db, 'messages', [
      {
        id,
        conversationId: 'c1',
        type: String(attributes.type),
        received_at: receivedAt,
        sent_at: receivedAt,
        readStatus:
          (attributes.readStatus as number | undefined) ?? ReadStatus.Read,
        seenStatus:
          (attributes.seenStatus as number | undefined) ??
          SeenStatus.NotApplicable,
        json,
      },
    ]);
  }

  function stats() {
    return DataReader.getConversationMessageStats(db, {
      conversationId: 'c1',
      includeStoryReplies: true,
    });
  }

  it('the chat list skips it and shows the message before it', () => {
    message('before', 1, { type: 'incoming', body: 'hello' });
    message('pin', 2, {
      type: 'pinned-message-notification',
      deletedForEveryone: true,
    });
    assert.strictEqual(stats().preview?.id, 'before');
    assert.strictEqual(stats().activity?.id, 'before');
  });

  it('a pin notice that is not deleted still is the preview, and so is any other deleted message', () => {
    message('before', 1, { type: 'incoming', body: 'hello' });
    message('pin', 2, { type: 'pinned-message-notification' });
    assert.strictEqual(stats().preview?.id, 'pin');
    message('gone', 3, { type: 'incoming', deletedForEveryone: true });
    assert.strictEqual(stats().preview?.id, 'gone', 'upstream placeholder');
  });

  it('no longer counts as unread once deleted', () => {
    const unread = () =>
      DataReader.getTotalUnreadForConversation(db, 'c1', {
        storyId: undefined,
        includeStoryReplies: true,
      });
    message('pin', 1, {
      type: 'pinned-message-notification',
      readStatus: ReadStatus.Unread,
      seenStatus: SeenStatus.Unseen,
    });
    assert.strictEqual(unread(), 1);
    db.prepare('DELETE FROM messages').run();
    message('pin', 1, {
      type: 'pinned-message-notification',
      deletedForEveryone: true,
      readStatus: ReadStatus.Unread,
      seenStatus: SeenStatus.Unseen,
      ...getTellomiPinNoticeDeletedProps({
        type: 'pinned-message-notification',
      }),
    });
    assert.strictEqual(unread(), 0);
  });
});
