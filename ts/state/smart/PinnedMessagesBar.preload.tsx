// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useSelector } from 'react-redux';
import { createSelector } from 'reselect';
import { getIntl } from '../selectors/user.std.ts';
import {
  getConversationSelector,
  getPinnedMessages,
  getMessages,
  getConversationIsReady,
  getTellomiPinnedForMeMessageIds,
} from '../selectors/conversations.dom.ts';
import { getSelectedConversationId } from '../selectors/nav.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import {
  tellomiPinUnpins,
  useConversationsActions,
} from '../ducks/conversations.preload.ts';
import type {
  Pin,
  PinMessage,
  PinMessageAttachment,
  PinMessageContact,
  PinMessagePoll,
  PinMessageText,
  PinSender,
} from '../../components/conversation/pinned-messages/PinnedMessagesBar.dom.tsx';
import { PinnedMessagesBar } from '../../components/conversation/pinned-messages/PinnedMessagesBar.dom.tsx';
import { PanelType } from '../../types/Panels.std.ts';
import type { PinnedMessageId } from '../../types/PinnedMessage.std.ts';
import {
  canPinMessages as getCanPinMessages,
  getMessagePropsSelector,
  type MessagePropsType,
} from '../selectors/message.preload.ts';
import * as Attachment from '../../util/Attachment.std.ts';
import * as MIME from '../../types/MIME.std.ts';
import * as EmbeddedContact from '../../types/EmbeddedContact.std.ts';
import type { StateSelector } from '../types.std.ts';
import { useNavActions } from '../ducks/nav.std.ts';
import { canTellomiUnpin } from '../../util/tellomiPinChoice.std.ts';
import {
  isTellomiPinnedBarHidden,
  sortTellomiPinsByMessageOrder,
  tellomiNextPinAfterTap,
  tellomiPinFor,
  tellomiReleasesForcedPin,
} from '../../util/tellomiPinnedBar.std.ts';
import { useTellomiPinnedBarHide } from './tellomiPinnedBarHide.preload.ts';

function getPinMessageAttachment(
  props: MessagePropsType
): PinMessageAttachment | null {
  const attachment = props.attachments?.at(0);
  if (attachment == null) {
    return null;
  }
  const { contentType } = attachment;
  if (contentType === MIME.IMAGE_GIF || Attachment.isGIF([attachment])) {
    return { type: 'gif' };
  }
  // Tellomi (tellomi/tellomi#1263, spec R-1): a covered image / video stays blurred here, uncovered or not.
  const tellomiSpoiler = attachment.tellomiSpoiler
    ? { tellomiSpoiler: true }
    : {};
  if (Attachment.isImage([attachment])) {
    return {
      type: 'image',
      url: attachment.thumbnail?.url ?? null,
      ...tellomiSpoiler,
    };
  }
  if (Attachment.isVideo([attachment])) {
    return {
      type: 'video',
      url: attachment.thumbnail?.url ?? null,
      ...tellomiSpoiler,
    };
  }
  if (Attachment.isVoiceMessage(attachment)) {
    return { type: 'voiceMessage' };
  }
  return { type: 'file', name: attachment.fileName ?? null };
}

function getPinMessageText(props: MessagePropsType): PinMessageText | null {
  if (props.text == null) {
    return null;
  }
  return { body: props.text, bodyRanges: props.bodyRanges ?? [] };
}

function getPinMessageContact(
  props: MessagePropsType
): PinMessageContact | null {
  if (props.contact == null) {
    return null;
  }

  return {
    name: EmbeddedContact.getDisplayName(props.contact) ?? null,
  };
}

function isPinMessagePayment(props: MessagePropsType): boolean {
  return props.payment != null;
}

function getPinMessagePoll(props: MessagePropsType): PinMessagePoll | null {
  if (props.poll == null) {
    return null;
  }
  return {
    question: props.poll.question,
  };
}

function isPinMessageSticker(props: MessagePropsType): boolean {
  return props.isSticker ?? false;
}

function isPinMessageViewOnceMedia(props: MessagePropsType): boolean {
  return props.isTapToView ?? false;
}

function getPinMessage(
  props: MessagePropsType,
  sentAtTimestamp: number,
  receivedAtCounter: number
): PinMessage {
  return {
    id: props.id,
    sentAtTimestamp,
    receivedAtCounter,
    text: getPinMessageText(props),
    attachment: getPinMessageAttachment(props),
    contact: getPinMessageContact(props),
    payment: isPinMessagePayment(props),
    poll: getPinMessagePoll(props),
    sticker: isPinMessageSticker(props),
    viewOnceMedia: isPinMessageViewOnceMedia(props),
  };
}

function getPinSender(props: MessagePropsType): PinSender {
  return {
    id: props.author.id,
    title: props.author.title,
    isMe: props.author.isMe,
  };
}

// Tellomi (pinned-messages.md 3.4): the pins in the order their messages are in the chat, the oldest first (not the
// order they were pinned in), "for me only" pins among the others.
const selectPins: StateSelector<ReadonlyArray<Pin>> = createSelector(
  getPinnedMessages,
  getMessages,
  getMessagePropsSelector,
  (pinnedMessages, messagesLookup, messagePropsSelector) => {
    const pins = pinnedMessages.map((pinnedMessage): Pin => {
      const message = messagesLookup[pinnedMessage.messageId];
      strictAssert(message != null, 'Missing pinned message');
      const messageProps = messagePropsSelector(message);

      return {
        id: pinnedMessage.id,
        sender: getPinSender(messageProps),
        message: getPinMessage(
          messageProps,
          message.sent_at,
          message.received_at
        ),
      };
    });
    return sortTellomiPinsByMessageOrder(
      pins.map(pin => ({
        pin,
        receivedAtCounter: pin.message.receivedAtCounter,
        sentAtTimestamp: pin.message.sentAtTimestamp,
      }))
    ).map(({ pin }) => pin);
  }
);

// The newest message on screen: the last message element in the timeline (they are in the order of the chat) that is
// at least partly inside the scroller. Returns the date (`received_at`) of that message.
function getNewestVisibleDate(
  scroller: Element,
  messagesList: Element,
  getDate: (messageId: string) => number | undefined
): number | null {
  const { top, bottom } = scroller.getBoundingClientRect();
  const elements =
    messagesList.querySelectorAll<HTMLElement>('[data-message-id]');
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const element = elements[i];
    const messageId = element?.dataset.messageId;
    if (element == null || messageId == null) {
      continue;
    }
    const date = getDate(messageId);
    if (date == null) {
      continue;
    }
    const rect = element.getBoundingClientRect();
    if (rect.bottom > top && rect.top < bottom) {
      return date;
    }
  }
  return null;
}

// How long after the last wheel / key / pointer input what scrolls still counts as the user's own scrolling.
const USER_SCROLL_WINDOW_MS = 250;

const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
]);

// Tellomi (pinned-messages.md 3.4): what the bar shows follows the timeline — the newest pin at or before the newest
// message on screen (util/tellomiPinnedBar). `forcedPinDate` is the date of a pin chosen by a tap: while it is set the
// scrolling the jump itself causes is ignored, and the user scrolling lets it go (`tellomiReleasesForcedPin`).
function useTimelineFollow({
  enabled,
  forcedPinDate,
  onNewestVisibleDate,
  onRelease,
}: {
  enabled: boolean;
  forcedPinDate: number | null;
  onNewestVisibleDate: (date: number | null) => void;
  onRelease: () => void;
}) {
  const messagesLookup = useSelector(getMessages);
  const callbacksRef = useRef({
    messagesLookup,
    forcedPinDate,
    onNewestVisibleDate,
    onRelease,
  });
  useEffect(() => {
    callbacksRef.current = {
      messagesLookup,
      forcedPinDate,
      onNewestVisibleDate,
      onRelease,
    };
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const scroller = document.querySelector(
      '.module-timeline__messages__container'
    );
    const messagesList = document.querySelector('.module-timeline__messages');
    if (scroller == null || messagesList == null) {
      return;
    }

    let newestVisibleDate: number | null = null;
    let userScrollingUntil = 0;
    let pointerIsDown = false;
    let frame: number | null = null;

    const getDate = (messageId: string) => {
      return callbacksRef.current.messagesLookup[messageId]?.received_at;
    };

    const measure = () => {
      frame = null;
      const now = getNewestVisibleDate(scroller, messagesList, getDate);
      const before = newestVisibleDate;
      newestVisibleDate = now;
      const { forcedPinDate: forced } = callbacksRef.current;
      if (
        forced != null &&
        now != null &&
        before != null &&
        tellomiReleasesForcedPin({
          userScrolling: pointerIsDown || Date.now() < userScrollingUntil,
          newestVisibleBefore: before,
          newestVisibleNow: now,
          forcedPinDate: forced,
        })
      ) {
        callbacksRef.current.onRelease();
      }
      callbacksRef.current.onNewestVisibleDate(now);
    };

    const scheduleMeasure = () => {
      if (frame == null) {
        frame = requestAnimationFrame(measure);
      }
    };

    const noteUserInput = () => {
      userScrollingUntil = Date.now() + USER_SCROLL_WINDOW_MS;
    };
    const handlePointerDown = () => {
      pointerIsDown = true;
      noteUserInput();
    };
    const handlePointerUp = () => {
      pointerIsDown = false;
      noteUserInput();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (SCROLL_KEYS.has(event.key)) {
        noteUserInput();
      }
    };

    scroller.addEventListener('scroll', scheduleMeasure, { passive: true });
    scroller.addEventListener('wheel', noteUserInput, { passive: true });
    scroller.addEventListener('touchmove', noteUserInput, { passive: true });
    scroller.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('keydown', handleKeyDown);

    // Messages come and go as the timeline loads more of the chat
    const mutationObserver = new MutationObserver(scheduleMeasure);
    mutationObserver.observe(messagesList, { childList: true });

    measure();

    return () => {
      if (frame != null) {
        cancelAnimationFrame(frame);
      }
      scroller.removeEventListener('scroll', scheduleMeasure);
      scroller.removeEventListener('wheel', noteUserInput);
      scroller.removeEventListener('touchmove', noteUserInput);
      scroller.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('keydown', handleKeyDown);
      mutationObserver.disconnect();
    };
  }, [enabled]);
}

// Keyed by chat: which pin was chosen by a tap, and what was last on screen, are about one chat only.
export const SmartPinnedMessagesBar = memo(function SmartPinnedMessagesBar() {
  const conversationId = useSelector(getSelectedConversationId);
  strictAssert(
    conversationId != null,
    'PinnedMessagesBar should only be rendered in selected conversation'
  );
  return (
    <SmartPinnedMessagesBarForConversation
      key={conversationId}
      conversationId={conversationId}
    />
  );
});

const SmartPinnedMessagesBarForConversation = memo(
  function SmartPinnedMessagesBarForConversation({
    conversationId,
  }: Readonly<{ conversationId: string }>) {
    const i18n = useSelector(getIntl);

    const conversationSelector = useSelector(getConversationSelector);
    const conversation = conversationSelector(conversationId);
    strictAssert(conversation != null, 'Missing conversation');

    const conversationIsReady = useSelector(getConversationIsReady);
    const allPins = useSelector(selectPins);
    const forMeMessageIds = useSelector(getTellomiPinnedForMeMessageIds);
    const canPinMessages = getCanPinMessages(conversation);

    const { scrollToMessage, tellomiUnpinWithUndo } = useConversationsActions();
    const { pushPanelForConversation } = useNavActions();
    const { hiddenAt, hide } = useTellomiPinnedBarHide(conversationId);

    // Pins that were unpinned and wait on "Undo", or were sent and are not gone yet, are not on the bar
    const heldMessageIds = useSyncExternalStore(
      tellomiPinUnpins.subscribe,
      tellomiPinUnpins.getSnapshot
    );
    useEffect(() => {
      tellomiPinUnpins.prune(new Set(allPins.map(pin => pin.message.id)));
    }, [allPins]);

    const shownPins = useMemo(
      () => allPins.filter(pin => !heldMessageIds.has(pin.message.id)),
      [allPins, heldMessageIds]
    );
    const pinDates = useMemo(
      () => shownPins.map(pin => pin.message.receivedAtCounter),
      [shownPins]
    );
    const isHidden = isTellomiPinnedBarHidden(hiddenAt, pinDates);
    const pins = useMemo(
      () => (isHidden ? [] : shownPins),
      [isHidden, shownPins]
    );

    // A pin chosen by a tap stays until the user lets go of it by scrolling; otherwise the bar follows the timeline
    const [forcedPinId, setForcedPinId] = useState<PinnedMessageId | null>(
      null
    );
    const [newestVisibleDate, setNewestVisibleDate] = useState<number | null>(
      null
    );

    const forcedIndex = pins.findIndex(pin => pin.id === forcedPinId);
    let currentIndex: number;
    if (pins.length === 0) {
      currentIndex = -1;
    } else if (forcedIndex >= 0) {
      currentIndex = forcedIndex;
    } else if (newestVisibleDate == null) {
      currentIndex = pins.length - 1;
    } else {
      currentIndex = tellomiPinFor(
        pins.map(pin => pin.message.receivedAtCounter),
        newestVisibleDate
      );
    }
    const current = pins[currentIndex]?.id ?? null;
    const forcedPinDate =
      forcedIndex >= 0
        ? (pins[forcedIndex]?.message.receivedAtCounter ?? null)
        : null;

    const handleRelease = useCallback(() => {
      setForcedPinId(null);
    }, []);

    useTimelineFollow({
      enabled: pins.length > 0 && conversationIsReady,
      forcedPinDate,
      onNewestVisibleDate: setNewestVisibleDate,
      onRelease: handleRelease,
    });

    const handleCurrentChange = useCallback(
      (pinnedMessageId: PinnedMessageId) => {
        setForcedPinId(pinnedMessageId);
      },
      []
    );

    // Tap: jump to the pin that is shown (highlighted), then show an older one; after the oldest, the newest again.
    const handlePinGoTo = useCallback(
      (messageId: string) => {
        scrollToMessage(conversationId, messageId);
        if (currentIndex < 0) {
          return;
        }
        const next = pins[tellomiNextPinAfterTap(currentIndex, pins.length)];
        if (next != null) {
          setForcedPinId(next.id);
        }
      },
      [scrollToMessage, conversationId, pins, currentIndex]
    );

    const handlePinUnpin = useCallback(
      (messageId: string) => {
        tellomiUnpinWithUndo([messageId]);
      },
      [tellomiUnpinWithUndo]
    );

    const handlePinHide = useCallback(() => {
      if (pinDates.length > 0) {
        hide(Math.max(...pinDates));
      }
    }, [hide, pinDates]);

    const handlePinsShowAll = useCallback(() => {
      pushPanelForConversation({
        type: PanelType.PinnedMessages,
      });
    }, [pushPanelForConversation]);

    // With one pin the × can take it back when it is for me only, or when this person may unpin in this chat
    const canUnpin = canTellomiUnpin({
      isPinnedForMe:
        pins.length === 1 &&
        forMeMessageIds.includes(pins[0]?.message.id ?? ''),
      canPinForEveryone: canPinMessages,
      isInactiveGroup:
        conversation.type === 'group' && Boolean(conversation.terminated),
    });

    if (!conversationIsReady) {
      return null;
    }

    return (
      <PinnedMessagesBar
        i18n={i18n}
        pins={pins}
        current={current}
        onCurrentChange={handleCurrentChange}
        onPinGoTo={handlePinGoTo}
        onPinUnpin={handlePinUnpin}
        onPinHide={handlePinHide}
        onPinsShowAll={handlePinsShowAll}
        canUnpin={canUnpin}
      />
    );
  }
);
