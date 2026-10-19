// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ForwardedRef, ReactNode, JSX } from 'react';
import { forwardRef, memo, useCallback, useMemo, useState } from 'react';
import { Tabs } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import type { LocalizerType } from '../../../types/I18N.std.ts';
import { tw } from '../../../axo/tw.dom.tsx';
import { AxoIconButton } from '../../../axo/AxoIconButton.dom.tsx';
import { AxoAlertDialog } from '../../../axo/AxoAlertDialog.dom.tsx';
import { AriaClickable } from '../../../axo/AriaClickable.dom.tsx';
import { UserText } from '../../UserText.dom.tsx';
import type { PinnedMessageId } from '../../../types/PinnedMessage.std.ts';
import {
  MessageTextRenderer,
  RenderLocation,
} from '../MessageTextRenderer.dom.tsx';
import type { HydratedBodyRangesType } from '../../../types/BodyRange.std.ts';
import { AxoSymbol } from '../../../axo/AxoSymbol.dom.tsx';
import { missingCaseError } from '../../../util/missingCaseError.std.ts';
import { stripNewlinesForLeftPane } from '../../../util/stripNewlinesForLeftPane.std.ts';
import { usePrevious } from '../../../hooks/usePrevious.std.ts';
import {
  getTellomiPinnedBarButton,
  getTellomiPinnedBarCloseAction,
  getTellomiPinnedBarSegments,
  getTellomiPinnedBarTitle,
} from '../../../util/tellomiPinnedBar.std.ts';
import type { TellomiPinnedBarSegments } from '../../../util/tellomiPinnedBar.std.ts';

enum Direction {
  None = 0,
  Backwards = -1,
  Forwards = 1,
}

export type PinMessageText = Readonly<{
  body: string;
  bodyRanges: HydratedBodyRangesType;
}>;

export type PinMessageAttachment = Readonly<
  // Tellomi (tellomi/tellomi#1263, spec R-1): `tellomiSpoiler` keeps the thumbnail blurred.
  | { type: 'image'; url: string | null; tellomiSpoiler?: boolean }
  | { type: 'video'; url: string | null; tellomiSpoiler?: boolean }
  | { type: 'voiceMessage' }
  | { type: 'gif' }
  | { type: 'file'; name: string | null }
>;

export type PinMessageContact = Readonly<{
  name: string | null;
}>;

export type PinMessagePoll = Readonly<{
  question: string;
}>;

export type PinMessage = Readonly<{
  id: string;
  sentAtTimestamp: number;
  receivedAtCounter: number;
  text: PinMessageText | null;
  attachment: PinMessageAttachment | null;
  contact: PinMessageContact | null;
  payment: boolean;
  poll: PinMessagePoll | null;
  sticker: boolean;
  viewOnceMedia: boolean;
}>;

export type PinSender = Readonly<{
  id: string;
  title: string;
  isMe: boolean;
}>;

export type Pin = Readonly<{
  id: PinnedMessageId;
  sender: PinSender;
  message: PinMessage;
}>;

export type PinnedMessagesBarProps = Readonly<{
  i18n: LocalizerType;
  // Tellomi (pinned-messages.md 3.4): the oldest message first, not the oldest pin first.
  pins: ReadonlyArray<Pin>;
  current: PinnedMessageId | null;
  onCurrentChange: (current: PinnedMessageId) => void;
  onPinGoTo: (messageId: string) => void;
  // Tellomi: the × on a bar with one pin, for someone who can unpin (after asking; "Undo" for 5 seconds).
  onPinUnpin: (messageId: string) => void;
  // Tellomi: the × on a bar with one pin, for someone who can't unpin: only hides the bar on this device.
  onPinHide: () => void;
  onPinsShowAll: () => void;
  canUnpin: boolean;
}>;

export const PinnedMessagesBar = memo(function PinnedMessagesBar(
  props: PinnedMessagesBarProps
) {
  const { i18n, pins, current, onCurrentChange } = props;

  // oxlint-disable-next-line react/preserve-manual-memoization
  const currentEntry = useMemo(() => {
    if (current == null) {
      return null;
    }

    for (const [index, value] of pins.entries()) {
      if (value.id === current) {
        return { index, value };
      }
    }

    throw new Error(
      `Current pin ${current} is missing from pins (${pins.length})`
    );
  }, [pins, current]);

  const currentIndex = currentEntry?.index;
  const previousIndex = usePrevious(currentIndex);

  const direction = useMemo(() => {
    if (previousIndex == null || currentIndex == null) {
      return Direction.None;
    }

    if (previousIndex < currentIndex) {
      return Direction.Forwards;
    }

    if (previousIndex > currentIndex) {
      return Direction.Backwards;
    }

    return Direction.None;
  }, [currentIndex, previousIndex]);

  const handleValueChange = useCallback(
    (value: string) => {
      onCurrentChange(Number(value) as PinnedMessageId);
    },
    [onCurrentChange]
  );

  return (
    <Bar i18n={i18n} pinsCount={props.pins.length}>
      {currentEntry != null && (
        <Tabs.Root
          orientation="vertical"
          value={String(props.current)}
          onValueChange={handleValueChange}
          asChild
          activationMode="manual"
        >
          <Row>
            <TabsList
              i18n={i18n}
              pins={props.pins}
              current={props.current}
              segments={getTellomiPinnedBarSegments(
                currentEntry.index,
                props.pins.length
              )}
            />
            <ContentWrapper>
              {props.pins.map((pin, pinIndex) => {
                return (
                  <Tabs.Content
                    key={pin.id}
                    tabIndex={-1}
                    value={String(pin.id)}
                    asChild
                  >
                    <Content
                      i18n={i18n}
                      pin={pin}
                      title={getTitleText(i18n, pinIndex, props.pins.length)}
                      direction={direction}
                      pinsCount={props.pins.length}
                    />
                  </Tabs.Content>
                );
              })}
            </ContentWrapper>
            <HiddenTrigger
              i18n={i18n}
              currentPin={currentEntry.value}
              onPinGoTo={props.onPinGoTo}
            />
            <SideButton
              i18n={i18n}
              pin={currentEntry.value}
              pinsCount={props.pins.length}
              canUnpin={props.canUnpin}
              onPinUnpin={props.onPinUnpin}
              onPinHide={props.onPinHide}
              onPinsShowAll={props.onPinsShowAll}
            />
          </Row>
        </Tabs.Root>
      )}
    </Bar>
  );
});

function Bar(props: {
  i18n: LocalizerType;
  pinsCount: number;
  children: ReactNode;
}) {
  const { i18n } = props;
  return (
    <AnimatePresence initial={false}>
      {props.pinsCount > 0 && (
        <motion.section
          aria-label={i18n('icu:PinnedMessagesBar__AccessibilityLabel', {
            pinsCount: props.pinsCount,
          })}
          initial="hide"
          animate="show"
          variants={{
            hide: { height: 0 },
            show: { height: 'auto' },
          }}
          transition={{
            type: 'spring',
            stiffness: 473,
            damping: 40,
            mass: 1,
            when: 'beforeChildren',
          }}
          className={tw(
            'overflow-clip border-t-[0.5px] border-t-primary',
            'bg-(--axo-color-legacy-conversation-header-bg)'
          )}
        >
          <motion.div
            variants={{
              hide: { opacity: 0 },
              show: { opacity: 1 },
            }}
          >
            {props.children}
          </motion.div>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

function Row(props: { children: ReactNode }) {
  return (
    <AriaClickable.Root
      className={tw(
        'contain-strict',
        'flex h-14 items-center pe-3',
        'rounded-xs',
        'outline-none data-focused:axo-focus-ring'
      )}
    >
      {props.children}
    </AriaClickable.Root>
  );
}

function HiddenTrigger(props: {
  i18n: LocalizerType;
  currentPin: Pin;
  onPinGoTo: (messageId: string) => void;
}) {
  const { i18n, currentPin, onPinGoTo } = props;

  const handlePinGoToCurrent = useCallback(() => {
    onPinGoTo(currentPin.message.id);
  }, [onPinGoTo, currentPin]);

  return (
    <AriaClickable.HiddenTrigger
      label={i18n(
        'icu:PinnedMessagesBar__GoToMessageClickableArea__AccessibilityLabel'
      )}
      onClick={handlePinGoToCurrent}
    />
  );
}

function ContentWrapper(props: { children: ReactNode }) {
  return (
    <div className={tw('relative size-full min-w-0 flex-1')}>
      {props.children}
    </div>
  );
}

const FADE_PX = 8;

// Tellomi (pinned-messages.md 3.4): at most three segments are drawn, the shown one in the middle where it can be; the
// side that has more pins fades out.
function getSegmentsMask(
  segments: TellomiPinnedBarSegments
): string | undefined {
  if (!segments.fadeTop && !segments.fadeBottom) {
    return undefined;
  }
  const top = segments.fadeTop
    ? `transparent 0, black ${FADE_PX}px`
    : 'black 0';
  const bottom = segments.fadeBottom
    ? `black calc(100% - ${FADE_PX}px), transparent 100%`
    : 'black 100%';
  return `linear-gradient(to bottom, ${top}, ${bottom})`;
}

function TabsList(props: {
  i18n: LocalizerType;
  pins: ReadonlyArray<Pin>;
  current: PinnedMessageId | null;
  segments: TellomiPinnedBarSegments;
}) {
  const { i18n, segments } = props;

  if (props.pins.length < 2) {
    return null;
  }

  const mask = getSegmentsMask(segments);

  return (
    <AriaClickable.SubWidget>
      <Tabs.List asChild>
        <motion.div
          className={tw('flex h-full flex-col py-2.5')}
          style={mask == null ? undefined : { maskImage: mask }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {props.pins
            .slice(segments.first, segments.first + segments.count)
            .map((pin, offset) => {
              return (
                <TabTrigger
                  key={pin.id}
                  i18n={i18n}
                  pin={pin}
                  pinNumber={segments.first + offset + 1}
                  pinsCount={segments.count}
                />
              );
            })}
        </motion.div>
      </Tabs.List>
    </AriaClickable.SubWidget>
  );
}

function TabTrigger(props: {
  i18n: LocalizerType;
  pin: Pin;
  pinNumber: number;
  pinsCount: number;
}) {
  const { i18n } = props;
  return (
    <Tabs.Trigger
      value={String(props.pin.id)}
      aria-label={i18n('icu:PinnedMessagesBar__Tab__AccessibilityLabel', {
        pinNumber: props.pinNumber,
      })}
      className={tw(
        'group flex-1 px-[7px] outline-none',
        props.pinsCount === 3 ? 'py-px' : 'py-0.5'
      )}
    >
      <span
        className={tw(
          'block h-full w-0.5 rounded-full',
          'bg-(--axo-color-label-disabled)',
          'group-data-[state=active]:bg-(--axo-color-label-primary)',
          'keyboard-mode:group-focus:axo-focus-ring'
        )}
      />
    </Tabs.Trigger>
  );
}

// Tellomi (pinned-messages.md 3.4): the title says which pin this is, not who sent it.
function getTitleText(
  i18n: LocalizerType,
  index: number,
  size: number
): string {
  const title = getTellomiPinnedBarTitle(index, size);
  switch (title.kind) {
    case 'pinned':
      return i18n('icu:TellomiPinnedBar__Title--Pinned');
    case 'previous':
      return i18n('icu:TellomiPinnedBar__Title--Previous');
    case 'numbered':
      return i18n('icu:TellomiPinnedBar__Title--Numbered', {
        number: title.number,
      });
    default:
      throw missingCaseError(title);
  }
}

type ContentProps = Readonly<{
  i18n: LocalizerType;
  pin: Pin;
  title: string;
  direction: Direction;
  pinsCount: number;
}>;

const Content = forwardRef(function Content(
  { i18n, pin, title, direction, pinsCount, ...forwardedProps }: ContentProps,
  ref: ForwardedRef<HTMLDivElement>
): JSX.Element {
  const thumbnailUrl = useMemo(() => {
    return getThumbnailUrl(pin.message);
  }, [pin.message]);
  const { attachment } = pin.message;
  const isTellomiSpoiler =
    (attachment?.type === 'image' || attachment?.type === 'video') &&
    attachment.tellomiSpoiler === true;

  return (
    <div
      ref={ref}
      {...forwardedProps}
      className={tw(
        'absolute inset-0',
        'flex h-full flex-row items-center py-2.5',
        pinsCount === 1 && 'ps-4',
        direction === Direction.Forwards &&
          tw(
            'data-[state=active]:animate-enter data-[state=active]:animate-translate-y-[100%]',
            'data-[state=inactive]:animate-exit data-[state=inactive]:animate-translate-y-[-100%]',
            // Use !important to override Radix'x logic for preventing mount animations
            // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
            'animate-duration-300!'
          ),
        direction === Direction.Backwards &&
          tw(
            'data-[state=active]:animate-enter data-[state=active]:animate-translate-y-[-100%]',
            'data-[state=inactive]:animate-exit data-[state=inactive]:animate-translate-y-[100%]',
            // Use !important to override Radix'x logic for preventing mount animations
            // oxlint-disable-next-line better-tailwindcss/no-restricted-classes
            'animate-duration-300!'
          )
      )}
    >
      {thumbnailUrl != null && (
        <ImageThumbnail
          url={thumbnailUrl}
          isTellomiSpoiler={isTellomiSpoiler}
        />
      )}
      <div className={tw('min-w-0 flex-1')}>
        <h1 className={tw('type-body-small font-semibold text-primary')}>
          {title}
        </h1>
        <p className={tw('me-2 truncate type-body-medium text-primary')}>
          <MessagePreview i18n={i18n} message={pin.message} />
        </p>
      </div>
    </div>
  );
});

// Tellomi (pinned-messages.md 3.4): the button on the right is the list of pins when there are several, and × when there
// is one. The × takes the pin back when this person can (after asking; the toast then offers "Undo" for 5 seconds), and
// otherwise only hides the bar on this device.
function SideButton(props: {
  i18n: LocalizerType;
  pin: Pin;
  pinsCount: number;
  canUnpin: boolean;
  onPinUnpin: (messageId: string) => void;
  onPinHide: () => void;
  onPinsShowAll: () => void;
}) {
  const { i18n, pin, canUnpin, onPinUnpin, onPinHide, onPinsShowAll } = props;
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleClose = useCallback(() => {
    if (getTellomiPinnedBarCloseAction(canUnpin) === 'unpin') {
      setConfirmOpen(true);
    } else {
      onPinHide();
    }
  }, [canUnpin, onPinHide]);

  const handleConfirm = useCallback(() => {
    onPinUnpin(pin.message.id);
  }, [onPinUnpin, pin.message.id]);

  if (getTellomiPinnedBarButton(props.pinsCount) === 'list') {
    return (
      <AriaClickable.SubWidget>
        <AxoIconButton.Root
          variant="implied-secondary"
          size="md"
          symbol="list-bullet"
          label={i18n('icu:TellomiPinnedBar__ShowAll__AccessibilityLabel')}
          onClick={onPinsShowAll}
        />
      </AriaClickable.SubWidget>
    );
  }

  return (
    <AriaClickable.SubWidget>
      <AxoIconButton.Root
        variant="implied-secondary"
        size="md"
        symbol="x"
        label={
          canUnpin
            ? i18n('icu:TellomiPinnedBar__Unpin__AccessibilityLabel')
            : i18n('icu:TellomiPinnedBar__Hide__AccessibilityLabel')
        }
        onClick={handleClose}
      />
      <AxoAlertDialog.Root open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AxoAlertDialog.Content escape="cancel-is-noop">
          <AxoAlertDialog.Body>
            <AxoAlertDialog.Title>
              {i18n('icu:TellomiPinnedBar__UnpinConfirm__Title')}
            </AxoAlertDialog.Title>
          </AxoAlertDialog.Body>
          <AxoAlertDialog.Footer>
            <AxoAlertDialog.Cancel />
            <AxoAlertDialog.Action
              variant="strong-primary"
              onClick={handleConfirm}
            >
              {i18n('icu:TellomiPinnedBar__UnpinConfirm__Unpin')}
            </AxoAlertDialog.Action>
          </AxoAlertDialog.Footer>
        </AxoAlertDialog.Content>
      </AxoAlertDialog.Root>
    </AriaClickable.SubWidget>
  );
}

function getThumbnailUrl(message: PinMessage): string | null {
  // Never render a thumbnail if its view-once media
  if (message.viewOnceMedia) {
    return null;
  }
  if (message.attachment == null) {
    return null;
  }
  if (
    message.attachment.type === 'image' ||
    message.attachment.type === 'video'
  ) {
    return message.attachment.url ?? null;
  }
  return null;
}

function ImageThumbnail(props: { url: string; isTellomiSpoiler: boolean }) {
  // Tellomi (tellomi/tellomi#1263, spec R-1): like a quote, the pinned bar never shows a covered image /
  // video (Telegram: the pinned panel's thumbnail is blurred for spoilers).
  if (props.isTellomiSpoiler) {
    return (
      <span
        className={tw('me-2 size-8 shrink-0 overflow-hidden rounded-[10px]')}
      >
        <img
          alt=""
          src={props.url}
          className={tw('size-full object-cover')}
          style={TELLOMI_SPOILER_THUMBNAIL_STYLE}
        />
      </span>
    );
  }
  return (
    <img
      alt=""
      src={props.url}
      className={tw('me-2 size-8 rounded-[10px] object-cover')}
    />
  );
}

const TELLOMI_SPOILER_THUMBNAIL_STYLE = {
  filter: 'blur(6px) brightness(0.85)',
  // Larger than the box so the blur's soft edge stays outside.
  transform: 'scale(1.3)',
} as const;

type PreviewIcon = Readonly<{
  symbol: AxoSymbol.Name;
  label: string;
}>;

type Preview = Readonly<{
  icon: PreviewIcon | null;
  text: ReactNode | null;
}>;

function getMessagePreview(i18n: LocalizerType, message: PinMessage): Preview {
  // Note: The order of this function matters, once something higher-up assigns
  // `icon` or `text` nothing else should override it.
  let icon: PreviewIcon | null = null;
  let text: ReactNode | null = null;

  // 1. View-once media is highest priority, no other icons or text should be shown
  if (message.viewOnceMedia) {
    text ??= i18n('icu:PinnedMessagesBar__MessagePreview__Text--ViewOnceMedia');
    icon ??= {
      symbol: 'viewonce',
      label: i18n(
        'icu:PinnedMessagesBar__MessagePreview__SymbolLabel--ViewOnceMedia'
      ),
    };
  }

  // 2. The message body should take priority over other generic text labels
  if (message.text != null) {
    text ??= <MessageTextPreview i18n={i18n} text={message.text} />;
  }

  // 3. Check specific types of messages (before checking attachments)
  if (message.payment) {
    text ??= i18n('icu:PinnedMessagesBar__MessagePreview__Text--Payment');
    icon ??= {
      symbol: 'creditcard',
      label: i18n(
        'icu:PinnedMessagesBar__MessagePreview__SymbolLabel--Payment'
      ),
    };
  } else if (message.poll != null) {
    text ??= <UserText text={message.poll.question} />;
    icon ??= {
      symbol: 'poll',
      label: i18n('icu:PinnedMessagesBar__MessagePreview__SymbolLabel--Poll'),
    };
  } else if (message.sticker) {
    text ??= i18n('icu:PinnedMessagesBar__MessagePreview__Text--Sticker');
    icon ??= {
      symbol: 'sticker',
      label: i18n(
        'icu:PinnedMessagesBar__MessagePreview__SymbolLabel--Sticker'
      ),
    };
  } else if (message.contact != null) {
    const name = message.contact.name ?? i18n('icu:unknownContact');
    text ??= <UserText text={name} />;
    icon ??= {
      symbol: 'person-circle',
      label: name,
    };
  }

  // 4. Check attachments (make sure to check types like sticker/contact first)
  if (message.attachment != null) {
    if (message.attachment.type === 'image') {
      text ??= i18n('icu:PinnedMessagesBar__MessagePreview__Text--Photo');
    } else if (message.attachment.type === 'video') {
      text ??= i18n('icu:PinnedMessagesBar__MessagePreview__Text--Video');
    } else if (message.attachment.type === 'voiceMessage') {
      text ??= i18n(
        'icu:PinnedMessagesBar__MessagePreview__Text--VoiceMessage'
      );
      icon ??= {
        symbol: 'audio',
        label: i18n(
          'icu:PinnedMessagesBar__MessagePreview__SymbolLabel--VoiceMessage'
        ),
      };
    } else if (message.attachment.type === 'gif') {
      text ??= i18n('icu:PinnedMessagesBar__MessagePreview__Text--Gif');
      icon ??= {
        symbol: 'gif',
        label: i18n('icu:PinnedMessagesBar__MessagePreview__SymbolLabel--Gif'),
      };
    } else if (message.attachment.type === 'file') {
      text ??= <UserText text={message.attachment.name ?? ''} />;
      icon ??= {
        symbol: 'file',
        label: i18n('icu:PinnedMessagesBar__MessagePreview__SymbolLabel--File'),
      };
    } else {
      throw missingCaseError(message.attachment);
    }
  }

  return { icon, text };
}

function MessagePreview(props: { i18n: LocalizerType; message: PinMessage }) {
  const { i18n, message } = props;

  const preview = useMemo(() => {
    return getMessagePreview(i18n, message);
  }, [i18n, message]);

  return (
    <>
      {preview.icon != null && (
        <>
          <AxoSymbol.InlineGlyph
            symbol={preview.icon.symbol}
            label={null}
          />{' '}
        </>
      )}
      {preview.text}
    </>
  );
}

function MessageTextPreview(props: {
  i18n: LocalizerType;
  text: PinMessageText;
}) {
  const { i18n } = props;

  const messagePreview = useMemo(() => {
    return stripNewlinesForLeftPane(props.text.body);
  }, [props.text.body]);

  return (
    <MessageTextRenderer
      bodyRanges={props.text.bodyRanges}
      direction={undefined}
      disableLinks
      jumboEmojiSize={null}
      i18n={i18n}
      isSpoilerExpanded={{}}
      messageText={messagePreview}
      originalMessageText={props.text.body}
      onExpandSpoiler={undefined}
      onMentionTrigger={() => null}
      renderLocation={RenderLocation.PinnedMessagesBar}
      textLength={props.text.body.length}
    />
  );
}
