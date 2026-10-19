// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { assert } from 'chai';

import { TellomiHeldUnpins } from '../../util/tellomiHeldUnpins.std.ts';
import { TellomiUnpinCoordinator } from '../../util/tellomiUnpinCoordinator.std.ts';
import type { TellomiUnpinItem } from '../../util/tellomiUnpinCoordinator.std.ts';

const ids = (set: ReadonlySet<string>): Array<string> => [...set].sort();

// pinned-messages.md 3.5 / 3.6: the same cases as Android's and iOS's `TellomiHeldUnpinsTest`.
describe('tellomiHeldUnpins', () => {
  it('undo puts them back and nothing goes out', () => {
    const unpins = new TellomiHeldUnpins();
    unpins.hold(['1', '2']);
    assert.deepEqual(ids(unpins.held), ['1', '2']);

    assert.deepEqual(ids(unpins.undo(['1', '2'])), ['1', '2']);
    assert.deepEqual(ids(unpins.held), []);
    assert.deepEqual(ids(unpins.commit(['1', '2'])), [], 'too late to send');
  });

  it('after the wait they go out once and stay off the bar until the pins are gone', () => {
    const unpins = new TellomiHeldUnpins();
    unpins.hold(['1', '2']);

    assert.deepEqual(ids(unpins.commit(['1', '2'])), ['1', '2']);
    assert.deepEqual(ids(unpins.commit(['1', '2'])), [], 'not twice');
    assert.deepEqual(ids(unpins.undo(['1'])), [], 'too late to undo');
    assert.deepEqual(
      ids(unpins.held),
      ['1', '2'],
      'still sending: still off the bar'
    );

    unpins.prune(new Set(['2', '7']));
    assert.deepEqual(ids(unpins.held), ['2'], '1 is gone, 2 not yet');
    unpins.prune(new Set(['7']));
    assert.deepEqual(ids(unpins.held), []);
  });

  it("a pin that couldn't be unpinned comes back", () => {
    const unpins = new TellomiHeldUnpins();
    unpins.hold(['1', '2']);
    unpins.commit(['1', '2']);

    unpins.failed(['2']);
    assert.deepEqual(ids(unpins.held), ['1']);
  });

  it('a pin still waiting on undo stays off the bar while the pins change, and goes out when the chat closes', () => {
    const unpins = new TellomiHeldUnpins();
    unpins.hold(['1']);
    unpins.prune(new Set());
    assert.deepEqual(ids(unpins.held), ['1']);

    unpins.hold(['5']);
    unpins.commit(['5']);
    assert.deepEqual(
      ids(unpins.commitAll()),
      ['1'],
      "only what's still waiting"
    );
    assert.deepEqual(ids(unpins.commitAll()), []);
  });
});

describe('tellomiUnpinCoordinator', () => {
  type Timer = { callback: () => void; ms: number };

  function setup({ failFor = new Set<string>() } = {}) {
    const timers: Array<Timer> = [];
    const sent: Array<TellomiUnpinItem> = [];
    const offered: Array<Array<string>> = [];
    const failures: Array<Array<string>> = [];
    const coordinator = new TellomiUnpinCoordinator({
      undoMs: 5000,
      send: async item => {
        if (failFor.has(item.messageId)) {
          throw new Error('offline');
        }
        sent.push(item);
      },
      onHeld: messageIds => offered.push([...messageIds]),
      onFailed: messageIds => failures.push([...messageIds]),
      setTimeout: (callback, ms) => {
        timers.push({ callback, ms });
        return timers.length;
      },
    });
    let notified = 0;
    coordinator.subscribe(() => {
      notified += 1;
    });
    return {
      coordinator,
      timers,
      sent,
      offered,
      failures,
      notifications: () => notified,
    };
  }

  const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

  it('takes the pin off the bar at once, offers undo, and sends after 5 seconds', async () => {
    const { coordinator, timers, sent, offered } = setup();

    coordinator.request([{ messageId: 'a', forMe: false }]);
    assert.deepEqual(ids(coordinator.getSnapshot()), ['a']);
    assert.deepEqual(offered, [['a']]);
    assert.strictEqual(timers.length, 1);
    assert.strictEqual(timers[0]?.ms, 5000);
    assert.deepEqual(sent, [], 'nothing goes out during undo');

    timers[0]?.callback();
    await flush();
    assert.deepEqual(sent, [{ messageId: 'a', forMe: false }]);
    assert.deepEqual(
      ids(coordinator.getSnapshot()),
      ['a'],
      'still off the bar until the pin is gone'
    );

    coordinator.prune(new Set());
    assert.deepEqual(ids(coordinator.getSnapshot()), []);
  });

  it('an undone unpin is never sent', async () => {
    const { coordinator, timers, sent } = setup();

    coordinator.request([
      { messageId: 'a', forMe: false },
      { messageId: 'b', forMe: true },
    ]);
    coordinator.undo(['a', 'b']);
    assert.deepEqual(ids(coordinator.getSnapshot()), []);

    timers[0]?.callback();
    await flush();
    assert.deepEqual(sent, []);
  });

  it('one batch for "unpin all": all of them leave the bar together and go out together, a pin for me only keeping its flag', async () => {
    const { coordinator, timers, sent, offered } = setup();

    coordinator.request([
      { messageId: 'a', forMe: false },
      { messageId: 'b', forMe: true },
      { messageId: 'c', forMe: false },
    ]);
    assert.deepEqual(offered, [['a', 'b', 'c']], 'one "Undo" for all of them');
    timers[0]?.callback();
    await flush();
    assert.deepEqual(sent, [
      { messageId: 'a', forMe: false },
      { messageId: 'b', forMe: true },
      { messageId: 'c', forMe: false },
    ]);
  });

  it('asking twice for the same pin offers undo and sends once', async () => {
    const { coordinator, timers, sent, offered } = setup();

    coordinator.request([{ messageId: 'a', forMe: false }]);
    coordinator.request([{ messageId: 'a', forMe: false }]);
    assert.strictEqual(offered.length, 1);
    assert.strictEqual(timers.length, 1);
    timers[0]?.callback();
    await flush();
    assert.strictEqual(sent.length, 1);
  });

  it("puts back the pins that couldn't be sent, and says so once", async () => {
    const { coordinator, timers, sent, failures } = setup({
      failFor: new Set(['b']),
    });

    coordinator.request([
      { messageId: 'a', forMe: false },
      { messageId: 'b', forMe: false },
      { messageId: 'c', forMe: false },
    ]);
    timers[0]?.callback();
    await flush();

    assert.deepEqual(
      sent.map(item => item.messageId),
      ['a', 'c']
    );
    assert.deepEqual(failures, [['b']]);
    assert.deepEqual(
      ids(coordinator.getSnapshot()),
      ['a', 'c'],
      'b is back on the bar'
    );

    // It can be unpinned again.
    coordinator.request([{ messageId: 'b', forMe: false }]);
    assert.deepEqual(ids(coordinator.getSnapshot()), ['a', 'b', 'c']);
  });

  it('flushing on the way out sends what is still waiting on undo, once', async () => {
    const { coordinator, timers, sent } = setup();

    coordinator.request([{ messageId: 'a', forMe: false }]);
    await coordinator.flush();
    assert.deepEqual(sent, [{ messageId: 'a', forMe: false }]);

    timers[0]?.callback();
    await flush();
    assert.strictEqual(sent.length, 1, 'not sent again when the timer fires');
  });

  it('tells subscribers only when what is held changes', () => {
    const { coordinator, notifications } = setup();

    coordinator.prune(new Set(['x']));
    assert.strictEqual(notifications(), 0);
    coordinator.request([{ messageId: 'a', forMe: false }]);
    assert.strictEqual(notifications(), 1);
    coordinator.undo(['a']);
    assert.strictEqual(notifications(), 2);
    coordinator.undo(['a']);
    assert.strictEqual(notifications(), 2, 'nothing left to undo');
  });
});
