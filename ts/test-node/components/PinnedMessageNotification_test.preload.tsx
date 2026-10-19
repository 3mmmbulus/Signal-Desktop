// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { createRef } from 'react';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AxoProvider } from '../../axo/AxoProvider.dom.tsx';
import type { AxoIntl } from '../../axo/_internal/AxoIntl.dom.tsx';
import type { PinnedMessageNotificationData } from '../../components/conversation/pinned-messages/PinnedMessageNotification.dom.tsx';
import { PinnedMessageNotification } from '../../components/conversation/pinned-messages/PinnedMessageNotification.dom.tsx';
import type { Reaction } from '../../components/conversation/ReactionViewer.dom.tsx';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { PinMessageData } from '../../model-types.d.ts';
import type { Emoji } from '../../axo/emoji.std.ts';
import {
  createScrollerLock,
  ScrollerLockContext,
} from '../../hooks/useScrollLock.dom.tsx';
import i18n from '../util/i18n.node.ts';

// pinned-messages.md 3.7 (ADR-0081 §九 P5): the chat event's reactions sit centered under it, and one deleted for
// everyone reads as a deleted message.
describe('<PinnedMessageNotification /> (ADR-0081 P5)', () => {
  const them = {
    id: 'them',
    isMe: false,
    title: 'Ann',
  } as unknown as ConversationType;
  const me = {
    id: 'me',
    isMe: true,
    title: 'Me',
  } as unknown as ConversationType;

  function render(data: PinnedMessageNotificationData): string {
    const noop = () => undefined;
    const element: ReactNode = (
      <AxoProvider
        resolvedAppLocale={{
          tag: 'en' as AxoIntl.AppLocaleTag,
          direction: 'ltr',
        }}
        systemPreferredLanguages={new Set()}
        messages={{} as AxoIntl.Messages}
      >
        <ScrollerLockContext.Provider value={createScrollerLock('test', noop)}>
          <PinnedMessageNotification
            {...data}
            i18n={i18n}
            id="notice"
            conversationId="chat"
            isSelectMode={false}
            theme={'light' as never}
            containerElementRef={createRef<HTMLElement>()}
            getPreferredBadge={() => undefined}
            onScrollToPinnedMessage={noop}
            reactToMessage={noop}
            renderReactionPicker={() => <div />}
            setQuoteByMessageId={noop}
            toggleDeleteMessagesModal={noop}
          />
        </ScrollerLockContext.Provider>
      </AxoProvider>
    );
    return renderToStaticMarkup(element);
  }

  function live(
    options: Partial<
      Extract<PinnedMessageNotificationData, { isDeleted: false }>
    > = {}
  ): PinnedMessageNotificationData {
    return {
      isDeleted: false,
      sender: them,
      expireTimer: null,
      expirationStartTimestamp: null,
      pinMessage: {} as PinMessageData,
      tellomiSubject: null,
      reactions: [],
      selectedReaction: undefined,
      canReact: true,
      canReply: true,
      ...options,
    };
  }

  it('shows the line and the button, with no reaction row when nobody reacted', () => {
    const html = render(live());
    assert.include(html, 'Ann');
    assert.include(html, 'a message');
    assert.include(html, i18n('icu:PinnedMessageNotification__Button'));
    assert.notInclude(html, 'module-message__reactions');
  });

  it('shows the reactions centered under the line', () => {
    const reaction = {
      emoji: '👍' as Emoji.Variant,
      timestamp: 1,
      from: { id: 'them', isMe: false, title: 'Ann' },
    } as unknown as Reaction;
    const html = render(live({ reactions: [reaction] }));
    assert.include(html, 'module-message__reactions');
    assert.match(
      html,
      /class="[^"]*justify-center[^"]*"><div[^>]*module-message__reactions/
    );
    assert.include(
      html,
      i18n('icu:Message__reaction-emoji-label--single', {
        title: 'Ann',
        emoji: '👍',
      })
    );
  });

  it('reads as a deleted message once deleted for everyone, with no button and no reactions', () => {
    const theirs = render({
      isDeleted: true,
      sender: them,
      expireTimer: null,
      expirationStartTimestamp: null,
    });
    assert.include(theirs, 'Ann');
    assert.include(theirs, 'deleted this message');
    assert.notInclude(theirs, i18n('icu:PinnedMessageNotification__Button'));
    assert.notInclude(theirs, 'pinned');

    const mine = render({
      isDeleted: true,
      sender: me,
      expireTimer: null,
      expirationStartTimestamp: null,
    });
    assert.include(mine, i18n('icu:message--deletedForEveryone--outgoing'));
  });
});
