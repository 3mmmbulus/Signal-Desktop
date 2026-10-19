// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReadonlyMessageAttributesType } from '../model-types.d.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import * as EmbeddedContact from '../types/EmbeddedContact.std.ts';
import {
  getTellomiPinNoticeQuoteText,
  isTellomiPinNotice,
} from './tellomiPinNoticeActions.std.ts';

export function getQuoteBodyText({
  messageAttributes,
  id,
  i18n,
  tellomiPinnerTitle,
}: {
  messageAttributes: ReadonlyMessageAttributesType;
  id: number | null;
  i18n: LocalizerType;
  // Tellomi (ADR-0081 §九 P5): the name of whoever pinned, for a pin's chat event
  tellomiPinnerTitle?: string;
}): string | undefined {
  // Tellomi (ADR-0081 §九 P5): a pin's chat event has no body; what is quoted is its line, "×× pinned “…”"
  if (
    isTellomiPinNotice(messageAttributes) &&
    !messageAttributes.deletedForEveryone &&
    tellomiPinnerTitle != null
  ) {
    return getTellomiPinNoticeQuoteText(i18n, {
      pinnerTitle: tellomiPinnerTitle,
      subject: messageAttributes.tellomiPinSubject,
    });
  }

  const storyReactionEmoji = messageAttributes.storyReaction?.emoji;

  if (id != null) {
    const { editHistory } = messageAttributes;
    const editedMessage =
      editHistory && editHistory.find(edit => edit.timestamp === id);

    if (editedMessage && editedMessage.body) {
      return editedMessage.body;
    }
  }

  const { body, contact: embeddedContact, poll } = messageAttributes;
  const embeddedContactName =
    embeddedContact && embeddedContact.length > 0
      ? // oxlint-disable-next-line typescript/no-non-null-assertion
        EmbeddedContact.getName(embeddedContact[0]!)
      : '';

  const pollText = poll
    ? i18n('icu:Poll--preview', {
        pollQuestion: poll.question,
      })
    : undefined;

  return body || embeddedContactName || pollText || storyReactionEmoji;
}
