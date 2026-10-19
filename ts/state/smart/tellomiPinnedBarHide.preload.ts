// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getTellomiPinnedBarHidden } from '../selectors/items.dom.ts';
import { useItemsActions } from '../ducks/items.preload.ts';

// Tellomi (pinned-messages.md 3.4 / 3.5, ADR-0081 P3 / P4): hiding the pinned messages bar of a chat on this device — a
// member who can't unpin pressing × on the bar, or "Hide pinned messages" at the bottom of the list. The bar comes back
// with a pin newer than `hiddenAt`, the date of the newest pin right now (util/tellomiPinnedBar). Local only: this goes
// into the `tellomiPinnedBarHidden` item (docs/signal/VERSIONS.md) and is never synced.
export function useTellomiPinnedBarHide(conversationId: string): Readonly<{
  hiddenAt: number | undefined;
  hide: (hiddenAt: number) => void;
  unhide: () => void;
}> {
  const hidden = useSelector(getTellomiPinnedBarHidden);
  const { putItem } = useItemsActions();

  const hide = useCallback(
    (hiddenAt: number) => {
      putItem('tellomiPinnedBarHidden', {
        ...hidden,
        [conversationId]: hiddenAt,
      });
    },
    [putItem, hidden, conversationId]
  );

  const unhide = useCallback(() => {
    putItem(
      'tellomiPinnedBarHidden',
      Object.fromEntries(
        Object.entries(hidden).filter(([id]) => id !== conversationId)
      )
    );
  }, [putItem, hidden, conversationId]);

  return { hiddenAt: hidden[conversationId], hide, unhide };
}
