// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import { TellomiVoicePauseClock } from '../../util/tellomiVoicePauseClock.std.ts';

describe('tellomiVoicePauseClock', () => {
  it('paused time is not counted', () => {
    const c = new TellomiVoicePauseClock();
    assert.isTrue(c.start(100));
    assert.isTrue(c.pause(103));
    assert.isTrue(c.isPaused);
    assert.strictEqual(c.elapsed(200), 3);
    assert.isTrue(c.resume(200));
    assert.isTrue(c.isRecording);
    assert.strictEqual(c.elapsed(202), 5);
    assert.strictEqual(c.stop(204), 7);
    assert.strictEqual(c.state.type, 'stopped');
  });

  it('stop while paused keeps recorded time', () => {
    const c = new TellomiVoicePauseClock();
    c.start(0);
    c.pause(4);
    assert.strictEqual(c.stop(60), 4);
  });

  it('invalid transitions are ignored', () => {
    const c = new TellomiVoicePauseClock();
    assert.isFalse(c.pause(1));
    assert.isFalse(c.resume(1));
    assert.isUndefined(c.stop(1));
    c.start(0);
    assert.isFalse(c.start(1));
    assert.isFalse(c.resume(1));
    c.pause(2);
    assert.isFalse(c.pause(3));
    c.stop(3);
    assert.isFalse(c.resume(4));
    assert.isUndefined(c.stop(5));
  });

  it('clock going backwards never goes negative', () => {
    const c = new TellomiVoicePauseClock();
    c.start(10);
    assert.strictEqual(c.elapsed(5), 0);
    c.pause(5);
    assert.strictEqual(c.elapsed(5), 0);
  });

  it('forceResetAndStart begins a fresh take', () => {
    const c = new TellomiVoicePauseClock();
    c.start(0);
    c.pause(10);
    c.forceResetAndStart(100);
    assert.isTrue(c.isRecording);
    assert.strictEqual(c.elapsed(105), 5);
  });
});
