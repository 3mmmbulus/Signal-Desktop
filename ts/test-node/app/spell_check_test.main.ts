// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import {
  getLanguages,
  getTellomiLinkMenuTemplate,
  isTellomiWebLink,
} from '../../../app/spell_check.main.ts';
import type { LocalizerType } from '../../types/Util.std.ts';

describe('SpellCheck', () => {
  describe('getLanguages', () => {
    it('works with locale and base available', () => {
      assert.deepEqual(getLanguages(['en-US'], ['en-US', 'en'], 'en'), [
        'en-US',
      ]);
    });

    it('uses icu likely subtags rules to match languages', () => {
      assert.deepEqual(getLanguages(['fa-FR'], ['fa-IR'], 'en'), ['fa-IR']);
      assert.deepEqual(getLanguages(['zh'], ['zh-Hans-CN'], 'en'), [
        'zh-Hans-CN',
      ]);
      assert.deepEqual(
        getLanguages(['zh-HK'], ['zh-Hans-CN', 'zh-Hant-HK'], 'en'),
        ['zh-Hant-HK']
      );
    });

    it('matches multiple locales', () => {
      assert.deepEqual(
        getLanguages(['fr-FR', 'es'], ['fr', 'es-ES', 'en-US'], 'en'),
        ['fr', 'es-ES']
      );
    });

    it('works with only base locale available', () => {
      assert.deepEqual(getLanguages(['en-US'], ['en'], 'en'), ['en']);
    });

    it('works with only full locale available', () => {
      assert.deepEqual(getLanguages(['en-US'], ['en-CA', 'en-US'], 'en'), [
        'en-US',
      ]);
    });

    it('works with base provided and base available', () => {
      assert.deepEqual(getLanguages(['en'], ['en-CA', 'en-US', 'en'], 'en'), [
        'en',
      ]);
    });

    it('falls back to default', () => {
      assert.deepEqual(getLanguages(['fa-IR'], ['es-ES', 'fr-FR'], 'en'), [
        'en',
      ]);
    });

    it('matches en along with other languages', () => {
      assert.deepEqual(getLanguages(['en', 'fr'], ['fr', 'en'], 'en'), [
        'en',
        'fr',
      ]);
    });
  });

  // Tellomi (TF43 P1): right-click link menu
  describe('getTellomiLinkMenuTemplate', () => {
    const i18n = ((key: string) => key) as unknown as LocalizerType;

    it('shows the full URL on top, then Open and Copy Link', () => {
      let opened = 0;
      let copied = 0;
      const template = getTellomiLinkMenuTemplate(
        'https://baidu.com/a?b=1',
        i18n,
        {
          open: () => {
            opened += 1;
          },
          copy: () => {
            copied += 1;
          },
        }
      );
      assert.deepEqual(
        template.map(item => [item.type ?? 'normal', item.label, item.enabled]),
        [
          ['normal', 'https://baidu.com/a?b=1', false],
          ['separator', undefined, undefined],
          ['normal', 'icu:TellomiLinkCard__action_open', undefined],
          ['normal', 'icu:contextMenuCopyLink', undefined],
        ]
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (template[2]?.click as any)();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (template[3]?.click as any)();
      assert.strictEqual(opened, 1);
      assert.strictEqual(copied, 1);
    });

    it('only web links get it', () => {
      assert.isTrue(isTellomiWebLink('https://baidu.com'));
      assert.isTrue(isTellomiWebLink('HTTP://x.com'));
      assert.isFalse(isTellomiWebLink('mailto:a@b.com'));
      assert.isFalse(isTellomiWebLink('sgnl://signal.group'));
    });
  });
});
