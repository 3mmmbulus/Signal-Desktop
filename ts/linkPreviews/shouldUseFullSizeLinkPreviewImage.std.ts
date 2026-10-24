// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { LinkPreviewType } from '../types/message/LinkPreviews.std.ts';
import { isImageAttachment } from '../util/Attachment.std.ts';
import type { LinkCardType } from './linkCard.std.ts';
import type { LinkCardLayoutType } from './linkCardVisual.std.ts';

const MINIMUM_FULL_SIZE_DIMENSION = 200;

export function shouldUseFullSizeLinkPreviewImage({
  isStickerPack,
  image,
  layout,
  card,
}: Readonly<LinkPreviewType> &
  Readonly<{ layout?: LinkCardLayoutType; card?: LinkCardType }>): boolean {
  if (isStickerPack || !image || !isImageAttachment(image)) {
    return false;
  }

  // Tellomi (card-visual §3.2): when rust/links decided the card's shape, that decision stands,
  // with no threshold of our own.
  if (layout) {
    return layout === 'large_image';
  }
  // Tellomi (DESIGN.md §9, as iOS b0a480fc): a third-party card rust/links gave no layout for is
  // never guessed large; it is drawn as an icon strip.
  if (card && card.level !== 'first_party') {
    return false;
  }

  const { width, height } = image;

  return (
    isDimensionFullSize(width) &&
    isDimensionFullSize(height) &&
    !isRoughlySquare(width, height)
  );
}

function isDimensionFullSize(dimension: unknown): dimension is number {
  return (
    typeof dimension === 'number' && dimension >= MINIMUM_FULL_SIZE_DIMENSION
  );
}

function isRoughlySquare(width: number, height: number): boolean {
  return Math.abs(1 - width / height) < 0.05;
}
