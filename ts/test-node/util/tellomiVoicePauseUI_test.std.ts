// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  tellomiVoicePauseAction,
  tellomiVoicePauseLabelKey,
  tellomiVoicePauseSymbol,
} from '../../util/tellomiVoicePauseUI.std.ts';

describe('tellomiVoicePauseUI', () => {
  it('symbol, action, and label follow paused state', () => {
    assert.strictEqual(tellomiVoicePauseSymbol(false), 'pause-fill');
    assert.strictEqual(tellomiVoicePauseSymbol(true), 'play-fill');
    assert.strictEqual(tellomiVoicePauseAction(false), 'pause');
    assert.strictEqual(tellomiVoicePauseAction(true), 'resume');
    assert.strictEqual(
      tellomiVoicePauseLabelKey(false),
      'icu:TellomiVoicePause__pause_recording'
    );
    assert.strictEqual(
      tellomiVoicePauseLabelKey(true),
      'icu:TellomiVoicePause__resume_recording'
    );
  });
});
