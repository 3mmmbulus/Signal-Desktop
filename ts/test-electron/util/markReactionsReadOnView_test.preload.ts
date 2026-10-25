// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import * as sinon from 'sinon';
import { v4 as generateUuid } from 'uuid';

import { DataReader, DataWriter } from '../../sql/Client.preload.ts';
import type { ReactionType } from '../../types/Reactions.std.ts';
import { ReactionReadStatus } from '../../types/Reactions.std.ts';
import type { MessageAttributesType } from '../../model-types.d.ts';
import { ReadStatus } from '../../messages/MessageReadStatus.std.ts';
import { SeenStatus } from '../../MessageSeenStatus.std.ts';
import { postSaveUpdates } from '../../util/cleanup.preload.ts';
import { generateAci } from '../../test-helpers/serviceIdUtils.std.ts';
import { itemStorage } from '../../textsecure/Storage.preload.ts';
import { Emoji } from '../../axo/emoji.std.ts';
import { conversationJobQueue } from '../../jobs/conversationJobQueue.preload.ts';
import { readSyncJobQueue } from '../../jobs/readSyncJobQueue.preload.ts';
import { initialize as initializeExpiringMessagesService } from '../../services/expiringMessagesDeletion.preload.ts';
import { markConversationRead } from '../../util/markConversationRead.preload.ts';
import { markReactionsReadForMessages } from '../../util/markReactionsReadForMessages.preload.ts';

const UNREAD = { readStatus: ReactionReadStatus.Unread };

// Tellomi (desktop audit 6.2 r2): reactions are read per on-screen message;
// message read status and read receipts keep their old (range) timing.
describe('Tellomi 6.2 r2: reactions read only when their message is seen', () => {
  let sandbox: sinon.SinonSandbox;
  let receiptsAdd: sinon.SinonStub;
  let previousAci: ReturnType<typeof itemStorage.user.getAci>;
  let previousDeviceId: ReturnType<typeof itemStorage.user.getDeviceId>;
  let testAci: ReturnType<typeof generateAci>;

  before(() => {
    initializeExpiringMessagesService();
  });

  beforeEach(async () => {
    // Isolate ACI: this file must pass when run alone (full suite used to
    // hide a missing ACI because earlier files set one).
    previousAci = itemStorage.user.getAci();
    previousDeviceId = itemStorage.user.getDeviceId();
    testAci = generateAci();
    await itemStorage.user.setAciAndDeviceId(testAci, 1);

    await DataWriter._removeAllMessages();
    await DataWriter._removeAllReactions();
    sandbox = sinon.createSandbox();
    receiptsAdd = sandbox.stub(conversationJobQueue, 'add').resolves();
    sandbox.stub(readSyncJobQueue, 'add').resolves();
  });

  afterEach(async () => {
    sandbox.restore();
    if (previousAci !== undefined && previousDeviceId !== undefined) {
      await itemStorage.user.setAciAndDeviceId(previousAci, previousDeviceId);
    }
  });

  async function setup() {
    const ourAci = itemStorage.user.getCheckedAci();
    const theirAci = generateAci();
    const convo = await window.ConversationController.getOrCreateAndWait(
      theirAci,
      'private'
    );
    convo.set({ profileSharing: true });
    const conversationId = convo.id;
    const start = Date.now();

    const base = (at: number): MessageAttributesType => ({
      id: generateUuid(),
      body: `m${at}`,
      type: 'outgoing',
      conversationId,
      sent_at: at,
      received_at: at,
      timestamp: at,
      readStatus: ReadStatus.Read,
    });
    // Older outgoing message, scrolled off screen, with an unread reaction
    const offscreen = base(start + 1);
    // Newer outgoing message, on screen, with an unread reaction
    const onscreen = base(start + 2);
    // Newest incoming unread message: the one a read receipt is sent for
    const incoming: MessageAttributesType = {
      ...base(start + 3),
      type: 'incoming',
      sourceServiceId: theirAci,
      readStatus: ReadStatus.Unread,
      seenStatus: SeenStatus.Unseen,
    };
    await DataWriter.saveMessages([offscreen, onscreen, incoming], {
      forceSave: true,
      ourAci,
      postSaveUpdates,
    });

    const reaction = (m: MessageAttributesType): ReactionType => ({
      conversationId,
      emoji: Emoji.TADA,
      fromId: convo.id,
      messageId: m.id,
      messageReceivedAt: m.received_at,
      targetAuthorAci: ourAci,
      targetTimestamp: m.sent_at,
      timestamp: m.sent_at + 1000,
    });
    await DataWriter.addReaction(reaction(offscreen), UNREAD);
    await DataWriter.addReaction(reaction(onscreen), UNREAD);

    return { convo, conversationId, ourAci, offscreen, onscreen, incoming };
  }

  it('keeps read receipt timing, leaves unseen messages’ reactions unread', async () => {
    const { convo, conversationId, ourAci, offscreen, onscreen, incoming } =
      await setup();

    // Same call the timeline makes for the newest bottom-visible message
    await markConversationRead(convo.attributes, incoming, {
      sendReadReceipts: true,
    });

    // Message read + receipt to the other person: unchanged, immediate
    const saved = await DataReader.getMessageById(incoming.id);
    assert.strictEqual(saved?.readStatus, ReadStatus.Read);
    const receiptJobs = receiptsAdd
      .getCalls()
      .map(call => call.args[0])
      .filter(job => job.type === 'Receipts');
    assert.lengthOf(receiptJobs, 1);
    assert.deepEqual(
      receiptJobs[0].receipts.map((r: { messageId: string }) => r.messageId),
      [incoming.id]
    );

    // Reactions are NOT marked read by range any more
    assert.strictEqual(
      await DataReader.getTotalUnreadReactionsToMeForConversation(
        conversationId,
        ourAci
      ),
      2
    );

    // Only the message actually on screen gets its reaction read
    const read = await markReactionsReadForMessages(conversationId, [
      onscreen.id,
    ]);
    assert.deepEqual(
      read.map(r => r.messageId),
      [onscreen.id]
    );
    assert.strictEqual(
      await DataReader.getTotalUnreadReactionsToMeForConversation(
        conversationId,
        ourAci
      ),
      1
    );
    assert.strictEqual(
      (
        await DataReader.getOldestMessageWithUnreadReactionToMe(
          conversationId,
          ourAci
        )
      )?.id,
      offscreen.id
    );

    // Marking reactions read never sends another read receipt
    assert.lengthOf(
      receiptsAdd.getCalls().filter(call => call.args[0].type === 'Receipts'),
      1
    );
  });

  it('explicit "mark chat read" still clears all reactions', async () => {
    const { convo, conversationId, ourAci, incoming } = await setup();
    await markConversationRead(convo.attributes, incoming, {
      sendReadReceipts: false,
      includeReactions: true,
    });
    assert.strictEqual(
      await DataReader.getTotalUnreadReactionsToMeForConversation(
        conversationId,
        ourAci
      ),
      0
    );
  });
});
