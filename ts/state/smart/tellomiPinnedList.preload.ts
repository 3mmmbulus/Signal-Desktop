// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { useMemo, useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import {
  getMessages,
  getPinnedMessages,
} from '../selectors/conversations.dom.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { tellomiPinUnpins } from '../ducks/conversations.preload.ts';
import { sortTellomiPinsByMessageOrder } from '../../util/tellomiPinnedBar.std.ts';
import { isTellomiPinnedForMe } from '../../types/PinnedMessage.std.ts';
import type { TellomiListedPin } from '../../components/conversation/pinned-messages/PinnedMessagesPanel.dom.tsx';
import type { StateSelector } from '../types.std.ts';

// Tellomi (pinned-messages.md 3.5): the pins of the open chat in the order their messages are in the chat, the oldest
// first (the same order as the bar), each with what the list needs to draw it.
const getTellomiListedPins: StateSelector<ReadonlyArray<TellomiListedPin>> =
  createSelector(getPinnedMessages, getMessages, (pinnedMessages, messages) => {
    return sortTellomiPinsByMessageOrder(
      pinnedMessages.map(pinnedMessage => {
        const message = messages[pinnedMessage.messageId];
        strictAssert(message != null, 'Missing pinned message');
        return {
          pin: {
            messageId: pinnedMessage.messageId,
            isForMe: isTellomiPinnedForMe(pinnedMessage),
            isOutgoing: message.type === 'outgoing',
            receivedAtCounter: message.received_at,
          },
          receivedAtCounter: message.received_at,
          sentAtTimestamp: message.sent_at,
        };
      })
    ).map(({ pin }) => pin);
  });

// The same, without the pins that were unpinned and wait on "Undo", or were sent and are not gone yet
// (util/tellomiHeldUnpins): what the list shows, and what its title counts.
export function useTellomiShownPins(): ReadonlyArray<TellomiListedPin> {
  const pins = useSelector(getTellomiListedPins);
  const held = useSyncExternalStore(
    tellomiPinUnpins.subscribe,
    tellomiPinUnpins.getSnapshot
  );
  return useMemo(
    () =>
      held.size === 0 ? pins : pins.filter(pin => !held.has(pin.messageId)),
    [pins, held]
  );
}
