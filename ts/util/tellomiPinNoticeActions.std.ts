// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import type { LocalizerType } from '../types/Util.std.ts';
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

// Deleting for everyone goes by the ordinary time limit and belongs to the pinner only: a group admin can't take
// someone else's pin line away from everyone (the admin delete is for messages).
export function isTellomiPinNoticeDeleteAllowed({
  isPinNotice,
  isAdminDelete,
}: Readonly<{
  isPinNotice: boolean;
  isAdminDelete: boolean;
}>): boolean {
  return !(isPinNotice && isAdminDelete);
}

// What a deleted pin line shows: after "Delete for everyone" the notice has lost what it pinned, and it reads as any
// deleted message does; it keeps no button and no reactions.
export function getTellomiPinNoticeDisplay({
  deletedForEveryone,
  hasPinMessage,
}: Readonly<{
  deletedForEveryone: boolean;
  hasPinMessage: boolean;
}>): 'pin' | 'deleted' {
  return deletedForEveryone || !hasPinMessage ? 'deleted' : 'pin';
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
