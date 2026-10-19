// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { ReadStatus } from '../messages/MessageReadStatus.std.ts';
import { SeenStatus } from '../MessageSeenStatus.std.ts';
import {
  getTellomiPinNoticeText,
  type TellomiPinSubject,
} from './tellomiPinNotice.std.ts';

// ADR-0081 §4.2 / §九 P5, pinned-messages.md 3.7: the chat event "×× pinned “…”" can be reacted to, replied to and
// deleted, like on the phones. What it is — its identity — is who pinned (`sourceServiceId`) and when (`sent_at`, the
// timestamp of the pin message), which is what a reaction, a quote or a delete names it by.

export function isTellomiPinNotice(
  message: Pick<ReadonlyMessageAttributesType, 'type'>
): boolean {
  return message.type === 'pinned-message-notification';
}

// A pin notice made by me, as someone else's reaction to it needs: the reaction notifies, and counts as unseen.
export function isTellomiPinNoticeOfMine(
  message: Pick<ReadonlyMessageAttributesType, 'type' | 'sourceServiceId'>,
  ourAci: string | undefined
): boolean {
  return (
    isTellomiPinNotice(message) &&
    ourAci != null &&
    message.sourceServiceId === ourAci
  );
}

export type TellomiPinNoticeMenuItem = 'react' | 'reply' | 'delete';

// The long-press (right-click) menu of the chat event, in order: the emoji reactions, "Reply" and "Delete" — no
// copy, forward, pin, edit or select (spec 3.7; Telegram's service messages are the same). One that can't be done now
// (a blocked chat, a group that is over) is not offered; "Delete" (for me) always is.
export function getTellomiPinNoticeMenuItems({
  canReact,
  canReply,
}: Readonly<{
  canReact: boolean;
  canReply: boolean;
}>): ReadonlyArray<TellomiPinNoticeMenuItem> {
  const items: Array<TellomiPinNoticeMenuItem> = [];
  if (canReact) {
    items.push('react');
  }
  if (canReply) {
    items.push('reply');
  }
  items.push('delete');
  return items;
}

// A pin line deleted for everyone — by the pinner or by a group admin — leaves nothing behind in the chat (erel
// 2026-10-19, after how Telegram behaves): no "deleted" placeholder. The row stays in the database, so the delete can
// still be sent and retried, but the timeline skips it.
export function isTellomiPinNoticeHidden(
  message: Pick<ReadonlyMessageAttributesType, 'type' | 'deletedForEveryone'>
): boolean {
  return isTellomiPinNotice(message) && Boolean(message.deletedForEveryone);
}

// What deleting a pin line for everyone sets besides the upstream erase: it no longer counts as unread or unseen
// (erel 2026-10-19, after how Telegram behaves) — read, without sending a read receipt for it. Anything else: nothing.
export function getTellomiPinNoticeDeletedProps(
  message: Pick<ReadonlyMessageAttributesType, 'type'>
): Partial<Pick<ReadonlyMessageAttributesType, 'readStatus' | 'seenStatus'>> {
  if (!isTellomiPinNotice(message)) {
    return {};
  }
  return { readStatus: ReadStatus.Read, seenStatus: SeenStatus.Seen };
}

// The timeline's ids without the hidden ones. The indexes into it (the oldest unseen message, the one to scroll to)
// move with it; one that was on a hidden item moves to the next item shown, or to none. Nothing hidden: the same
// array back, so what is memoized on it stays.
export function withoutTellomiHiddenItems({
  items,
  isHidden,
  oldestUnseenIndex,
  scrollToIndex,
}: Readonly<{
  items: ReadonlyArray<string>;
  isHidden: (id: string) => boolean;
  oldestUnseenIndex: number | null;
  scrollToIndex: number | null;
}>): {
  items: ReadonlyArray<string>;
  oldestUnseenIndex: number | null;
  scrollToIndex: number | null;
} {
  if (!items.some(isHidden)) {
    return { items, oldestUnseenIndex, scrollToIndex };
  }
  const kept: Array<string> = [];
  // newIndexAt[i] = where items[i], or the first item shown after it, lands
  const newIndexAt: Array<number> = [];
  for (const id of items) {
    newIndexAt.push(kept.length);
    if (!isHidden(id)) {
      kept.push(id);
    }
  }
  const move = (index: number | null): number | null => {
    if (index == null) {
      return null;
    }
    const moved = newIndexAt[index];
    return moved != null && moved < kept.length ? moved : null;
  };
  return {
    items: kept,
    oldestUnseenIndex: move(oldestUnseenIndex),
    scrollToIndex: move(scrollToIndex),
  };
}

// The line a reply quotes, third person even for my own pin ("Alice pinned “See you at 8”"): it is sent along with the
// reply, for the versions that can't find the chat event, and a received reply shows this device's own line.
export function getTellomiPinNoticeQuoteText(
  i18n: LocalizerType,
  {
    pinnerTitle,
    subject,
  }: Readonly<{
    pinnerTitle: string;
    subject: TellomiPinSubject | undefined;
  }>
): string {
  return getTellomiPinNoticeText(i18n, {
    isMe: false,
    senderTitle: pinnerTitle,
    subject,
  });
}
