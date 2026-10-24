// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  LINK_CARD_STYLE,
  getLinkCardHostForDisplay,
  getLinkCardStyleKind,
  getLinkCardStyleText,
  isLinkCardStyleTinted,
  linkCardShowsCompass,
  usesLinkCardStyle,
} from '../../linkPreviews/linkCardStyle.std.ts';
import type { LinkCardType } from '../../linkPreviews/linkCard.std.ts';

// DESIGN.md §9: the same decisions as iOS TellomiLinkCardStyle (b0a480fc) and Android
// TellomiLinkCardStyleTest (7cc5fad2).

const CARD: LinkCardType = {
  level: 'generic',
  provider: null,
  provider_name: null,
  kind: null,
  route: null,
  title: 'Title',
  description: 'Description',
  attrs: [],
  domain: 'example.org',
  official_badge: false,
  first_party: null,
  lookalike: null,
  show_image: true,
  tintable: true,
  payment: false,
  reason: null,
};

describe('linkCardStyle', () => {
  describe('getLinkCardStyleKind', () => {
    const base = { hasImage: true, hasTitle: true, isPlainLink: false };

    it('a large image only for the large_image layout', () => {
      assert.strictEqual(
        getLinkCardStyleKind({ ...base, layout: 'large_image' }),
        'largeImage'
      );
    });

    it('an icon strip for the icon layout, and with no layout (never guessed large)', () => {
      assert.strictEqual(
        getLinkCardStyleKind({ ...base, layout: 'icon' }),
        'iconStrip'
      );
      assert.strictEqual(
        getLinkCardStyleKind({ ...base, layout: undefined }),
        'iconStrip'
      );
    });

    it('a title strip without an image, or for no_image', () => {
      assert.strictEqual(
        getLinkCardStyleKind({ ...base, hasImage: false, layout: undefined }),
        'textStrip'
      );
      assert.strictEqual(
        getLinkCardStyleKind({ ...base, layout: 'no_image' }),
        'textStrip'
      );
      assert.strictEqual(
        getLinkCardStyleKind({ ...base, hasImage: false, layout: 'icon' }),
        'textStrip'
      );
    });

    it('a domain strip without a title or for a plain link', () => {
      assert.strictEqual(
        getLinkCardStyleKind({
          ...base,
          hasImage: false,
          hasTitle: false,
          layout: undefined,
        }),
        'domainStrip'
      );
      assert.strictEqual(
        getLinkCardStyleKind({
          ...base,
          isPlainLink: true,
          layout: 'large_image',
        }),
        'domainStrip'
      );
    });
  });

  it('the compass only on the domain strip', () => {
    assert.isTrue(linkCardShowsCompass('domainStrip'));
    assert.isFalse(linkCardShowsCompass('textStrip'));
    assert.isFalse(linkCardShowsCompass('iconStrip'));
    assert.isFalse(linkCardShowsCompass('largeImage'));
  });

  it('only the icon strip is tinted', () => {
    assert.isTrue(isLinkCardStyleTinted('iconStrip'));
    assert.isFalse(isLinkCardStyleTinted('largeImage'));
    assert.isFalse(isLinkCardStyleTinted('textStrip'));
    assert.isFalse(isLinkCardStyleTinted('domainStrip'));
  });

  it('usesLinkCardStyle: third-party cards only', () => {
    const plain = { isCallLink: false, isStickerPack: false };
    assert.isTrue(usesLinkCardStyle({ ...plain, card: CARD }));
    assert.isTrue(
      usesLinkCardStyle({ ...plain, card: { ...CARD, level: 'plain_link' } })
    );
    assert.isFalse(usesLinkCardStyle({ ...plain, card: undefined }));
    assert.isFalse(
      usesLinkCardStyle({ ...plain, card: { ...CARD, level: 'first_party' } })
    );
    assert.isFalse(
      usesLinkCardStyle({ card: CARD, isCallLink: true, isStickerPack: false })
    );
    assert.isFalse(
      usesLinkCardStyle({ card: CARD, isCallLink: false, isStickerPack: true })
    );
  });

  describe('getLinkCardStyleText', () => {
    it('collapses whitespace, including full-width spaces and new lines', () => {
      assert.deepEqual(
        getLinkCardStyleText({
          title: '  京东\u3000商品\n 详情 ',
          domain: ' jd.com ',
          url: undefined,
        }),
        { title: '京东 商品 详情', domain: 'jd.com' }
      );
    });

    it('drops a blank title, or one equal to the domain', () => {
      assert.deepEqual(
        getLinkCardStyleText({ title: ' ', domain: 'a.com', url: undefined }),
        { title: undefined, domain: 'a.com' }
      );
      assert.deepEqual(
        getLinkCardStyleText({
          title: 'Example.ORG',
          domain: 'example.org',
          url: undefined,
        }),
        { title: undefined, domain: 'example.org' }
      );
    });

    it('falls back to the host, without www.', () => {
      assert.deepEqual(
        getLinkCardStyleText({
          title: null,
          domain: null,
          url: 'https://www.Baidu.com/s?wd=1',
        }),
        { title: undefined, domain: 'baidu.com' }
      );
      assert.isUndefined(
        getLinkCardStyleText({ title: 'x', domain: null, url: null })
      );
    });
  });

  it('getLinkCardHostForDisplay', () => {
    assert.strictEqual(getLinkCardHostForDisplay('jd.com/x'), 'jd.com');
    assert.strictEqual(
      getLinkCardHostForDisplay('https://item.jd.com/1.html'),
      'item.jd.com'
    );
    assert.isUndefined(getLinkCardHostForDisplay('  '));
    assert.isUndefined(getLinkCardHostForDisplay('http://'));
  });

  it('the numbers of DESIGN.md §9', () => {
    assert.deepEqual(LINK_CARD_STYLE.stripPadding, {
      top: 9,
      left: 14,
      bottom: 9,
      right: 10,
    });
    assert.deepEqual(LINK_CARD_STYLE.stripNoTrailingPadding, {
      top: 9,
      left: 14,
      bottom: 10,
      right: 14,
    });
    assert.strictEqual(LINK_CARD_STYLE.iconSize, 36);
    assert.strictEqual(LINK_CARD_STYLE.compassSize, 26);
    assert.strictEqual(LINK_CARD_STYLE.neutralLight, '#e9e9eb');
    assert.strictEqual(LINK_CARD_STYLE.neutralDark, '#2c2c2e');
  });
});
