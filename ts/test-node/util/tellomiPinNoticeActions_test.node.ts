// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getTellomiPinNoticeMenuItems,
  getTellomiPinNoticeQuoteText,
  getTellomiPinNoticeDeletedProps,
  isTellomiPinNotice,
  isTellomiPinNoticeHidden,
  isTellomiPinNoticeOfMine,
  withoutTellomiHiddenItems,
} from '../../util/tellomiPinNoticeActions.std.ts';
import type { ServiceIdString } from '../../types/ServiceId.std.ts';
import { ReadStatus } from '../../messages/MessageReadStatus.std.ts';
import { SeenStatus } from '../../MessageSeenStatus.std.ts';
import i18n from './i18n.node.ts';

// ADR-0081 §九 P5, pinned-messages.md 3.7: the same cases as Android's `TellomiPinNoticeActionsTest` and iOS's.
describe('tellomiPinNoticeActions', () => {
  const ourAci = 'aci-me' as ServiceIdString;
  const theirAci = 'aci-them' as ServiceIdString;

  it('knows a pin notice by its type, and mine by who pinned', () => {
    assert.isTrue(isTellomiPinNotice({ type: 'pinned-message-notification' }));
    assert.isFalse(isTellomiPinNotice({ type: 'incoming' }));
    assert.isFalse(isTellomiPinNotice({ type: 'outgoing' }));

    assert.isTrue(
      isTellomiPinNoticeOfMine(
        { type: 'pinned-message-notification', sourceServiceId: ourAci },
        ourAci
      )
    );
    assert.isFalse(
      isTellomiPinNoticeOfMine(
        { type: 'pinned-message-notification', sourceServiceId: theirAci },
        ourAci
      ),
      'their pin is not mine'
    );
    assert.isFalse(
      isTellomiPinNoticeOfMine(
        { type: 'outgoing', sourceServiceId: ourAci },
        ourAci
      ),
      'an ordinary message is not a pin notice'
    );
    assert.isFalse(
      isTellomiPinNoticeOfMine(
        { type: 'pinned-message-notification', sourceServiceId: ourAci },
        undefined
      )
    );
  });

  it('the menu has the reactions, Reply and Delete — and nothing else', () => {
    assert.deepEqual(
      getTellomiPinNoticeMenuItems({ canReact: true, canReply: true }),
      ['react', 'reply', 'delete']
    );
  });

  it('the menu leaves out what can not be done now, but always has Delete for me', () => {
    assert.deepEqual(
      getTellomiPinNoticeMenuItems({ canReact: false, canReply: false }),
      ['delete']
    );
    assert.deepEqual(
      getTellomiPinNoticeMenuItems({ canReact: true, canReply: false }),
      ['react', 'delete']
    );
    assert.deepEqual(
      getTellomiPinNoticeMenuItems({ canReact: false, canReply: true }),
      ['reply', 'delete']
    );
  });

  it('a pin line deleted for everyone is hidden — whoever deleted it; nothing else is', () => {
    assert.isTrue(
      isTellomiPinNoticeHidden({
        type: 'pinned-message-notification',
        deletedForEveryone: true,
      })
    );
    assert.isFalse(
      isTellomiPinNoticeHidden({ type: 'pinned-message-notification' })
    );
    assert.isFalse(
      isTellomiPinNoticeHidden({ type: 'incoming', deletedForEveryone: true }),
      'a deleted message still shows its placeholder'
    );
  });

  it('a pin line deleted for everyone is read and seen; any other deleted message is left as it was', () => {
    assert.deepEqual(
      getTellomiPinNoticeDeletedProps({ type: 'pinned-message-notification' }),
      { readStatus: ReadStatus.Read, seenStatus: SeenStatus.Seen }
    );
    assert.deepEqual(getTellomiPinNoticeDeletedProps({ type: 'incoming' }), {});
  });

  describe('withoutTellomiHiddenItems', () => {
    const hidden = new Set(['h1', 'h2']);
    const isHidden = (id: string) => hidden.has(id);

    it('gives the same array back when nothing is hidden', () => {
      const items = ['a', 'b', 'c'];
      const result = withoutTellomiHiddenItems({
        items,
        isHidden,
        oldestUnseenIndex: 1,
        scrollToIndex: 2,
      });
      assert.strictEqual(result.items, items);
      assert.strictEqual(result.oldestUnseenIndex, 1);
      assert.strictEqual(result.scrollToIndex, 2);
    });

    it('drops the hidden ones and moves the indexes with them', () => {
      const result = withoutTellomiHiddenItems({
        items: ['a', 'h1', 'b', 'c'],
        isHidden,
        oldestUnseenIndex: 2,
        scrollToIndex: 3,
      });
      assert.deepEqual(result.items, ['a', 'b', 'c']);
      assert.strictEqual(result.oldestUnseenIndex, 1, 'b');
      assert.strictEqual(result.scrollToIndex, 2, 'c');
    });

    it('an index on a hidden item moves to the next one shown, or to none', () => {
      const result = withoutTellomiHiddenItems({
        items: ['a', 'h1', 'b', 'h2'],
        isHidden,
        oldestUnseenIndex: 1,
        scrollToIndex: 3,
      });
      assert.deepEqual(result.items, ['a', 'b']);
      assert.strictEqual(result.oldestUnseenIndex, 1, 'b');
      assert.isNull(result.scrollToIndex, 'nothing shown after it');
    });

    it('keeps no index as no index', () => {
      const result = withoutTellomiHiddenItems({
        items: ['h1', 'a'],
        isHidden,
        oldestUnseenIndex: null,
        scrollToIndex: null,
      });
      assert.deepEqual(result.items, ['a']);
      assert.isNull(result.oldestUnseenIndex);
      assert.isNull(result.scrollToIndex);
    });
  });

  it('the quote says who pinned in the third person, for my own pin too', () => {
    assert.equal(
      getTellomiPinNoticeQuoteText(i18n, {
        pinnerTitle: 'Alice',
        subject: { kind: 'text', text: 'See you at 8' },
      }),
      'Alice pinned “See you at 8”'
    );
    assert.equal(
      getTellomiPinNoticeQuoteText(i18n, {
        pinnerTitle: 'Erel',
        subject: { kind: 'photo' },
      }),
      'Erel pinned a photo'
    );
    assert.equal(
      getTellomiPinNoticeQuoteText(i18n, {
        pinnerTitle: 'Alice',
        subject: undefined,
      }),
      'Alice pinned a message'
    );
  });
});
