// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ForwardedRef, ReactNode, RefObject, JSX } from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLayoutEffect } from '@react-aria/utils';
import type { LocalizerType } from '../../../types/I18N.std.ts';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import type { SmartTimelineItemProps } from '../../../state/smart/TimelineItem.preload.tsx';
import { WidthBreakpoint } from '../../_util.std.ts';
import { AxoScrollArea } from '../../../axo/AxoScrollArea.dom.tsx';
import {
  createScrollerLock,
  ScrollerLockContext,
} from '../../../hooks/useScrollLock.dom.tsx';
import { getWidthBreakpoint } from '../../../util/timelineUtil.std.ts';
import { strictAssert } from '../../../util/assert.std.ts';
import { useSizeObserver } from '../../../hooks/useSizeObserver.dom.tsx';
import { MessageInteractivity } from '../Message.dom.tsx';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoButton } from '../../../axo/AxoButton.dom.tsx';
import { AxoIconButton } from '../../../axo/AxoIconButton.dom.tsx';

// What the list draws of a pin; the pins come in the order of their messages in the chat, the oldest first
export type TellomiListedPin = Readonly<{
  messageId: string;
  // A pin for me only: nobody else sees it, and the list says so under the bubble
  isForMe: boolean;
  // Whether the pinned message is mine, which side of the list it is on
  isOutgoing: boolean;
  // The date of the message (its `received_at`, the order of the chat)
  receivedAtCounter: number;
}>;

export type PinnedMessagesPanelProps = Readonly<{
  i18n: LocalizerType;
  conversation: ConversationType;
  pins: ReadonlyArray<TellomiListedPin>;
  // pinned-messages.md 3.5: "Unpin all" when every pin can be unpinned by this person, otherwise "Hide pinned messages"
  bottomButton: 'unpinAll' | 'hide';
  onUnpinAll: () => void;
  onHide: () => void;
  onGoToMessage: (messageId: string) => void;
  renderTimelineItem: (props: SmartTimelineItemProps) => JSX.Element;
}>;

// The width of an incoming message's avatar and the space around it in a group (what the bubble is pushed in by)
const GROUP_AVATAR_INDENT_PX = 52;
const BOTTOM_TOLERANCE_PX = 4;

function findScrollParent(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;
  while (current != null) {
    const { overflowY } = getComputedStyle(current);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

// pinned-messages.md 3.5: the list opens at the bottom (the newest pin) and stays there while its messages load and
// change size, until the person scrolls it themselves.
function useStickToBottom(
  contentRef: RefObject<HTMLElement | null>,
  bottomRef: RefObject<HTMLElement | null>
): () => void {
  const stuckRef = useRef(true);

  const scrollToBottom = useCallback(() => {
    if (stuckRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' });
    }
  }, [bottomRef]);

  useLayoutEffect(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  useEffect(() => {
    const content = contentRef.current;
    const scroller = content ? findScrollParent(content) : null;
    if (scroller == null) {
      return;
    }
    const release = () => {
      stuckRef.current = false;
    };
    // Scrolling back down to the bottom picks it up again
    const handleScroll = () => {
      if (
        scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight <=
        BOTTOM_TOLERANCE_PX
      ) {
        stuckRef.current = true;
      }
    };
    scroller.addEventListener('wheel', release, { passive: true });
    scroller.addEventListener('touchmove', release, { passive: true });
    scroller.addEventListener('pointerdown', release);
    scroller.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scroller.removeEventListener('wheel', release);
      scroller.removeEventListener('touchmove', release);
      scroller.removeEventListener('pointerdown', release);
      scroller.removeEventListener('scroll', handleScroll);
    };
  }, [contentRef]);

  return scrollToBottom;
}

export const PinnedMessagesPanel = memo(function PinnedMessagesPanel(
  props: PinnedMessagesPanelProps
) {
  const { i18n, pins, onGoToMessage } = props;
  const containerElementRef = useRef<HTMLDivElement>(null);
  const bottomElementRef = useRef<HTMLDivElement>(null);
  const [containerWidthBreakpoint, setContainerWidthBreakpoint] = useState(
    WidthBreakpoint.Wide
  );

  const scrollToBottom = useStickToBottom(
    containerElementRef,
    bottomElementRef
  );
  const isGroup = props.conversation.type === 'group';

  useLayoutEffect(() => {
    strictAssert(containerElementRef.current, 'Missing container ref');
    const container = containerElementRef.current;
    setContainerWidthBreakpoint(getWidthBreakpoint(container.offsetWidth));
  }, []);

  useSizeObserver(containerElementRef, size => {
    if (size.hidden) {
      return;
    }
    setContainerWidthBreakpoint(getWidthBreakpoint(size.width));
    scrollToBottom();
  });

  return (
    <div className={tw('flex h-full flex-col')}>
      <ScrollArea ref={containerElementRef}>
        {pins.map((pin, pinIndex) => {
          const next = pins[pinIndex + 1];
          const prev = pins[pinIndex - 1];
          return (
            <div key={pin.messageId} className={tw('relative')}>
              {props.renderTimelineItem({
                containerElementRef,
                containerWidthBreakpoint,
                conversationId: props.conversation.id,
                interactivity: MessageInteractivity.Embed,
                isBlocked: props.conversation.isBlocked ?? false,
                isGroup,
                isOldestTimelineItem: pinIndex === 0,
                item: {
                  type: 'none' as const,
                  id: pin.messageId,
                  messages: undefined,
                },
                nextMessageId: next?.messageId,
                previousMessageId: prev?.messageId,
                renderItem: () => {
                  throw new Error('not implemented');
                },
                unreadIndicatorPlacement: undefined,
              })}
              {pin.isForMe && (
                <div
                  className={tw(
                    'flex px-4 pb-1 type-caption text-secondary',
                    pin.isOutgoing ? 'justify-end' : 'justify-start'
                  )}
                  style={
                    isGroup && !pin.isOutgoing
                      ? { paddingInlineStart: GROUP_AVATAR_INDENT_PX }
                      : undefined
                  }
                >
                  {i18n('icu:TellomiPinnedPanel__OnlyYou')}
                </div>
              )}
              <div
                className={tw(
                  'absolute top-1/2 -translate-y-1/2',
                  pin.isOutgoing ? 'inset-s-1' : 'inset-e-1'
                )}
              >
                <GoToMessageButton
                  i18n={i18n}
                  messageId={pin.messageId}
                  isOutgoing={pin.isOutgoing}
                  onGoToMessage={onGoToMessage}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomElementRef} />
      </ScrollArea>
      {pins.length > 0 && (
        <div className={tw('flex items-center justify-center p-2.5')}>
          <AxoButton.Root
            variant="implied-primary"
            size="lg"
            onClick={
              props.bottomButton === 'unpinAll'
                ? props.onUnpinAll
                : props.onHide
            }
          >
            {props.bottomButton === 'unpinAll'
              ? i18n('icu:TellomiPinnedPanel__UnpinAll')
              : i18n('icu:TellomiPinnedPanel__Hide')}
          </AxoButton.Root>
        </div>
      )}
    </div>
  );
});

// pinned-messages.md 3.5: an arrow beside each pin that closes the list and goes to the message in the chat
const GoToMessageButton = memo(function GoToMessageButton(
  props: Readonly<{
    i18n: LocalizerType;
    messageId: string;
    isOutgoing: boolean;
    onGoToMessage: (messageId: string) => void;
  }>
) {
  const { messageId, onGoToMessage } = props;
  const handleClick = useCallback(() => {
    onGoToMessage(messageId);
  }, [messageId, onGoToMessage]);
  return (
    <AxoIconButton.Root
      variant="subtle-secondary"
      size="sm"
      symbol={props.isOutgoing ? 'arrow-[start]' : 'arrow-[end]'}
      label={props.i18n('icu:PinnedMessagesBar__ActionsMenu__GoToMessage')}
      onClick={handleClick}
    />
  );
});

const ScrollArea = forwardRef(function ScrollArea(
  props: { children: ReactNode },
  ref: ForwardedRef<HTMLDivElement>
) {
  const scrollerLock = useMemo(() => {
    return createScrollerLock('PinnedMessagesPanel', () => {
      // noop - we probably don't need to do anything here because the only
      // thing that can happen is the pinned messages getting removed/added
    });
  }, []);

  return (
    <AxoScrollArea.Root scrollbarWidth="wide">
      <AxoScrollArea.Hint edge="top" />
      <AxoScrollArea.Hint edge="bottom" />
      <AxoScrollArea.Viewport>
        <AxoScrollArea.Content>
          <div ref={ref}>
            <ScrollerLockContext.Provider value={scrollerLock}>
              {props.children}
            </ScrollerLockContext.Provider>
          </div>
        </AxoScrollArea.Content>
      </AxoScrollArea.Viewport>
    </AxoScrollArea.Root>
  );
});
