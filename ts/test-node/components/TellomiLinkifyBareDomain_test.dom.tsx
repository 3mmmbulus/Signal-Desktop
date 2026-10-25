// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { renderToStaticMarkup } from 'react-dom/server';

import { Linkify } from '../../components/conversation/Linkify.dom.tsx';
import { extractLinks } from '../../components/conversation/MessageTextRenderer.dom.tsx';

// Tellomi (TF43 P1): bare domains in messages, with the CJK punctuation rule kept.
describe('<Linkify /> bare domains (Tellomi)', () => {
  function anchors(text: string): Array<string> {
    const html = renderToStaticMarkup(<Linkify text={text} />);
    return [...html.matchAll(/<a href="([^"]*)">([^<]*)<\/a>/g)].map(
      m => `${m[2]} -> ${m[1]}`
    );
  }

  it('links a bare domain and opens it over https', () => {
    assert.deepEqual(anchors('baidu.com'), ['baidu.com -> https://baidu.com']);
    assert.deepEqual(anchors('打开baidu.com'), [
      'baidu.com -> https://baidu.com',
    ]);
    assert.include(
      renderToStaticMarkup(<Linkify text="打开baidu.com" />),
      '打开'
    );
  });

  it('keeps CJK punctuation out of the link', () => {
    assert.deepEqual(anchors('打开 baidu.com，然后'), [
      'baidu.com -> https://baidu.com',
    ]);
  });

  it('does not link file names or versions', () => {
    assert.deepEqual(anchors('运行 setup.py 和 README.md，版本 1.2.3'), []);
  });

  it('gives the message body the same ranges', () => {
    const text = '打开baidu.com，然后';
    assert.deepEqual(extractLinks(text, text.length), [
      { start: 2, length: 9, url: 'https://baidu.com' },
    ]);
  });
});
