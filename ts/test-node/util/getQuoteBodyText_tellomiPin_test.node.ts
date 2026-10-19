// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { MessageAttributesType } from '../../model-types.d.ts';
import { getQuoteBodyText } from '../../util/getQuoteBodyText.std.ts';
import i18n from './i18n.node.ts';

// ADR-0081 §九 P5, pinned-messages.md 3.7: a reply to a pin's chat event quotes its line, in the third person.
describe('getQuoteBodyText for a pin notice', () => {
  const notice = {
    type: 'pinned-message-notification',
    tellomiPinSubject: { kind: 'text', text: 'lunch at noon' },
  } as unknown as MessageAttributesType;

  it('quotes "×× pinned “…”" with the name of whoever pinned — mine too', () => {
    assert.strictEqual(
      getQuoteBodyText({
        messageAttributes: notice,
        id: null,
        i18n,
        tellomiPinnerTitle: 'Ann',
      }),
      'Ann pinned “lunch at noon”'
    );
  });

  it('quotes nothing special once it was deleted for everyone, or for any other message', () => {
    assert.notInclude(
      getQuoteBodyText({
        messageAttributes: { ...notice, deletedForEveryone: true },
        id: null,
        i18n,
        tellomiPinnerTitle: 'Ann',
      }) ?? '',
      'pinned'
    );
    assert.strictEqual(
      getQuoteBodyText({
        messageAttributes: {
          type: 'incoming',
          body: 'hi',
        } as unknown as MessageAttributesType,
        id: null,
        i18n,
        tellomiPinnerTitle: 'Ann',
      }),
      'hi'
    );
  });
});
