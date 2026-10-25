// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import LinkifyIt from 'linkify-it';

import { adjustSchemelessLinkMatch } from '../../util/tellomiSchemelessLink.std.ts';

// Tellomi (TF43 P1): links written without a scheme.
describe('adjustSchemelessLinkMatch (Tellomi)', () => {
  const linkify = new LinkifyIt().tlds(['com', 'py', 'md', 'zip', 'cc', 'org']);

  function links(text: string): Array<[string, string]> {
    return (linkify.match(text) ?? []).flatMap(match => {
      const adjusted = adjustSchemelessLinkMatch(match);
      return adjusted
        ? [[adjusted.text, adjusted.url] as [string, string]]
        : [];
    });
  }

  it('opens a bare domain over https', () => {
    assert.deepEqual(links('baidu.com'), [['baidu.com', 'https://baidu.com']]);
    assert.deepEqual(links('tell.cc'), [['tell.cc', 'https://tell.cc']]);
  });

  it('keeps an explicit scheme', () => {
    assert.deepEqual(links('http://signal.org/a'), [
      ['http://signal.org/a', 'http://signal.org/a'],
    ]);
  });

  it('starts a bare domain after CJK text glued to it', () => {
    assert.deepEqual(links('打开baidu.com'), [
      ['baidu.com', 'https://baidu.com'],
    ]);
    assert.deepEqual(links('去www.jd.com/a'), [
      ['www.jd.com/a', 'https://www.jd.com/a'],
    ]);
    const [match] = linkify.match('打开baidu.com') ?? [];
    assert.isDefined(match);
    if (!match) {
      throw new Error('expected a match');
    }
    assert.strictEqual(adjustSchemelessLinkMatch(match)?.index, 2);
  });

  it('does not make file names or versions links', () => {
    assert.deepEqual(links('运行 setup.py 就行'), []);
    assert.deepEqual(links('看 README.md'), []);
    assert.deepEqual(links('下载photos.zip'), []);
    assert.deepEqual(links('升级到 1.2.3 或 v2.0.1'), []);
  });

  it('still makes file-like TLDs links with a path or www', () => {
    assert.deepEqual(links('a.py/docs'), [['a.py/docs', 'https://a.py/docs']]);
    assert.deepEqual(links('www.setup.py'), [
      ['www.setup.py', 'https://www.setup.py'],
    ]);
  });
});
