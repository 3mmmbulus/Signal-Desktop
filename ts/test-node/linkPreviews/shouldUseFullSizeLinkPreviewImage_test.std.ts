// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { VIDEO_MP4 } from '../../types/MIME.std.ts';

import { fakeAttachment } from '../../test-helpers/fakeAttachment.std.ts';

import { shouldUseFullSizeLinkPreviewImage } from '../../linkPreviews/shouldUseFullSizeLinkPreviewImage.std.ts';

describe('shouldUseFullSizeLinkPreviewImage', () => {
  const baseLinkPreview = {
    title: 'Foo Bar',
    domain: 'example.com',
    url: 'https://example.com/foo.html',
    isStickerPack: false,
    isCallLink: false,
  };

  it('returns false if there is no image', () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
      })
    );
  });

  it('returns false is the preview is a sticker pack', () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        isStickerPack: true,
        image: fakeAttachment(),
      })
    );
  });

  it("returns false if either of the image's dimensions are missing", () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: undefined }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ height: undefined }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: undefined, height: undefined }),
      })
    );
  });

  it("returns false if either of the image's dimensions are <200px", () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 199 }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ height: 199 }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 150, height: 199 }),
      })
    );
  });

  it('returns false if the image is square', () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 200, height: 200 }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 500, height: 500 }),
      })
    );
  });

  it('returns false if the image is roughly square', () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 200, height: 201 }),
      })
    );
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 497, height: 501 }),
      })
    );
  });

  it("returns false for large attachments that aren't images", () => {
    assert.isFalse(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({
          contentType: VIDEO_MP4,
          fileName: 'foo.mp4',
          url: '/tmp/foo.mp4',
        }),
      })
    );
  });

  it('returns true for larger images', () => {
    assert.isTrue(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment({ width: 200, height: 500 }),
      })
    );
    assert.isTrue(
      shouldUseFullSizeLinkPreviewImage({
        ...baseLinkPreview,
        image: fakeAttachment(),
      })
    );
  });

  // Tellomi (card-visual §3.2): rust/links decides the card's shape; when it did, no threshold of
  // ours overrides it.
  describe('when rust/links decided the layout', () => {
    it('is a large image only for the large_image layout', () => {
      assert.isTrue(
        shouldUseFullSizeLinkPreviewImage({
          ...baseLinkPreview,
          image: fakeAttachment({ width: 1200, height: 630 }),
          layout: 'large_image',
        })
      );
    });

    it('is not, for an image the old rule would have made full size, when it is an icon', () => {
      const image = fakeAttachment({ width: 320, height: 240 });
      assert.isTrue(
        shouldUseFullSizeLinkPreviewImage({ ...baseLinkPreview, image })
      );
      assert.isFalse(
        shouldUseFullSizeLinkPreviewImage({
          ...baseLinkPreview,
          image,
          layout: 'icon',
        })
      );
    });

    it('is not for the other shapes, or a sticker pack, or a non-image', () => {
      const image = fakeAttachment({ width: 1200, height: 630 });
      for (const layout of ['first_party', 'icon', 'no_image'] as const) {
        assert.isFalse(
          shouldUseFullSizeLinkPreviewImage({
            ...baseLinkPreview,
            image,
            layout,
          })
        );
      }
      assert.isFalse(
        shouldUseFullSizeLinkPreviewImage({
          ...baseLinkPreview,
          isStickerPack: true,
          image,
          layout: 'large_image',
        })
      );
      assert.isFalse(
        shouldUseFullSizeLinkPreviewImage({
          ...baseLinkPreview,
          image: fakeAttachment({
            contentType: VIDEO_MP4,
            width: 1200,
            height: 630,
          }),
          layout: 'large_image',
        })
      );
    });
  });
  // DESIGN.md §9 (as iOS b0a480fc): a card rust/links decided on but gave no layout is an icon
  // strip, never a large image by the old threshold.
  describe('when rust/links gave a card but no layout', () => {
    const card = {
      level: 'generic',
      provider: null,
      provider_name: null,
      kind: null,
      route: null,
      title: 'Foo Bar',
      description: null,
      attrs: [],
      domain: 'example.com',
      official_badge: false,
      first_party: null,
      lookalike: null,
      show_image: true,
      tintable: true,
      payment: false,
      reason: null,
    } as const;

    it('is not a large image', () => {
      assert.isFalse(
        shouldUseFullSizeLinkPreviewImage({
          ...baseLinkPreview,
          image: fakeAttachment({ width: 1200, height: 630 }),
          card,
        })
      );
    });

    it('still is, by its layout, when rust/links gave large_image', () => {
      assert.isTrue(
        shouldUseFullSizeLinkPreviewImage({
          ...baseLinkPreview,
          image: fakeAttachment({ width: 1200, height: 630 }),
          card,
          layout: 'large_image',
        })
      );
    });
  });
});
