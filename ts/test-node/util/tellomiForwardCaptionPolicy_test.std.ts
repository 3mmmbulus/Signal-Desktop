// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import type { AttachmentForUIType } from '../../types/Attachment.std.ts';
import type { MessageForwardDraft } from '../../types/ForwardDraft.std.ts';
import { IMAGE_JPEG } from '../../types/MIME.std.ts';
import { TellomiForwardCaptionPolicy } from '../../util/tellomiForwardCaptionPolicy.std.ts';

function attachment(
  overrides: Partial<AttachmentForUIType> = {}
): AttachmentForUIType {
  return {
    pending: false,
    path: 'photo.jpg',
    contentType: IMAGE_JPEG,
    fileName: 'photo.jpg',
    url: 'attachment://photo',
    size: 100,
    isPermanentlyUndownloadable: false,
    ...overrides,
  };
}

function draft(
  overrides: Partial<MessageForwardDraft> = {}
): MessageForwardDraft {
  return {
    hasContact: false,
    isSticker: false,
    originalMessageId: 'msg-1',
    previews: [],
    ...overrides,
  };
}

function mediaWithCaption(caption: string | undefined): MessageForwardDraft {
  return draft({
    attachments: [attachment()],
    messageBody: caption,
  });
}

describe('TellomiForwardCaptionPolicy', () => {
  it('senderIsAlwaysHidden', () => {
    assert.isTrue(TellomiForwardCaptionPolicy.SENDER_ALWAYS_HIDDEN);
  });

  it('captionOnAttachmentCanBeHidden', () => {
    const args = mediaWithCaption('海边');
    assert.isTrue(TellomiForwardCaptionPolicy.canHideCaption(args));
    const out = TellomiForwardCaptionPolicy.outgoingDraft(args, true);
    assert.isUndefined(out.messageBody);
    assert.isUndefined(out.bodyRanges);
    assert.strictEqual(out.attachments?.length, 1);
    assert.strictEqual(out.attachments?.[0]?.path, args.attachments?.[0]?.path);
  });

  it('captionKeptWhenToggleOff', () => {
    const args = mediaWithCaption('海边');
    const out = TellomiForwardCaptionPolicy.outgoingDraft(args, false);
    assert.strictEqual(out.messageBody, '海边');
  });

  it('textOnlyMessageNeverLosesText', () => {
    const args = draft({ messageBody: '你好' });
    assert.isFalse(TellomiForwardCaptionPolicy.canHideCaption(args));
    const out = TellomiForwardCaptionPolicy.outgoingDraft(args, true);
    assert.strictEqual(out.messageBody, '你好');
  });

  it('whitespaceCaptionCountsAsNone', () => {
    assert.isFalse(
      TellomiForwardCaptionPolicy.canHideCaption(mediaWithCaption(' \n '))
    );
    assert.isFalse(
      TellomiForwardCaptionPolicy.canHideCaption(mediaWithCaption(undefined))
    );
  });

  it('mediaCaptionAloneCanBeHidden', () => {
    const args = draft({
      attachments: [attachment({ caption: '相册说明' })],
    });
    assert.isTrue(TellomiForwardCaptionPolicy.canHideCaption(args));
    const out = TellomiForwardCaptionPolicy.outgoingDraft(args, true);
    assert.isUndefined(out.attachments?.[0]?.caption);
  });

  it('stickerOrContactCountsAsAttachment', () => {
    assert.isTrue(
      TellomiForwardCaptionPolicy.hasAttachments(draft({ isSticker: true }))
    );
    assert.isTrue(
      TellomiForwardCaptionPolicy.hasAttachments(draft({ hasContact: true }))
    );
    const withText = draft({ isSticker: true, messageBody: '贴纸说明' });
    assert.isTrue(TellomiForwardCaptionPolicy.canHideCaption(withText));
    assert.isUndefined(
      TellomiForwardCaptionPolicy.outgoingDraft(withText, true).messageBody
    );
  });

  it('toggleShownIfAnyItemHasCaption', () => {
    assert.isTrue(
      TellomiForwardCaptionPolicy.showsHideCaptionToggle([
        draft({ messageBody: '纯文字' }),
        mediaWithCaption('图片说明'),
      ])
    );
    assert.isFalse(
      TellomiForwardCaptionPolicy.showsHideCaptionToggle([
        draft({ messageBody: '纯文字' }),
        mediaWithCaption(undefined),
      ])
    );
    assert.isFalse(TellomiForwardCaptionPolicy.showsHideCaptionToggle([]));
  });

  it('outgoingDraftsAppliesPerItem', () => {
    const text = draft({ messageBody: '你好' });
    const media = mediaWithCaption('海边');
    const out = TellomiForwardCaptionPolicy.outgoingDrafts([text, media], true);
    assert.strictEqual(out[0]?.messageBody, '你好');
    assert.isUndefined(out[1]?.messageBody);
  });

  it('clearsBodyRangesWithCaption', () => {
    const args = draft({
      attachments: [attachment()],
      messageBody: '说明',
      // Opaque range payload; policy only clears the array when stripping caption.
      bodyRanges: [{ start: 0, length: 2 } as never],
    });
    const out = TellomiForwardCaptionPolicy.outgoingDraft(args, true);
    assert.isUndefined(out.messageBody);
    assert.isUndefined(out.bodyRanges);
  });
});
