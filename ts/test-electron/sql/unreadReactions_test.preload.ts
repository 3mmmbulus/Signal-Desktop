// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client.preload.ts';
import type { ReactionType } from '../../types/Reactions.std.ts';
import { ReactionReadStatus } from '../../types/Reactions.std.ts';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { ReadStatus } from '../../messages/MessageReadStatus.std.ts';
import { postSaveUpdates } from '../../util/cleanup.preload.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';
import type { AciString } from '../../types/ServiceId.std.ts';
import { Emoji } from '../../axo/emoji.std.ts';

const {
  getTotalUnreadReactionsToMeForConversation,
  getOldestMessageWithUnreadReactionToMe,
} = DataReader;
const {
  _removeAllMessages,
  _removeAllReactions,
  _removeAllConversations,
  addReaction,
  saveConversation,
  saveMessages,
  getUnreadReactionsAndMarkRead,
} = DataWriter;

const UNREAD = { readStatus: ReactionReadStatus.Unread };
const READ = { readStatus: ReactionReadStatus.Read };

describe('sql/unreadReactionsToMe (Tellomi 6.2)', () => {
  beforeEach(async () => {
    await _removeAllMessages();
    await _removeAllReactions();
    await _removeAllConversations();
  });

  function makeMessage(
    conversationId: string,
    at: number,
    extra: Partial<MessageAttributesType> = {}
  ): MessageAttributesType {
    return {
      id: generateUuid(),
      body: `message ${at}`,
      type: 'outgoing',
      conversationId,
      sent_at: at,
      received_at: at,
      timestamp: at,
      readStatus: ReadStatus.Read,
      ...extra,
    };
  }

  function makeReaction(
    message: MessageAttributesType,
    targetAuthorAci: AciString,
    emoji: ReactionType['emoji'] = Emoji.TADA,
    fromId: string = generateUuid()
  ): ReactionType {
    return {
      conversationId: message.conversationId,
      emoji,
      fromId,
      messageId: message.id,
      messageReceivedAt: message.received_at,
      targetAuthorAci,
      targetTimestamp: message.sent_at,
      timestamp: message.sent_at + 1000,
    };
  }

  it('counts only unread reactions on my messages in this conversation', async () => {
    const start = Date.now();
    const conversationId = generateUuid();
    const ourAci = generateAci();
    const otherAci = generateAci();

    const mine1 = makeMessage(conversationId, start + 1);
    const mine2 = makeMessage(conversationId, start + 2);
    const theirs = makeMessage(conversationId, start + 3, { type: 'incoming' });
    const elsewhere = makeMessage(generateUuid(), start + 4);
    const story = makeMessage(conversationId, start + 5, { type: 'story' });

    await saveMessages([mine1, mine2, theirs, elsewhere, story], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });

    await addReaction(makeReaction(mine2, ourAci), UNREAD);
    await addReaction(makeReaction(mine2, ourAci, Emoji.ROCKET), UNREAD);
    await addReaction(makeReaction(mine1, ourAci), UNREAD);
    await addReaction(makeReaction(mine1, ourAci, Emoji.SUNNY), READ);
    await addReaction(makeReaction(theirs, otherAci), UNREAD);
    await addReaction(makeReaction(elsewhere, ourAci), UNREAD);
    await addReaction(makeReaction(story, ourAci), UNREAD);

    assert.strictEqual(
      await getTotalUnreadReactionsToMeForConversation(conversationId, ourAci),
      3
    );
    assert.strictEqual(
      (await getOldestMessageWithUnreadReactionToMe(conversationId, ourAci))
        ?.id,
      mine1.id
    );
  });

  it('follows the existing mark-read flow', async () => {
    const start = Date.now();
    const conversationId = generateUuid();
    const ourAci = generateAci();

    const mine1 = makeMessage(conversationId, start + 1);
    const mine2 = makeMessage(conversationId, start + 2);
    await saveMessages([mine1, mine2], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });
    await addReaction(makeReaction(mine1, ourAci), UNREAD);
    await addReaction(makeReaction(mine2, ourAci), UNREAD);

    await getUnreadReactionsAndMarkRead({
      conversationId,
      readMessageReceivedAt: mine1.received_at,
    });

    assert.strictEqual(
      await getTotalUnreadReactionsToMeForConversation(conversationId, ourAci),
      1
    );
    assert.strictEqual(
      (await getOldestMessageWithUnreadReactionToMe(conversationId, ourAci))
        ?.id,
      mine2.id
    );

    await getUnreadReactionsAndMarkRead({
      conversationId,
      readMessageReceivedAt: mine2.received_at,
    });

    assert.strictEqual(
      await getTotalUnreadReactionsToMeForConversation(conversationId, ourAci),
      0
    );
    assert.isUndefined(
      await getOldestMessageWithUnreadReactionToMe(conversationId, ourAci)
    );
  });

  it('excludes reactions I made on another linked device (fromId = me)', async () => {
    const start = Date.now();
    const conversationId = generateUuid();
    const ourAci = generateAci();
    const ourConversationId = generateUuid();

    await saveConversation({
      id: ourConversationId,
      type: 'private',
      version: 0,
      serviceId: ourAci,
      expireTimerVersion: 1,
    });

    const mine = makeMessage(conversationId, start + 1);
    await saveMessages([mine], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });

    // Synced from another linked device: fromId is me, stored Unread
    // (see Reactions.preload.ts). Must not inflate the unread button.
    await addReaction(
      makeReaction(mine, ourAci, Emoji.TADA, ourConversationId),
      UNREAD
    );

    assert.strictEqual(
      await getTotalUnreadReactionsToMeForConversation(conversationId, ourAci),
      0
    );
    assert.isUndefined(
      await getOldestMessageWithUnreadReactionToMe(conversationId, ourAci)
    );

    // Someone else's reaction on my message still counts
    await addReaction(makeReaction(mine, ourAci, Emoji.ROCKET), UNREAD);
    assert.strictEqual(
      await getTotalUnreadReactionsToMeForConversation(conversationId, ourAci),
      1
    );
    assert.strictEqual(
      (await getOldestMessageWithUnreadReactionToMe(conversationId, ourAci))
        ?.id,
      mine.id
    );
  });
});
