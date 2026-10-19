// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComponentProps, JSX, RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Manager, Popper, Reference } from 'react-popper';
import type { PreventOverflowModifier } from '@popperjs/core/lib/modifiers/preventOverflow.js';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import type { LocalizerType, ThemeType } from '../../../types/Util.std.ts';
import { I18n } from '../../I18n.dom.tsx';
import { SystemMessage } from '../SystemMessage.dom.tsx';
import { UserText } from '../../UserText.dom.tsx';
import { Button, ButtonSize, ButtonVariant } from '../../Button.dom.tsx';
import type { PinMessageData } from '../../../model-types.d.ts';
import type { DurationInSeconds } from '../../../util/durations/duration-in-seconds.std.ts';
import type { TellomiPinSubject } from '../../../util/tellomiPinNotice.std.ts';
import { getTellomiPinSubjectText } from '../../../util/tellomiPinNotice.std.ts';
import { getTellomiPinNoticeMenuItems } from '../../../util/tellomiPinNoticeActions.std.ts';
import { MessageContextMenu } from '../MessageContextMenu.dom.tsx';
import { MessageReactions } from '../Message.dom.tsx';
import type { Reaction } from '../ReactionViewer.dom.tsx';
import type { SmartReactionPicker } from '../../../state/smart/ReactionPicker.dom.tsx';
import type { DeleteMessagesPropsType } from '../../../state/ducks/globalModals.preload.ts';
import type { PreferredBadgeSelectorType } from '../../../state/selectors/badges.preload.ts';
import type { Emoji } from '../../../axo/emoji.std.ts';
import { handleOutsideClick } from '../../../util/handleOutsideClick.dom.ts';
import { offsetDistanceModifier } from '../../../util/popperUtil.std.ts';
import { useScrollerLock } from '../../../hooks/useScrollLock.dom.tsx';
import { tw } from '../../../axo/tw.dom.tsx';

// Tellomi (ADR-0081 §九 P5): a pin's chat event that was deleted for everyone has lost what it pinned, and is not shown.
export type PinnedMessageNotificationData = Readonly<
  {
    sender: ConversationType;
    expireTimer: DurationInSeconds | null;
    expirationStartTimestamp: number | null;
  } & (
    | { isDeleted: true }
    | {
        isDeleted: false;
        pinMessage: PinMessageData;
        // Tellomi (ADR-0081 §4.4): what the pinned message is; null = "a message".
        tellomiSubject: TellomiPinSubject | null;
        reactions: ReadonlyArray<Reaction>;
        selectedReaction: Emoji.Variant | undefined;
        canReact: boolean;
        canReply: boolean;
      }
  )
>;

export type PinnedMessageNotificationProps = PinnedMessageNotificationData &
  Readonly<{
    i18n: LocalizerType;
    id: string;
    conversationId: string;
    isSelectMode: boolean;
    theme: ThemeType;
    containerElementRef: RefObject<HTMLElement | null>;
    getPreferredBadge: PreferredBadgeSelectorType;
    onScrollToPinnedMessage: (pinMessage: PinMessageData) => void;
    reactToMessage: (
      id: string,
      { emoji, remove }: { emoji: Emoji.Variant; remove: boolean }
    ) => void;
    renderReactionPicker: (
      props: ComponentProps<typeof SmartReactionPicker>
    ) => JSX.Element;
    setQuoteByMessageId: (conversationId: string, messageId: string) => void;
    toggleDeleteMessagesModal: (props: DeleteMessagesPropsType) => void;
  }>;

export function PinnedMessageNotification(
  props: PinnedMessageNotificationProps
): JSX.Element | null {
  const { id, conversationId, toggleDeleteMessagesModal } = props;

  const onDeleteMessage = useCallback(() => {
    toggleDeleteMessagesModal({ conversationId, messageIds: [id] });
  }, [toggleDeleteMessagesModal, conversationId, id]);

  if (props.isDeleted) {
    // Tellomi (ADR-0081 §九 P5, erel 2026-10-19): deleted for everyone, it leaves nothing behind in the chat
    return null;
  }

  return <PinNoticeLive {...props} onDeleteMessage={onDeleteMessage} />;
}

function PinNoticeMenu({
  i18n,
  isSelectMode,
  onDeleteMessage,
  onReact,
  onReplyToMessage,
  children,
}: Readonly<{
  i18n: LocalizerType;
  isSelectMode: boolean;
  onDeleteMessage: () => void;
  onReact: (() => void) | null;
  onReplyToMessage: (() => void) | null;
  children: JSX.Element;
}>): JSX.Element {
  // Tellomi (pinned-messages.md 3.7): reactions, reply and delete — no copy, forward, pin, edit or select.
  return (
    <MessageContextMenu
      renderer="AxoContextMenu"
      disabled={isSelectMode}
      i18n={i18n}
      shouldShowAdditional
      onDeleteMessage={onDeleteMessage}
      onReplyToMessage={onReplyToMessage}
      onReact={onReact}
      onDebugMessage={null}
      onDownload={null}
      onEdit={null}
      onEndPoll={null}
      onRetryMessageSend={null}
      onRetryDeleteForEveryone={null}
      onCopy={null}
      onSelect={null}
      onForward={null}
      onMoreInfo={null}
      onPinMessage={null}
      onUnpinMessage={null}
    >
      <div inert={isSelectMode}>{children}</div>
    </MessageContextMenu>
  );
}

function useBodyRoot(
  containerElements: ReadonlyArray<RefObject<HTMLElement | null>>,
  name: string
): [HTMLDivElement | undefined, (onlyRemove?: boolean) => void] {
  const [root, setRoot] = useState<HTMLDivElement | undefined>(undefined);

  const toggle = useCallback(
    (onlyRemove = false): void => {
      if (root) {
        document.body.removeChild(root);
        setRoot(undefined);
        return;
      }
      if (!onlyRemove) {
        const div = document.createElement('div');
        document.body.appendChild(div);
        setRoot(div);
      }
    },
    [root]
  );

  useEffect(() => {
    if (!root) {
      return undefined;
    }
    return handleOutsideClick(
      target => {
        if (
          target instanceof Element &&
          target.closest('[data-fun-overlay]') != null
        ) {
          return true;
        }
        toggle(true);
        return true;
      },
      { containerElements: [root, ...containerElements], name }
    );
  }, [root, toggle, containerElements, name]);

  return [root, toggle];
}

const NO_CONTAINERS: ReadonlyArray<RefObject<HTMLElement | null>> = [];

function PinNoticeLive(
  props: Extract<PinnedMessageNotificationProps, { isDeleted: false }> & {
    onDeleteMessage: () => void;
  }
): JSX.Element {
  const {
    i18n,
    id,
    conversationId,
    isSelectMode,
    sender,
    pinMessage,
    tellomiSubject,
    reactions,
    selectedReaction,
    canReact,
    canReply,
    theme,
    containerElementRef,
    getPreferredBadge,
    onDeleteMessage,
    onScrollToPinnedMessage,
    reactToMessage,
    renderReactionPicker,
    setQuoteByMessageId,
  } = props;

  // Tellomi (ADR-0081 §4.4, pinned-messages.md 3.2): "×× pinned “first 15 characters…”", "You pinned a photo", or
  // "×× pinned a message" when it is gone — the same line as the left pane, notifications and the phones.
  const subject = (
    <UserText
      text={getTellomiPinSubjectText(i18n, tellomiSubject ?? undefined)}
    />
  );

  const onClick = useCallback(() => {
    onScrollToPinnedMessage(pinMessage);
  }, [onScrollToPinnedMessage, pinMessage]);

  const reactionsRef = useRef<HTMLDivElement | null>(null);
  const [viewerContainers] = useState(() => [reactionsRef]);
  const [pickerRoot, togglePicker] = useBodyRoot(
    NO_CONTAINERS,
    'PinnedMessageNotification.reactionPicker'
  );
  const [viewerRoot, toggleViewer] = useBodyRoot(
    viewerContainers,
    'PinnedMessageNotification.reactionViewer'
  );

  useScrollerLock({
    reason: 'PinnedMessageNotification reactionPicker',
    lockScrollWhen: pickerRoot != null,
    onUserInterrupt() {
      togglePicker(true);
    },
  });

  // The timeline's element, read when a popup opens (not while rendering), keeps the popups inside it.
  const [boundary, setBoundary] = useState<HTMLElement | undefined>(undefined);
  const popperPreventOverflowModifier =
    useCallback((): Partial<PreventOverflowModifier> => {
      return {
        name: 'preventOverflow',
        options: {
          altAxis: true,
          boundary,
          padding: { bottom: 16, left: 8, right: 8, top: 16 },
        },
      };
    }, [boundary]);

  const items = getTellomiPinNoticeMenuItems({ canReact, canReply });
  const handleReact = useCallback(() => {
    setBoundary(containerElementRef.current ?? undefined);
    togglePicker();
  }, [containerElementRef, togglePicker]);
  const handleToggleViewer = useCallback(
    (onlyRemove?: boolean) => {
      setBoundary(containerElementRef.current ?? undefined);
      toggleViewer(onlyRemove);
    },
    [containerElementRef, toggleViewer]
  );
  const handleReply = useCallback(() => {
    setQuoteByMessageId(conversationId, id);
  }, [setQuoteByMessageId, conversationId, id]);

  return (
    <Manager>
      <PinNoticeMenu
        i18n={i18n}
        isSelectMode={isSelectMode}
        onDeleteMessage={onDeleteMessage}
        onReact={items.includes('react') ? handleReact : null}
        onReplyToMessage={items.includes('reply') ? handleReply : null}
      >
        <Reference>
          {({ ref }) => (
            <div ref={ref}>
              <SystemMessage
                symbol="pin"
                expireTimer={props.expireTimer}
                expirationStartTimestamp={props.expirationStartTimestamp}
                contents={
                  sender.isMe ? (
                    <I18n
                      id="icu:TellomiPinNotice__YouPinned"
                      components={{ subject }}
                      i18n={i18n}
                    />
                  ) : (
                    <I18n
                      id="icu:TellomiPinNotice__SomeonePinned"
                      components={{
                        sender: <UserText text={sender.title} />,
                        subject,
                      }}
                      i18n={i18n}
                    />
                  )
                }
                button={
                  <Button
                    onClick={onClick}
                    size={ButtonSize.Small}
                    variant={ButtonVariant.SystemMessage}
                  >
                    {i18n('icu:PinnedMessageNotification__Button')}
                  </Button>
                }
              />
              {/* Tellomi (pinned-messages.md 3.7): reactions sit centered under the line; a tap shows who */}
              {reactions.length > 0 && (
                <div className={tw('flex justify-center')}>
                  <MessageReactions
                    ref={reactionsRef}
                    reactions={[...reactions]}
                    getPreferredBadge={getPreferredBadge}
                    i18n={i18n}
                    theme={theme}
                    outgoing={false}
                    toggleReactionViewer={handleToggleViewer}
                    reactionViewerRoot={viewerRoot ?? null}
                    popperPreventOverflowModifier={
                      popperPreventOverflowModifier
                    }
                  />
                </div>
              )}
            </div>
          )}
        </Reference>
      </PinNoticeMenu>
      {pickerRoot &&
        createPortal(
          <Popper
            placement="top"
            modifiers={[
              offsetDistanceModifier(4),
              popperPreventOverflowModifier(),
            ]}
          >
            {({ ref, style }) =>
              renderReactionPicker({
                ref,
                style,
                selected: selectedReaction,
                onClose: togglePicker,
                onPick: emoji => {
                  togglePicker(true);
                  reactToMessage(id, {
                    emoji,
                    remove: emoji === selectedReaction,
                  });
                },
              })
            }
          </Popper>,
          pickerRoot
        )}
    </Manager>
  );
}
