// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { tellomiIsFirstSentTransition } from '../../util/tellomiMessageStatus.std.ts';
import {
  tellomiAddChecksHintCandidate,
  tellomiChecksHintFirstSentSeen,
  tellomiClearChecksHintCandidates,
  tellomiRemoveChecksHintCandidate,
  tellomiSetChecksHintHandler,
} from '../../util/tellomiChecksHintCandidates.std.ts';

describe('Tellomi checks hint trigger (PM 2026-10-25)', () => {
  describe('tellomiIsFirstSentTransition', () => {
    it('counts sending → one tick and sending → straight to two ticks', () => {
      assert.isTrue(tellomiIsFirstSentTransition('sending', 'sent'));
      assert.isTrue(tellomiIsFirstSentTransition('sending', 'delivered'));
      assert.isTrue(tellomiIsFirstSentTransition('sending', 'read'));
      assert.isTrue(tellomiIsFirstSentTransition('sending', 'viewed'));
      assert.isTrue(tellomiIsFirstSentTransition('paused', 'sent'));
    });

    it('does not count first draw, later changes or failures', () => {
      assert.isFalse(tellomiIsFirstSentTransition(undefined, 'sent'));
      assert.isFalse(tellomiIsFirstSentTransition('sent', 'sent'));
      assert.isFalse(tellomiIsFirstSentTransition('sent', 'read'));
      assert.isFalse(tellomiIsFirstSentTransition('delivered', 'read'));
      assert.isFalse(tellomiIsFirstSentTransition('sending', 'error'));
      assert.isFalse(tellomiIsFirstSentTransition('sending', 'sending'));
    });
  });

  describe('candidates', () => {
    let seen: Array<string>;
    beforeEach(() => {
      seen = [];
      tellomiClearChecksHintCandidates();
      tellomiSetChecksHintHandler(id => seen.push(id));
    });
    afterEach(() => {
      tellomiSetChecksHintHandler(undefined);
      tellomiClearChecksHintCandidates();
    });

    it('fires only for a noted message, once', () => {
      assert.isFalse(tellomiChecksHintFirstSentSeen('a'));
      tellomiAddChecksHintCandidate('a');
      assert.isTrue(tellomiChecksHintFirstSentSeen('a'));
      assert.isFalse(tellomiChecksHintFirstSentSeen('a'));
      assert.deepEqual(seen, ['a']);
    });

    it('an edit removes the original message', () => {
      tellomiAddChecksHintCandidate('a');
      tellomiRemoveChecksHintCandidate('a');
      assert.isFalse(tellomiChecksHintFirstSentSeen('a'));
      assert.deepEqual(seen, []);
    });

    it('keeps at most 100, dropping the oldest', () => {
      for (let i = 0; i < 101; i += 1) {
        tellomiAddChecksHintCandidate(`m${i}`);
      }
      assert.isFalse(tellomiChecksHintFirstSentSeen('m0'));
      assert.isTrue(tellomiChecksHintFirstSentSeen('m100'));
    });
  });
});
