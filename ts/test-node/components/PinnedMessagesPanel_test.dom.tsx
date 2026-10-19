// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AxoProvider } from '../../axo/AxoProvider.dom.tsx';
import type { AxoIntl } from '../../axo/_internal/AxoIntl.dom.tsx';
import type { TellomiListedPin } from '../../components/conversation/pinned-messages/PinnedMessagesPanel.dom.tsx';
import { PinnedMessagesPanel } from '../../components/conversation/pinned-messages/PinnedMessagesPanel.dom.tsx';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../types/Util.std.ts';

// pinned-messages.md 3.3 / 3.5 (ADR-0081 P4): the list of pins — the order its messages come in, the line under a pin
// for me only, the arrow to go to a message, and the button at the bottom.
describe('<PinnedMessagesPanel /> (ADR-0081 P4)', () => {
  const i18n = ((key: string, params?: Record<string, unknown>) =>
    params == null
      ? `[${key}]`
      : `[${key} ${Object.entries(params)
          .map(([name, value]) => `${name}=${String(value)}`)
          .join(',')}]`) as unknown as LocalizerType;

  function pin(n: number, options: Partial<TellomiListedPin> = {}) {
    return {
      messageId: `m${n}`,
      isForMe: false,
      isOutgoing: false,
      receivedAtCounter: n,
      ...options,
    } satisfies TellomiListedPin;
  }

  function render(
    pins: ReadonlyArray<TellomiListedPin>,
    options: {
      bottomButton?: 'unpinAll' | 'hide';
      type?: 'group' | 'direct';
    } = {}
  ): string {
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
        <PinnedMessagesPanel
          i18n={i18n}
          conversation={
            {
              id: 'chat',
              type: options.type ?? 'direct',
            } as unknown as ConversationType
          }
          pins={pins}
          bottomButton={options.bottomButton ?? 'unpinAll'}
          onUnpinAll={noop}
          onHide={noop}
          onGoToMessage={noop}
          renderTimelineItem={props => (
            <p data-test-item={props.item.id}>
              {`${props.item.id} prev=${props.previousMessageId ?? '-'} next=${props.nextMessageId ?? '-'} oldest=${String(props.isOldestTimelineItem)}`}
            </p>
          )}
        />
      </AxoProvider>
    );
    return renderToStaticMarkup(element);
  }

  const count = (html: string, needle: string): number =>
    html.split(needle).length - 1;

  it('draws the pins in the order given, each knowing its neighbours, so the date separators work', () => {
    const html = render([pin(1), pin(2), pin(3)]);
    assert.isBelow(html.indexOf('m1 prev=-'), html.indexOf('m2 prev=m1'));
    assert.isBelow(html.indexOf('m2 prev=m1'), html.indexOf('m3 prev=m2'));
    assert.include(html, 'm1 prev=- next=m2 oldest=true');
    assert.include(html, 'm3 prev=m2 next=- oldest=false');
  });

  it('says "Only visible to you" under pins for me only, and nowhere else', () => {
    const html = render([pin(1), pin(2, { isForMe: true }), pin(3)]);
    assert.equal(count(html, 'icu:TellomiPinnedPanel__OnlyYou'), 1);
    assert.isBelow(
      html.indexOf('m2 prev=m1'),
      html.indexOf('icu:TellomiPinnedPanel__OnlyYou'),
      'under the message'
    );
    assert.isBelow(
      html.indexOf('icu:TellomiPinnedPanel__OnlyYou'),
      html.indexOf('m3 prev=m2'),
      'above the next one'
    );
  });

  it('puts the line on the side of the bubble', () => {
    const mine = render([pin(1, { isForMe: true, isOutgoing: true })]);
    const theirs = render([pin(1, { isForMe: true, isOutgoing: false })]);
    assert.match(mine, /justify-end[^>]*>\[icu:TellomiPinnedPanel__OnlyYou/);
    assert.match(
      theirs,
      /justify-start[^>]*>\[icu:TellomiPinnedPanel__OnlyYou/
    );
  });

  it('indents a received pin for me only in a group, past the avatar', () => {
    const group = render([pin(1, { isForMe: true })], { type: 'group' });
    const direct = render([pin(1, { isForMe: true })], { type: 'direct' });
    assert.include(group, 'padding-inline-start:52px');
    assert.notInclude(direct, 'padding-inline-start:52px');
  });

  it('has a way to go to every message, on the side away from the bubble', () => {
    const html = render([pin(1), pin(2, { isOutgoing: true })]);
    assert.equal(
      count(html, 'icu:PinnedMessagesBar__ActionsMenu__GoToMessage'),
      2
    );
    assert.include(html, 'inset-e-1');
    assert.include(html, 'inset-s-1');
  });

  it('has "Unpin all" or "Hide pinned messages" at the bottom, and nothing without pins', () => {
    assert.include(
      render([pin(1)], { bottomButton: 'unpinAll' }),
      'icu:TellomiPinnedPanel__UnpinAll'
    );
    assert.notInclude(
      render([pin(1)], { bottomButton: 'unpinAll' }),
      'icu:TellomiPinnedPanel__Hide'
    );
    assert.include(
      render([pin(1)], { bottomButton: 'hide' }),
      'icu:TellomiPinnedPanel__Hide'
    );
    assert.notInclude(
      render([pin(1)], { bottomButton: 'hide' }),
      'icu:TellomiPinnedPanel__UnpinAll'
    );
    const empty = render([]);
    assert.notInclude(empty, 'icu:TellomiPinnedPanel__UnpinAll');
    assert.notInclude(empty, 'icu:TellomiPinnedPanel__Hide');
  });
});
