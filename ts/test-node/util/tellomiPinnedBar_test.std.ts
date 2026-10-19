// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getTellomiPinnedBarButton,
  getTellomiPinnedBarCloseAction,
  getTellomiPinnedBarSegments,
  getTellomiPinnedBarTitle,
  isTellomiPinnedBarHidden,
  sortTellomiPinsByMessageOrder,
  tellomiNextPinAfterTap,
  tellomiPinFor,
  tellomiReleasesForcedPin,
} from '../../util/tellomiPinnedBar.std.ts';

// pinned-messages.md 3.4: the same cases as Android's `TellomiPinnedBarTest` and iOS's `TellomiPinnedBarTest`.
describe('tellomiPinnedBar', () => {
  const pins = [100, 200, 300, 400, 500];

  it('orders pins by their message in the chat, not by when they were pinned', () => {
    const pinnedFirstButNewest = {
      id: 'a',
      receivedAtCounter: 500,
      sentAtTimestamp: 1,
    };
    const pinnedLastButOldest = {
      id: 'b',
      receivedAtCounter: 100,
      sentAtTimestamp: 2,
    };
    const sameCounterLaterSent = {
      id: 'c',
      receivedAtCounter: 100,
      sentAtTimestamp: 9,
    };
    assert.deepEqual(
      sortTellomiPinsByMessageOrder([
        pinnedFirstButNewest,
        sameCounterLaterSent,
        pinnedLastButOldest,
      ]).map(pin => pin.id),
      ['b', 'c', 'a']
    );
  });

  it('while scrolling it shows the newest pin at or before the newest message on screen', () => {
    assert.strictEqual(
      tellomiPinFor(pins, 900),
      4,
      'at the bottom: the newest'
    );
    assert.strictEqual(tellomiPinFor(pins, 350), 2);
    assert.strictEqual(tellomiPinFor(pins, 300), 2, 'on a pinned message');
    assert.strictEqual(
      tellomiPinFor(pins, 50),
      0,
      'above every pin: the oldest'
    );
    assert.strictEqual(tellomiPinFor([], 50), 0);
  });

  it('each tap goes to an older pin, and from the oldest back to the newest', () => {
    let index = 4;
    const shown = [index];
    for (let i = 0; i < 5; i += 1) {
      index = tellomiNextPinAfterTap(index, pins.length);
      shown.push(index);
    }
    assert.deepEqual(shown, [4, 3, 2, 1, 0, 4]);
  });

  it('titles - one pin, the older of two, numbers from the oldest', () => {
    assert.deepEqual(getTellomiPinnedBarTitle(0, 1), { kind: 'pinned' });
    assert.deepEqual(getTellomiPinnedBarTitle(1, 2), { kind: 'pinned' });
    assert.deepEqual(getTellomiPinnedBarTitle(0, 2), { kind: 'previous' });
    assert.deepEqual(
      getTellomiPinnedBarTitle(6, 7),
      { kind: 'pinned' },
      'the newest has no number'
    );
    assert.deepEqual(getTellomiPinnedBarTitle(0, 7), {
      kind: 'numbered',
      number: 1,
    });
    assert.deepEqual(getTellomiPinnedBarTitle(5, 7), {
      kind: 'numbered',
      number: 6,
    });
    assert.deepEqual(getTellomiPinnedBarTitle(0, 3), {
      kind: 'numbered',
      number: 1,
    });
  });

  it('the line shows at most three segments, the selected one in the middle where it can', () => {
    assert.deepEqual(getTellomiPinnedBarSegments(1, 2), {
      first: 0,
      count: 2,
      fadeTop: false,
      fadeBottom: false,
    });
    assert.deepEqual(getTellomiPinnedBarSegments(2, 3), {
      first: 0,
      count: 3,
      fadeTop: false,
      fadeBottom: false,
    });
    assert.deepEqual(
      getTellomiPinnedBarSegments(0, 7),
      { first: 0, count: 3, fadeTop: false, fadeBottom: true },
      'the oldest of seven'
    );
    assert.deepEqual(getTellomiPinnedBarSegments(3, 7), {
      first: 2,
      count: 3,
      fadeTop: true,
      fadeBottom: true,
    });
    assert.deepEqual(
      getTellomiPinnedBarSegments(6, 7),
      { first: 4, count: 3, fadeTop: true, fadeBottom: false },
      'the newest of seven'
    );
  });

  it('a pin chosen by a tap is let go by the user scrolling, not by the jump', () => {
    assert.isFalse(
      tellomiReleasesForcedPin({
        userScrolling: false,
        newestVisibleBefore: 900,
        newestVisibleNow: 300,
        forcedPinDate: 200,
      }),
      "the jump's own scrolling"
    );
    assert.isTrue(
      tellomiReleasesForcedPin({
        userScrolling: true,
        newestVisibleBefore: 300,
        newestVisibleNow: 320,
        forcedPinDate: 200,
      }),
      'dragged toward newer messages'
    );
    assert.isFalse(
      tellomiReleasesForcedPin({
        userScrolling: true,
        newestVisibleBefore: 300,
        newestVisibleNow: 250,
        forcedPinDate: 200,
      }),
      'dragged toward older, not past it yet'
    );
    assert.isTrue(
      tellomiReleasesForcedPin({
        userScrolling: true,
        newestVisibleBefore: 250,
        newestVisibleNow: 150,
        forcedPinDate: 200,
      }),
      'dragged past it'
    );
  });

  it('the × takes a pin back when it can, and otherwise only hides the bar', () => {
    assert.strictEqual(getTellomiPinnedBarCloseAction(true), 'unpin');
    assert.strictEqual(getTellomiPinnedBarCloseAction(false), 'hide');
  });

  it('the button on the right is the list for several pins and × for one', () => {
    assert.strictEqual(getTellomiPinnedBarButton(1), 'close');
    assert.strictEqual(getTellomiPinnedBarButton(2), 'list');
    assert.strictEqual(getTellomiPinnedBarButton(7), 'list');
  });

  it('a hidden bar comes back only for a pin newer than the newest one when it was hidden', () => {
    assert.isFalse(
      isTellomiPinnedBarHidden(undefined, [100, 200]),
      'never hidden'
    );
    assert.isTrue(isTellomiPinnedBarHidden(200, [100, 200]), 'hidden');
    assert.isTrue(isTellomiPinnedBarHidden(200, [200]));
    assert.isTrue(
      isTellomiPinnedBarHidden(200, [50, 200]),
      'a pin of an older message does not bring it back'
    );
    assert.isFalse(
      isTellomiPinnedBarHidden(200, [100, 200, 300]),
      'a pin of a newer message does'
    );
    assert.isFalse(
      isTellomiPinnedBarHidden(200, []),
      'no pins, nothing to hide'
    );
  });
});
