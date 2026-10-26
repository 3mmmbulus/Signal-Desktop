// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import type { AttachmentForUIType } from '../types/Attachment.std.ts';
import type { MessageForwardDraft } from '../types/ForwardDraft.std.ts';

/**
 * Tellomi（桌面审计 5.4，对齐 Android #426 / iOS #382）：转发时「隐藏发送人 / 隐藏说明文字」。
 *
 * - 发送人：Signal 协议转发出去的是一条新消息，本来就不带原发送人，所以「隐藏发送人」恒成立，
 *   不需要开关，也不改协议。
 * - 说明文字：只对带附件的消息生效（图片、视频、文件下面的文字，含 draft.messageBody 与
 *   每张附件的 caption）。纯文字消息的文字就是内容本身，不能隐藏。
 *   只有空白的说明文字当作没有说明文字。
 * - 转发编辑框里用户改写后的正文仍按「说明」处理：开关打开时一并去掉。
 */
export const TellomiForwardCaptionPolicy = {
  /** 原发送人永远不会随转发发出。 */
  SENDER_ALWAYS_HIDDEN: true as const,

  /** 这条消息有没有附件（决定说明文字算不算「说明」而不是正文）。 */
  hasAttachments(draft: MessageForwardDraft): boolean {
    if (draft.isSticker) {
      return true;
    }
    if (draft.hasContact) {
      return true;
    }
    return (draft.attachments?.length ?? 0) > 0;
  },

  /** 这条消息有没有可以隐藏的说明文字（决定界面上要不要给「隐藏说明文字」开关）。 */
  canHideCaption(draft: MessageForwardDraft): boolean {
    if (!TellomiForwardCaptionPolicy.hasAttachments(draft)) {
      return false;
    }
    const body = draft.messageBody?.trim() ?? '';
    if (body.length > 0) {
      return true;
    }
    return (
      draft.attachments?.some(attachment => {
        return Boolean(attachment.caption?.trim());
      }) ?? false
    );
  },

  /** 选了多条消息时，只要有一条能隐藏说明文字就显示开关。 */
  showsHideCaptionToggle(drafts: ReadonlyArray<MessageForwardDraft>): boolean {
    return drafts.some(draft =>
      TellomiForwardCaptionPolicy.canHideCaption(draft)
    );
  },

  /** 实际随转发发出的一条 draft；开着隐藏且有可隐藏说明时去掉说明文字。 */
  outgoingDraft(
    draft: MessageForwardDraft,
    hideCaption: boolean
  ): MessageForwardDraft {
    if (!hideCaption || !TellomiForwardCaptionPolicy.canHideCaption(draft)) {
      return draft;
    }
    const attachments = draft.attachments?.map(clearAttachmentCaption);
    return {
      ...draft,
      messageBody: undefined,
      bodyRanges: undefined,
      ...(attachments != null ? { attachments } : {}),
    };
  },

  /** 多条一起转发时，对每一条按开关处理。 */
  outgoingDrafts(
    drafts: ReadonlyArray<MessageForwardDraft>,
    hideCaption: boolean
  ): ReadonlyArray<MessageForwardDraft> {
    return drafts.map(draft =>
      TellomiForwardCaptionPolicy.outgoingDraft(draft, hideCaption)
    );
  },
} as const;

function clearAttachmentCaption(
  attachment: AttachmentForUIType
): AttachmentForUIType {
  if (!attachment.caption?.trim()) {
    return attachment;
  }
  return { ...attachment, caption: undefined };
}
