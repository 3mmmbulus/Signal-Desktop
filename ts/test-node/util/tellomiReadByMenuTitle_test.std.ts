// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { SendStatus } from '../../messages/MessageSendState.std.ts';
import {
  tellomiReadByCounts,
  tellomiReadByMenuCounts,
} from '../../util/tellomiReadByMenuTitle.std.ts';

describe('tellomiReadByMenuTitle (desktop audit 1.3)', () => {
  describe('tellomiReadByCounts', () => {
    it('counts read and viewed, skips skipped, includes failed in total', () => {
      assert.deepEqual(
        tellomiReadByCounts([
          SendStatus.Read,
          SendStatus.Viewed,
          SendStatus.Delivered,
          SendStatus.Sent,
          SendStatus.Skipped,
          SendStatus.Failed,
        ]),
        { read: 2, total: 5 }
      );
    });

    it('counts none read', () => {
      assert.deepEqual(
        tellomiReadByCounts([
          SendStatus.Pending,
          SendStatus.Sent,
          SendStatus.Delivered,
        ]),
        { read: 0, total: 3 }
      );
    });

    it('only skipped gives total 0', () => {
      assert.deepEqual(
        tellomiReadByCounts([SendStatus.Skipped, SendStatus.Skipped]),
        { read: 0, total: 0 }
      );
    });
  });

  describe('tellomiReadByMenuCounts', () => {
    const sendStateByConversationId = {
      a: { status: SendStatus.Read as const },
      b: { status: SendStatus.Delivered as const },
      c: { status: SendStatus.Skipped as const },
      me: { status: SendStatus.Sent as const },
    };

    it('returns read/total for outgoing group with receipts on', () => {
      assert.deepEqual(
        tellomiReadByMenuCounts({
          isGroup: true,
          isOutgoing: true,
          readReceiptsEnabled: true,
          sendStateByConversationId,
          ourConversationId: 'me',
        }),
        { read: 1, total: 2 }
      );
    });

    it('returns undefined for direct chats, incoming, empty, or only-self', () => {
      assert.isUndefined(
        tellomiReadByMenuCounts({
          isGroup: false,
          isOutgoing: true,
          readReceiptsEnabled: true,
          sendStateByConversationId,
          ourConversationId: 'me',
        })
      );
      assert.isUndefined(
        tellomiReadByMenuCounts({
          isGroup: true,
          isOutgoing: false,
          readReceiptsEnabled: true,
          sendStateByConversationId,
          ourConversationId: 'me',
        })
      );
      assert.isUndefined(
        tellomiReadByMenuCounts({
          isGroup: true,
          isOutgoing: true,
          readReceiptsEnabled: true,
          sendStateByConversationId: undefined,
          ourConversationId: 'me',
        })
      );
      assert.isUndefined(
        tellomiReadByMenuCounts({
          isGroup: true,
          isOutgoing: true,
          readReceiptsEnabled: true,
          sendStateByConversationId: {
            me: { status: SendStatus.Sent },
          },
          ourConversationId: 'me',
        })
      );
    });

    /** M7: own read receipts off → keep Info (undefined). */
    it('returns undefined when read receipts are disabled', () => {
      assert.isUndefined(
        tellomiReadByMenuCounts({
          isGroup: true,
          isOutgoing: true,
          readReceiptsEnabled: false,
          sendStateByConversationId,
          ourConversationId: 'me',
        })
      );
    });
  });
});
