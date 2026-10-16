// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assert } from 'chai';

// Tellomi: the "open this on your phone" notice for tell.cc/m feed post links (ADR-0071 D1: no feed on
// Desktop). Every locale Tellomi ships translations for must carry both strings, so the notice never
// falls back to an English-only dialog for a Chinese user. The strings take no parameters.
const KEYS = [
  'icu:TellomiFeedPostLink__title',
  'icu:TellomiFeedPostLink__description',
] as const;

const LOCALES = ['en', 'zh-CN', 'zh-Hant', 'zh-HK'] as const;

describe('TellomiFeedPostLink locale strings', () => {
  for (const locale of LOCALES) {
    it(`${locale} has both strings, non-empty and without placeholders`, () => {
      const messages = JSON.parse(
        readFileSync(
          join(
            import.meta.dirname,
            '../../../_locales',
            locale,
            'messages.json'
          ),
          'utf8'
        )
      ) as Record<string, { messageformat: string }>;
      for (const key of KEYS) {
        const text = messages[key]?.messageformat ?? '';
        assert.isAbove(text.trim().length, 0, `${locale} is missing ${key}`);
        assert.notInclude(text, '{', `${locale} ${key} has a placeholder`);
      }
    });
  }
});
