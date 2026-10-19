// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { getIntl } from '../selectors/user.std.ts';
import { getConversationByIdSelector } from '../selectors/conversations.dom.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { PinnedMessagesPanel } from '../../components/conversation/pinned-messages/PinnedMessagesPanel.dom.tsx';
import type { SmartTimelineItemProps } from './TimelineItem.preload.tsx';
import { SmartTimelineItem } from './TimelineItem.preload.tsx';
import { canPinMessages as getCanPinMessages } from '../selectors/message.preload.ts';
import { useConversationsActions } from '../ducks/conversations.preload.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { useToastActions } from '../ducks/toast.preload.ts';
import { ToastType } from '../../types/Toast.dom.tsx';
import { canTellomiUnpinAll } from '../../util/tellomiPinChoice.std.ts';
import { useTellomiPinnedBarHide } from './tellomiPinnedBarHide.preload.ts';
import { useTellomiShownPins } from './tellomiPinnedList.preload.ts';

export type SmartPinnedMessagesPanelProps = Readonly<{
  conversationId: string;
}>;

function renderTimelineItem(props: SmartTimelineItemProps) {
  return <SmartTimelineItem {...props} />;
}

export const SmartPinnedMessagesPanel = memo(function SmartPinnedMessagesPanel(
  props: SmartPinnedMessagesPanelProps
) {
  const i18n = useSelector(getIntl);
  const conversationSelector = useSelector(getConversationByIdSelector);
  const conversation = conversationSelector(props.conversationId);
  const { scrollToMessage, tellomiUnpinWithUndo } = useConversationsActions();
  const { popPanelForConversation } = useNavActions();
  const { showToast } = useToastActions();
  const { hiddenAt, hide } = useTellomiPinnedBarHide(props.conversationId);

  strictAssert(
    conversation,
    '<SmartPinnedMessagesPanel> expected a conversation to be found'
  );

  const pins = useTellomiShownPins();
  const canPinMessages = getCanPinMessages(conversation);

  // Each pin can be unpinned by this person → "Unpin all"; otherwise "Hide pinned messages" (this device only)
  const bottomButton = canTellomiUnpinAll({
    pins: pins.map(pin => ({ isPinnedForMe: pin.isForMe })),
    canPinForEveryone: canPinMessages,
    isInactiveGroup:
      conversation.type === 'group' && Boolean(conversation.terminated),
  })
    ? 'unpinAll'
    : 'hide';

  // No confirmation: the list closes, the pins leave the bar, and "Undo" is offered for 5 seconds before they are sent
  const handleUnpinAll = useCallback(() => {
    popPanelForConversation();
    tellomiUnpinWithUndo(pins.map(pin => pin.messageId));
  }, [popPanelForConversation, tellomiUnpinWithUndo, pins]);

  const handleHide = useCallback(() => {
    popPanelForConversation();
    if (pins.length === 0) {
      return;
    }
    hide(Math.max(...pins.map(pin => pin.receivedAtCounter)));
    showToast({
      toastType: ToastType.TellomiPinBarHidden,
      parameters: {
        conversationId: props.conversationId,
        previousHiddenAt: hiddenAt,
      },
    });
  }, [
    popPanelForConversation,
    pins,
    hide,
    showToast,
    props.conversationId,
    hiddenAt,
  ]);

  const handleGoToMessage = useCallback(
    (messageId: string) => {
      popPanelForConversation();
      scrollToMessage(props.conversationId, messageId);
    },
    [popPanelForConversation, scrollToMessage, props.conversationId]
  );

  return (
    <PinnedMessagesPanel
      i18n={i18n}
      conversation={conversation}
      pins={pins}
      bottomButton={bottomButton}
      renderTimelineItem={renderTimelineItem}
      onUnpinAll={handleUnpinAll}
      onHide={handleHide}
      onGoToMessage={handleGoToMessage}
    />
  );
});
