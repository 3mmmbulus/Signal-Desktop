// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import type { ConversationAttributesType } from '../../model-types.d.ts';
import type { AciString } from '../../types/ServiceId.std.ts';
import { SignalService as Proto } from '../../protobuf/index.std.ts';
import { restoreRemoteConfigFromStorage } from '../../RemoteConfig.dom.ts';
import {
  canReceiveDeleteForEveryone,
  canSendDeleteForEveryone,
} from '../../util/canDeleteForEveryone.preload.ts';
import type { DeleteForEveryoneMessage } from '../../util/canDeleteForEveryone.preload.ts';

// ADR-0081 §九 P5 (erel 2026-10-19, after how Telegram behaves): a pin's chat event is deleted for everyone by the
// pinner, in the usual time limit, or by a group admin, as any message is.
describe('deleting a pin notice for everyone', () => {
  const pinner = 'aci-pinner' as AciString;
  const admin = 'aci-admin' as AciString;
  const member = 'aci-member' as AciString;

  const group = {
    id: 'group',
    type: 'group',
    groupId: Buffer.alloc(32, 1).toString('base64'),
    groupVersion: 2,
    membersV2: [
      { aci: admin, role: Proto.Member.Role.ADMINISTRATOR, joinedAtVersion: 0 },
      { aci: pinner, role: Proto.Member.Role.DEFAULT, joinedAtVersion: 0 },
      { aci: member, role: Proto.Member.Role.DEFAULT, joinedAtVersion: 0 },
    ],
  } as unknown as ConversationAttributesType;

  // Only what the checks ask of it: this is not the Signal chat, and it is not a chat with myself.
  let previousController: typeof window.ConversationController | undefined;
  before(() => {
    previousController = window.ConversationController;
    window.ConversationController = {
      isSignalConversationId: () => false,
      getOurConversation: () => undefined,
    } as unknown as typeof window.ConversationController;
    // no remote config: the time limits are the defaults (a day)
    restoreRemoteConfigFromStorage({
      storage: {
        get: () => undefined,
        put: async () => undefined,
        remove: async () => undefined,
      },
    });
  });
  after(() => {
    if (previousController) {
      window.ConversationController = previousController;
    }
  });

  const now = Date.now();
  const notice = {
    type: 'pinned-message-notification',
    sourceServiceId: pinner,
    sent_at: now - 1000,
    serverTimestamp: now - 1000,
  } as DeleteForEveryoneMessage;

  it('the pinner can, as with a message they sent', () => {
    const sent = canSendDeleteForEveryone({
      targetMessage: notice,
      targetConversation: group,
      ourAci: pinner,
      isDeleterGroupAdmin: false,
    });
    assert.deepEqual(sent, { ok: true, needsAdminDelete: false });
    assert.isTrue(
      canReceiveDeleteForEveryone({
        targetMessage: notice,
        targetConversation: group,
        isAdminDelete: false,
        deleteServerTimestamp: now,
        deleteSentByAci: pinner,
      }).ok
    );
  });

  it('a group admin can delete someone else’s, sent and received', () => {
    const sent = canSendDeleteForEveryone({
      targetMessage: notice,
      targetConversation: group,
      ourAci: admin,
      isDeleterGroupAdmin: true,
    });
    assert.deepEqual(sent, { ok: true, needsAdminDelete: true });
    assert.isTrue(
      canReceiveDeleteForEveryone({
        targetMessage: notice,
        targetConversation: group,
        isAdminDelete: true,
        deleteServerTimestamp: now,
        deleteSentByAci: admin,
      }).ok
    );
  });

  it('another member can not', () => {
    assert.isFalse(
      canSendDeleteForEveryone({
        targetMessage: notice,
        targetConversation: group,
        ourAci: member,
        isDeleterGroupAdmin: false,
      }).ok
    );
    assert.isFalse(
      canReceiveDeleteForEveryone({
        targetMessage: notice,
        targetConversation: group,
        isAdminDelete: true,
        deleteServerTimestamp: now,
        deleteSentByAci: member,
      }).ok,
      'claiming an admin delete without being one'
    );
    assert.isFalse(
      canReceiveDeleteForEveryone({
        targetMessage: notice,
        targetConversation: group,
        isAdminDelete: false,
        deleteServerTimestamp: now,
        deleteSentByAci: member,
      }).ok
    );
  });
});
