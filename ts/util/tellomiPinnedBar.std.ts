// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

// pinned-messages.md 3.4, ADR-0081 P3: which pin the bar on top of a chat shows, its title, and the line on its left.
// The same rules as the phones (Android `TellomiPinnedBar.kt`, iOS `TellomiPinnedBar.swift`), which follow both Telegram
// apps (mechanism only, no code copied). Pins are ordered by where their message sits in the chat (the oldest first),
// not by when they were pinned. Everything here works on plain numbers so it can be tested without a DOM.
//
// A pin's "date" below is its message's `received_at` counter, which orders messages in a chat the way the timeline does.

// How many segments the line on the left shows at most.
const TELLOMI_PINNED_BAR_VISIBLE_SEGMENTS = 3;

export type TellomiPinnedBarTitle = Readonly<
  | { kind: 'pinned' }
  | { kind: 'previous' }
  | { kind: 'numbered'; number: number }
>;

// The segments of the line that are drawn: `count` of them from segment `first`; the side that has more pins past
// the drawn ones fades out.
export type TellomiPinnedBarSegments = Readonly<{
  first: number;
  count: number;
  fadeTop: boolean;
  fadeBottom: boolean;
}>;

// Orders pins by where their message is in the chat: the oldest first (the same order the timeline uses).
export function sortTellomiPinsByMessageOrder<
  T extends { receivedAtCounter: number; sentAtTimestamp: number },
>(pins: ReadonlyArray<T>): Array<T> {
  return pins.toSorted((a, b) => {
    if (a.receivedAtCounter !== b.receivedAtCounter) {
      return a.receivedAtCounter - b.receivedAtCounter;
    }
    return a.sentAtTimestamp - b.sentAtTimestamp;
  });
}

// While scrolling: the index (in `pinDates`, oldest first) of the newest pin at or before the newest message on screen;
// when every pin is newer than that, the oldest one.
export function tellomiPinFor(
  pinDates: ReadonlyArray<number>,
  newestVisibleDate: number
): number {
  if (pinDates.length === 0) {
    return 0;
  }
  const atOrBefore = pinDates.findLastIndex(date => date <= newestVisibleDate);
  return Math.max(atOrBefore, 0);
}

// After a tap on pin `index` (the jump to it): the pin shown next is the one before it; after the oldest, the newest.
export function tellomiNextPinAfterTap(index: number, size: number): number {
  return index <= 0 ? size - 1 : index - 1;
}

// One pin, or the newest of several: "Pinned message". Two pins, the older one: "Previous pinned message". More than
// two: the others are "Pinned message #N", numbered from the oldest.
export function getTellomiPinnedBarTitle(
  index: number,
  size: number
): TellomiPinnedBarTitle {
  if (size <= 1 || index === size - 1) {
    return { kind: 'pinned' };
  }
  if (size === 2) {
    return { kind: 'previous' };
  }
  return { kind: 'numbered', number: index + 1 };
}

// The line shows at most three segments, the selected one in the middle where it can.
export function getTellomiPinnedBarSegments(
  index: number,
  size: number
): TellomiPinnedBarSegments {
  if (size <= TELLOMI_PINNED_BAR_VISIBLE_SEGMENTS) {
    return { first: 0, count: size, fadeTop: false, fadeBottom: false };
  }
  const first = Math.min(
    Math.max(index - 1, 0),
    size - TELLOMI_PINNED_BAR_VISIBLE_SEGMENTS
  );
  return {
    first,
    count: TELLOMI_PINNED_BAR_VISIBLE_SEGMENTS,
    fadeTop: first > 0,
    fadeBottom: first + TELLOMI_PINNED_BAR_VISIBLE_SEGMENTS < size,
  };
}

// A pin chosen by a tap (or by clicking its segment) stays put until the user lets go of it by scrolling: toward newer
// messages at once, toward older ones only once they have scrolled past it. The scrolling the jump itself causes is not
// the user's.
export function tellomiReleasesForcedPin({
  userScrolling,
  newestVisibleBefore,
  newestVisibleNow,
  forcedPinDate,
}: Readonly<{
  userScrolling: boolean;
  newestVisibleBefore: number;
  newestVisibleNow: number;
  forcedPinDate: number;
}>): boolean {
  if (!userScrolling) {
    return false;
  }
  return (
    newestVisibleNow > newestVisibleBefore || newestVisibleNow < forcedPinDate
  );
}

// 3.4: someone who can't unpin only hides the bar on this device, until a pin newer than the newest one at that moment
// shows up (both Telegram apps: iOS `closedPinnedMessageId`, Android `pin_<chat>`). `hiddenAt` is the date of the
// newest pin when it was hidden.
export function isTellomiPinnedBarHidden(
  hiddenAt: number | null | undefined,
  pinDates: ReadonlyArray<number>
): boolean {
  if (hiddenAt == null || pinDates.length === 0) {
    return false;
  }
  return Math.max(...pinDates) <= hiddenAt;
}

// What the × on a bar with one pin does: it takes the pin back when it can (asking first, then a 5 second "Undo"), and
// otherwise only hides the bar on this device.
export function getTellomiPinnedBarCloseAction(
  canUnpin: boolean
): 'unpin' | 'hide' {
  return canUnpin ? 'unpin' : 'hide';
}

// The button on the right: the list of pins when there are several, × when there is one.
export function getTellomiPinnedBarButton(pinsCount: number): 'list' | 'close' {
  return pinsCount > 1 ? 'list' : 'close';
}
