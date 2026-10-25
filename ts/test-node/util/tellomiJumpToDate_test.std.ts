// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';
import {
  endOfLocalDayMs,
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

  it('endOfLocalDayMs is exclusive next midnight', () => {
    const ts = new Date(2026, 9, 26, 15, 30, 0).getTime();
    const end = endOfLocalDayMs(ts);
    const start = startOfLocalDayMs(ts);
    assert.strictEqual(end - start, 24 * 60 * 60 * 1000);
    assert.strictEqual(new Date(end).getDate(), 27);
  });

  it('jumpLowerBoundMs matches start of the chosen day', () => {
    const afternoon = new Date(2026, 0, 1, 18, 0, 0).getTime();
    assert.strictEqual(jumpLowerBoundMs(afternoon), startOfLocalDayMs(afternoon));
  });
});
