// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import type { LinkCardType } from './linkCard.std.ts';
import type { LinkCardLayoutType } from './linkCardVisual.std.ts';

// The one style of a third-party link card in a conversation (PM 2026-10-19, after Apple Messages;
// compass rule confirmed 2026-10-24; DESIGN.md §9). The desktop port of iOS
// `TellomiLinkCardStyle.swift` (tellomi/Signal-iOS #347 b0a480fc) and Android
// `TellomiLinkCardStyle.kt` (tellomi/Signal-Android #406 7cc5fad2): the same decisions, the same
// numbers.
//
// - `largeImage`: a large image on top, the title and the domain under it, neutral grey;
// - `iconStrip`: a small image (site icon, square picture, a brand shell's bundled icon): title
//   (bold) and domain (grey) on the left, the icon on the right; it keeps the colours rust/links
//   `tint` gives, neutral grey without;
// - `textStrip`: no image, a title: neutral grey, title and domain, nothing on the right (claimed or
//   not);
// - `domainStrip`: nothing was fetched: neutral grey, the domain only, a compass on the right — the
//   only style with a compass.
//
// No sub line (the sender's description, kind names) in any of them. First-party cards, call links
// and sticker packs keep their own look.

export type LinkCardStyleKind =
  | 'largeImage'
  | 'iconStrip'
  | 'textStrip'
  | 'domainStrip';

export type LinkCardStyleText = Readonly<{
  // undefined: the domain is the only line.
  title: string | undefined;
  domain: string;
}>;

// DESIGN.md §9, in px (top / right / bottom / left order is CSS's; the doc writes top / left /
// bottom / right: 9 / 14 / 9 / 10 with an item on the right, 9 / 14 / 10 / 14 without).
export const LINK_CARD_STYLE = {
  iconSize: 36,
  iconRadius: 8,
  compassSize: 26,
  trailingGap: 10,
  lineGap: 2,
  maxTitleLines: 2,
  stripPadding: { top: 9, left: 14, bottom: 9, right: 10 },
  stripNoTrailingPadding: { top: 9, left: 14, bottom: 10, right: 14 },
  largeImageTextPadding: { top: 9, left: 14, bottom: 10, right: 14 },
  neutralLight: '#e9e9eb',
  neutralDark: '#2c2c2e',
} as const;

// Which of the four styles.
// - `hasImage`: there is an image to draw (the sender's, or a brand shell's bundled icon);
// - `layout`: rust/links' layout; undefined (no decision): an image is the icon strip, never
//   guessed large (same as iOS);
// - `isPlainLink`: a card drawn from the URL alone: always the domain only.
export function getLinkCardStyleKind({
  layout,
  hasImage,
  hasTitle,
  isPlainLink,
}: Readonly<{
  layout: LinkCardLayoutType | undefined;
  hasImage: boolean;
  hasTitle: boolean;
  isPlainLink: boolean;
}>): LinkCardStyleKind {
  if (isPlainLink) {
    return 'domainStrip';
  }
  if (hasImage) {
    if (layout === 'large_image') {
      return 'largeImage';
    }
    if (layout === 'icon' || layout === undefined) {
      return 'iconStrip';
    }
  }
  return hasTitle ? 'textStrip' : 'domainStrip';
}

// The compass only on a card with nothing at all (PM, since TestFlight 31; confirmed 2026-10-24).
export function linkCardShowsCompass(kind: LinkCardStyleKind): boolean {
  return kind === 'domainStrip';
}

// Only an icon strip keeps the colours of its image; the rest are neutral grey.
export function isLinkCardStyleTinted(kind: LinkCardStyleKind): boolean {
  return kind === 'iconStrip';
}

// Whether a card is drawn in the unified style: a third-party card rust/links decided on. Not a
// Tellomi object, a call link or a sticker pack, and not a preview without a card (no registry).
export function usesLinkCardStyle({
  card,
  isCallLink,
  isStickerPack,
}: Readonly<{
  card: LinkCardType | undefined;
  isCallLink: boolean;
  isStickerPack: boolean;
}>): boolean {
  return (
    card !== undefined &&
    card.level !== 'first_party' &&
    !isCallLink &&
    !isStickerPack
  );
}

const WHITESPACE = /\s+/u;

function clean(text: string | null | undefined): string | undefined {
  if (text == null) {
    return undefined;
  }
  const collapsed = text
    .split(WHITESPACE)
    .filter(part => part.length > 0)
    .join(' ');
  return collapsed.length > 0 ? collapsed : undefined;
}

// `https://www.Baidu.com/s?wd=1` → `baidu.com`; one without a scheme (`jd.com/x`) is read as https.
export function getLinkCardHostForDisplay(url: string): string | undefined {
  const trimmed = url.trim();
  if (!trimmed) {
    return undefined;
  }
  const withScheme = trimmed.includes('://') ? trimmed : `https://${trimmed}`;
  let host: string;
  try {
    host = new URL(withScheme).hostname.toLowerCase();
  } catch {
    return undefined;
  }
  if (!host) {
    return undefined;
  }
  return host.startsWith('www.') && host.length > 4 ? host.slice(4) : host;
}

// The two lines: a blank title, or one equal to the domain, is not shown. Without a domain, the
// URL's host (without `www.`); without that either, undefined: no card.
export function getLinkCardStyleText({
  title,
  domain,
  url,
}: Readonly<{
  title: string | null | undefined;
  domain: string | null | undefined;
  url: string | null | undefined;
}>): LinkCardStyleText | undefined {
  const cleanDomain =
    clean(domain) ?? (url ? getLinkCardHostForDisplay(url) : undefined);
  if (!cleanDomain) {
    return undefined;
  }
  const cleanTitle = clean(title);
  return {
    title:
      cleanTitle && cleanTitle.toLowerCase() !== cleanDomain.toLowerCase()
        ? cleanTitle
        : undefined,
    domain: cleanDomain,
  };
}
