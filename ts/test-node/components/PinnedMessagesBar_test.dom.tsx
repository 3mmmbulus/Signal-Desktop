// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { AxoProvider } from '../../axo/AxoProvider.dom.tsx';
import type { AxoIntl } from '../../axo/_internal/AxoIntl.dom.tsx';
import type { Pin } from '../../components/conversation/pinned-messages/PinnedMessagesBar.dom.tsx';
import { PinnedMessagesBar } from '../../components/conversation/pinned-messages/PinnedMessagesBar.dom.tsx';
import type { PinnedMessageId } from '../../types/PinnedMessage.std.ts';
import type { LocalizerType } from '../../types/Util.std.ts';

// pinned-messages.md 3.4 (ADR-0081 P3): what the bar looks like — its title, the line on its left, the button on its
// right — for one, two and many pins. The same cases as the phones' bar tests.
describe('<PinnedMessagesBar /> (ADR-0081 P3)', () => {
  // The bar animates with `motion`, which listens for window resizes while rendering; the node test environment's
  // `window` has no listeners to add to.
  type Listening = {
    addEventListener?: () => void;
    removeEventListener?: () => void;
  };
  const testWindow = globalThis.window as unknown as Listening;
  let addedListeners = false;
  before(() => {
    if (testWindow.addEventListener == null) {
      testWindow.addEventListener = () => undefined;
      testWindow.removeEventListener = () => undefined;
      addedListeners = true;
    }
  });
  after(() => {
    if (addedListeners) {
      delete testWindow.addEventListener;
      delete testWindow.removeEventListener;
    }
  });

  const i18n = ((key: string, params?: Record<string, unknown>) =>
    params == null
      ? `[${key}]`
      : `[${key} ${Object.entries(params)
          .map(([name, value]) => `${name}=${String(value)}`)
          .join(',')}]`) as unknown as LocalizerType;

  function pin(n: number): Pin {
    return {
      id: n as PinnedMessageId,
      sender: { id: `c${n}`, title: `Sender ${n}`, isMe: false },
      message: {
        id: `m${n}`,
        sentAtTimestamp: n,
        receivedAtCounter: n,
        text: null,
        attachment: null,
        contact: null,
        payment: false,
        poll: { question: `Question ${n}` },
        sticker: false,
        viewOnceMedia: false,
      },
    };
  }

  function render(
    pinsCount: number,
    currentNumber: number,
    options: { canUnpin?: boolean } = {}
  ): string {
    const pins = Array.from({ length: pinsCount }, (_, i) => pin(i + 1));
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
        <PinnedMessagesBar
          i18n={i18n}
          pins={pins}
          current={currentNumber as PinnedMessageId}
          onCurrentChange={noop}
          onPinGoTo={noop}
          onPinUnpin={noop}
          onPinHide={noop}
          onPinsShowAll={noop}
          canUnpin={options.canUnpin ?? true}
        />
      </AxoProvider>
    );
    return renderToStaticMarkup(element);
  }

  const count = (html: string, needle: string): number =>
    html.split(needle).length - 1;

  const TITLE = 'icu:TellomiPinnedBar__Title--';
  const SHOW_ALL = '[icu:TellomiPinnedBar__ShowAll__AccessibilityLabel]';
  const UNPIN = '[icu:TellomiPinnedBar__Unpin__AccessibilityLabel]';
  const HIDE = '[icu:TellomiPinnedBar__Hide__AccessibilityLabel]';

  it('one pin: the title says "Pinned message", no line, and a × that unpins', () => {
    const html = render(1, 1);
    assert.strictEqual(count(html, `${TITLE}Pinned]`), 1);
    assert.strictEqual(count(html, 'role="tab"'), 0, 'no line for one pin');
    assert.strictEqual(count(html, UNPIN), 1);
    assert.strictEqual(count(html, SHOW_ALL), 0);
    assert.include(html, 'Question 1', 'what was pinned is shown');
    assert.notInclude(html, 'Sender 1', 'not who sent it');
  });

  it('one pin without permission: the × only hides the bar', () => {
    const html = render(1, 1, { canUnpin: false });
    assert.strictEqual(count(html, HIDE), 1);
    assert.strictEqual(count(html, UNPIN), 0);
  });

  it('two pins: the older one is "Previous pinned message", the newer "Pinned message", and the button is the list', () => {
    const older = render(2, 1);
    assert.strictEqual(count(older, `${TITLE}Previous]`), 1);
    assert.strictEqual(
      count(older, `${TITLE}Pinned]`),
      0,
      'only the shown pin'
    );
    const newer = render(2, 2);
    assert.strictEqual(count(newer, `${TITLE}Pinned]`), 1);
    assert.strictEqual(count(newer, `${TITLE}Previous]`), 0);
    assert.strictEqual(count(older, 'role="tab"'), 2);
    assert.strictEqual(count(older, SHOW_ALL), 1);
    assert.strictEqual(count(older, UNPIN), 0);
    assert.strictEqual(count(older, HIDE), 0);
  });

  it('more than two pins: numbered from the oldest, the newest has no number', () => {
    const fourth = render(7, 4);
    assert.include(fourth, `${TITLE}Numbered number=4]`);
    assert.strictEqual(count(fourth, SHOW_ALL), 1);
    assert.include(render(7, 1), `${TITLE}Numbered number=1]`);
    assert.include(render(7, 6), `${TITLE}Numbered number=6]`);
    const newest = render(7, 7);
    assert.notInclude(newest, `${TITLE}Numbered`);
    assert.strictEqual(count(newest, `${TITLE}Pinned]`), 1);
    assert.include(render(3, 1), `${TITLE}Numbered number=1]`);
  });

  it('the line draws at most three segments around the shown pin, fading the side that has more', () => {
    const middle = render(7, 4);
    assert.strictEqual(count(middle, 'role="tab"'), 3);
    assert.include(
      middle,
      'mask-image:linear-gradient(to bottom, transparent 0'
    );
    assert.include(middle, 'transparent 100%', 'fades at both ends');

    const oldest = render(7, 1);
    assert.strictEqual(count(oldest, 'role="tab"'), 3);
    assert.notInclude(oldest, 'transparent 0', 'nothing above the oldest');
    assert.include(oldest, 'transparent 100%', 'more below it');

    const newest = render(7, 7);
    assert.strictEqual(count(newest, 'role="tab"'), 3);
    assert.include(newest, 'transparent 0');
    assert.notInclude(newest, 'transparent 100%', 'nothing below the newest');

    const three = render(3, 2);
    assert.strictEqual(count(three, 'role="tab"'), 3);
    assert.notInclude(three, 'mask-image', 'three fit, nothing fades');
  });
});
