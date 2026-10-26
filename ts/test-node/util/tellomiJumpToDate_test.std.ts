// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  buildDaysWithMessagesSet,
  isJumpDayAvailable,
  jumpLowerBoundMs,
  startOfLocalDayMs,
} from '../../util/tellomiJumpToDate.std.ts';

describe('tellomiJumpToDate', () => {
  it('startOfLocalDayMs is on local midnight and ≤ timestamp', () => {
    const ts = new Date(2026, 9, 26, 15, 30, 0).getTime(); // Oct 26 2026 15:30 local
    const start = startOfLocalDayMs(ts);
    const d = new Date(start);
    assert.strictEqual(d.getHours(), 0);
    assert.strictEqual(d.getMinutes(), 0);
    assert.strictEqual(d.getSeconds(), 0);
    assert.strictEqual(d.getDate(), 26);
    assert.strictEqual(d.getMonth(), 9);
    assert.isAtMost(start, ts);
  });

  it('adjacent local midnights are 24h apart', () => {
    const day = new Date(2026, 9, 26, 15, 30, 0).getTime();
    const next = new Date(2026, 9, 27, 3, 0, 0).getTime();
    const start = startOfLocalDayMs(day);
    const nextStart = startOfLocalDayMs(next);
    assert.strictEqual(nextStart - start, 24 * 60 * 60 * 1000);
    assert.strictEqual(new Date(nextStart).getDate(), 27);
  });

  it('jumpLowerBoundMs matches start of the chosen day', () => {
    const afternoon = new Date(2026, 0, 1, 18, 0, 0).getTime();
    assert.strictEqual(
      jumpLowerBoundMs(afternoon),
      startOfLocalDayMs(afternoon)
    );
  });

  // Tellomi (desktop audit 7.2 r2): empty days grey / not tappable
  it('buildDaysWithMessagesSet collapses timestamps to local midnights', () => {
    const morning = new Date(2026, 9, 26, 8, 0, 0).getTime();
    const evening = new Date(2026, 9, 26, 21, 0, 0).getTime();
    const nextDay = new Date(2026, 9, 27, 1, 0, 0).getTime();
    const days = buildDaysWithMessagesSet([morning, evening, nextDay]);
    assert.strictEqual(days.size, 2);
    assert.isTrue(days.has(startOfLocalDayMs(morning)));
    assert.isTrue(days.has(startOfLocalDayMs(nextDay)));
  });

  it('isJumpDayAvailable is false for days with no messages', () => {
    const withMsg = new Date(2026, 9, 26, 12, 0, 0).getTime();
    const empty = new Date(2026, 9, 25, 12, 0, 0).getTime();
    const days = buildDaysWithMessagesSet([withMsg]);
    assert.isTrue(isJumpDayAvailable(withMsg, days));
    assert.isTrue(
      isJumpDayAvailable(new Date(2026, 9, 26, 23, 59, 0).getTime(), days)
    );
    assert.isFalse(isJumpDayAvailable(empty, days));
  });
});
