// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  TELLOMI_READ_RECEIPT_HISTORY_LIMIT,
  TELLOMI_SENDING_INDICATOR_DELAY_MS,
  tellomiDisplayStatus,
  tellomiIsTextOnlyMessage,
  tellomiNextReadReceiptHistory,
  tellomiSendingIndicatorDelay,
  tellomiSendingIndicatorRevealTimestamp,
  tellomiWereReadReceiptsEnabledAt,
} from '../../util/tellomiMessageStatus.std.ts';
import type { TellomiReadReceiptChange } from '../../util/tellomiMessageStatus.std.ts';

describe('tellomiMessageStatus (M7)', () => {
  describe('tellomiDisplayStatus', () => {
    it('folds delivered into one tick and keeps read as two ticks', () => {
      assert.strictEqual(tellomiDisplayStatus('delivered', true), 'sent');
      assert.strictEqual(tellomiDisplayStatus('sent', true), 'sent');
      assert.strictEqual(tellomiDisplayStatus('read', true), 'read');
      assert.strictEqual(tellomiDisplayStatus('viewed', true), 'viewed');
      assert.strictEqual(tellomiDisplayStatus('sending', true), 'sending');
      assert.strictEqual(tellomiDisplayStatus('error', false), 'error');
      assert.isUndefined(tellomiDisplayStatus(undefined, false));
    });

    it('hides read and viewed while our read receipts are off, and restores them', () => {
      assert.strictEqual(tellomiDisplayStatus('read', false), 'sent');
      assert.strictEqual(tellomiDisplayStatus('viewed', false), 'sent');
      assert.strictEqual(tellomiDisplayStatus('delivered', false), 'sent');
      assert.strictEqual(tellomiDisplayStatus('read', true), 'read');
    });
  });

  describe('sending indicator delay', () => {
    const sentAt = 1_000_000;

    it('holds a text-only spinner for 2 seconds after sending', () => {
      assert.strictEqual(TELLOMI_SENDING_INDICATOR_DELAY_MS, 2000);
      const args = { status: 'sending', isTextOnly: true, sentAt } as const;
      assert.strictEqual(
        tellomiSendingIndicatorDelay({ ...args, now: sentAt }),
        2000
      );
      assert.strictEqual(
        tellomiSendingIndicatorDelay({ ...args, now: sentAt + 1500 }),
        500
      );
      assert.strictEqual(
        tellomiSendingIndicatorDelay({ ...args, now: sentAt + 2000 }),
        0
      );
      assert.strictEqual(
        tellomiSendingIndicatorDelay({ ...args, now: sentAt + 60_000 }),
        0
      );
    });

    it('shows the spinner right away for attachments and other statuses', () => {
      assert.strictEqual(
        tellomiSendingIndicatorDelay({
          status: 'sending',
          isTextOnly: false,
          sentAt,
          now: sentAt,
        }),
        0
      );
      assert.strictEqual(
        tellomiSendingIndicatorDelay({
          status: 'sent',
          isTextOnly: true,
          sentAt,
          now: sentAt,
        }),
        0
      );
      assert.strictEqual(
        tellomiSendingIndicatorDelay({
          status: 'sending',
          isTextOnly: true,
          sentAt: undefined,
          now: sentAt,
        }),
        0
      );
    });

    it('waits at most 2 seconds when the clock was set back', () => {
      assert.strictEqual(
        tellomiSendingIndicatorRevealTimestamp(sentAt + 3_600_000, sentAt),
        sentAt + 2000
      );
    });

    it('treats quotes, link previews and long text as text; files and stickers not', () => {
      assert.isTrue(tellomiIsTextOnlyMessage({}));
      assert.isTrue(tellomiIsTextOnlyMessage({ attachments: [] }));
      assert.isFalse(tellomiIsTextOnlyMessage({ attachments: [{}] }));
      assert.isFalse(tellomiIsTextOnlyMessage({ sticker: { packId: 'x' } }));
    });
  });

  describe('read receipts by arrival time', () => {
    it('does not record the first write or a write without change', () => {
      assert.isUndefined(
        tellomiNextReadReceiptHistory(undefined, undefined, true, 1)
      );
      assert.isUndefined(tellomiNextReadReceiptHistory([], true, true, 1));
      assert.deepEqual(tellomiNextReadReceiptHistory([], true, false, 5), [
        { changedAt: 5, enabled: false },
      ]);
    });

    it('spec criterion 6: messages that arrived while off are never read-receipted', () => {
      // On, turned off at 100, turned on again at 200.
      let history = tellomiNextReadReceiptHistory([], true, false, 100);
      history = tellomiNextReadReceiptHistory(history, false, true, 200);
      assert.isTrue(tellomiWereReadReceiptsEnabledAt(history, true, 50));
      for (const receivedAt of [110, 120, 130]) {
        assert.isFalse(
          tellomiWereReadReceiptsEnabledAt(history, true, receivedAt)
        );
      }
      assert.isTrue(tellomiWereReadReceiptsEnabledAt(history, true, 250));
    });

    it('without history, follows the current setting (off before upgrade stays off)', () => {
      assert.isFalse(tellomiWereReadReceiptsEnabledAt(undefined, false, 10));
      assert.isTrue(tellomiWereReadReceiptsEnabledAt([], true, 10));
    });

    it('treats anything before the oldest kept switch as off once history was trimmed', () => {
      let history: ReadonlyArray<TellomiReadReceiptChange> = [];
      let enabled = true;
      for (let i = 1; i <= TELLOMI_READ_RECEIPT_HISTORY_LIMIT + 5; i += 1) {
        history =
          tellomiNextReadReceiptHistory(history, enabled, !enabled, i * 10) ??
          history;
        enabled = !enabled;
      }
      assert.lengthOf(history, TELLOMI_READ_RECEIPT_HISTORY_LIMIT);
      assert.isFalse(tellomiWereReadReceiptsEnabledAt(history, enabled, 1));
    });

    it('picks the last switch by time when the clock went back', () => {
      const history: ReadonlyArray<TellomiReadReceiptChange> = [
        { changedAt: 500, enabled: false },
        // Clock set back, then turned on.
        { changedAt: 300, enabled: true },
      ];
      assert.isTrue(tellomiWereReadReceiptsEnabledAt(history, true, 400));
      assert.isFalse(tellomiWereReadReceiptsEnabledAt(history, true, 600));
      assert.isFalse(tellomiWereReadReceiptsEnabledAt(history, true, 100));
      assert.isFalse(
        tellomiWereReadReceiptsEnabledAt(history, true, undefined)
      );
    });
  });
});
