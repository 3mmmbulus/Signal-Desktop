// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getTellomiPinNoticeDisplay,
  getTellomiPinNoticeMenuItems,
  getTellomiPinNoticeQuoteText,
  isTellomiPinNotice,
  isTellomiPinNoticeDeleteAllowed,
  isTellomiPinNoticeOfMine,
} from '../../util/tellomiPinNoticeActions.std.ts';
import type { ServiceIdString } from '../../types/ServiceId.std.ts';
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

  it('a group admin can not delete someone else’s pin line for everyone', () => {
    assert.isFalse(
      isTellomiPinNoticeDeleteAllowed({
        isPinNotice: true,
        isAdminDelete: true,
      })
    );
    assert.isTrue(
      isTellomiPinNoticeDeleteAllowed({
        isPinNotice: true,
        isAdminDelete: false,
      }),
      'the pinner can, in the usual time limit'
    );
    assert.isTrue(
      isTellomiPinNoticeDeleteAllowed({
        isPinNotice: false,
        isAdminDelete: true,
      }),
      'messages are as before'
    );
  });

  it('a pin line that was deleted for everyone reads as a deleted message, even after it lost what it pinned', () => {
    assert.equal(
      getTellomiPinNoticeDisplay({
        deletedForEveryone: false,
        hasPinMessage: true,
      }),
      'pin'
    );
    assert.equal(
      getTellomiPinNoticeDisplay({
        deletedForEveryone: true,
        hasPinMessage: false,
      }),
      'deleted'
    );
    assert.equal(
      getTellomiPinNoticeDisplay({
        deletedForEveryone: false,
        hasPinMessage: false,
      }),
      'deleted',
      'nothing to show of a notice without its pin, instead of crashing'
    );
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
