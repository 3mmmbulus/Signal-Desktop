// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

// Tellomi (TF43 P1, PM 2026-10-25): links written without a scheme in message text.
//
// - Chinese / Japanese / Korean text has no spaces, so linkify-it's fuzzy match swallows the text
//   before a bare domain into the host (`打开baidu.com` → `http://打开baidu.com`, which is then
//   rejected as sneaky). The link starts at the first ASCII letter or digit after such text.
// - It opens over https (`baidu.com` → `https://baidu.com`), as on Telegram; an explicit
//   `http://` is kept.
// - A bare `name.ext` whose TLD is also a common file extension (`setup.py`, `README.md`,
//   `photos.zip`) is a file name, not a link. With a path or `www.` it is still a link.
// Same rules as iOS `TellomiSchemelessLink` and Android `Linkifier`. The CJK punctuation rule
// (`getLinkifiableLength`) is applied afterwards, unchanged.

export const FILE_LIKE_TOP_LEVEL_DOMAINS: ReadonlySet<string> = new Set([
  'zip',
  'mov',
  'py',
  'md',
  'sh',
  'rs',
  'pl',
  'gz',
  'kt',
  'js',
  'ts',
  'swift',
]);

const LEADING_CJK =
  /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]+(?=[A-Za-z0-9])/u;

export type LinkMatchLike = Readonly<{
  index: number;
  lastIndex: number;
  text: string;
  url: string;
  schema: string;
}>;

export type AdjustedLinkMatch = Readonly<{
  index: number;
  lastIndex: number;
  text: string;
  url: string;
}>;

/** Returns the match to use, or undefined if it is not a link at all. */
export function adjustSchemelessLinkMatch(
  match: LinkMatchLike
): AdjustedLinkMatch | undefined {
  const { schema } = match;
  if (schema !== '') {
    return match;
  }
  let { index, text } = match;
  const lead = LEADING_CJK.exec(text);
  if (lead) {
    index += lead[0].length;
    text = text.slice(lead[0].length);
  }
  // `mailto:`-less emails are matched by linkify-it as fuzzy emails; leave them alone.
  if (text.includes('@')) {
    return { index, lastIndex: match.lastIndex, text, url: match.url };
  }
  const hostEnd = text.search(/[/?#:]/);
  const host = (hostEnd < 0 ? text : text.slice(0, hostEnd)).toLowerCase();
  const tld = host.slice(host.lastIndexOf('.') + 1);
  if (
    hostEnd < 0 &&
    !host.startsWith('www.') &&
    FILE_LIKE_TOP_LEVEL_DOMAINS.has(tld)
  ) {
    return undefined;
  }
  return { index, lastIndex: match.lastIndex, text, url: `https://${text}` };
}
