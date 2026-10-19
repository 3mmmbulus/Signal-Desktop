// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LookupFunction } from 'node:net';
import { assert } from 'chai';

import { parseRegions } from '../../util/tellomiRegion.std.ts';
import type {
  RegionIdType,
  RegionProbeResultType,
  RegionsType,
} from '../../util/tellomiRegion.std.ts';
import { createChatProbe } from '../../util/tellomiRegionProbe.node.ts';
import {
  DEFAULT_REGION_TARGET_STATE,
  REGION_TARGET_FAILURE_THRESHOLD,
  evaluateRegionTarget,
  isUrlInCurrentRegion,
  parseRegionTarget,
  parseRegionTargetState,
  rehostToCurrentRegion,
  tellomiRootOf,
} from '../../util/tellomiRegionTarget.std.ts';
import type { RegionTargetStateType } from '../../util/tellomiRegionTarget.std.ts';

const CONFIG_DIR = join(__dirname, '../../../config');

function productionRegions(): RegionsType {
  return parseRegions(
    JSON.parse(readFileSync(join(CONFIG_DIR, 'production.json'), 'utf8'))
      .regions
  );
}

const OK: RegionProbeResultType = { ok: true, rttMs: 30 };
const DOWN: RegionProbeResultType = { ok: false, error: 'down' };

function fakeProbe(
  results: Partial<Record<RegionIdType, RegionProbeResultType>>
) {
  const probed: Array<RegionIdType> = [];
  return {
    probed,
    probe: async (id: RegionIdType) => {
      probed.push(id);
      const result = results[id];
      assert.isDefined(result, `unexpected probe of ${id}`);
      return result;
    },
  };
}

function state(
  region: RegionIdType,
  target: string,
  failures = 0
): RegionTargetStateType {
  return { region, target, failures };
}

describe('Tellomi region target (REGION_PROFILE §6.2)', () => {
  it('parses the key: only global / cn are explicit', () => {
    assert.deepStrictEqual(parseRegionTarget(undefined), {
      target: 'global',
      explicit: false,
    });
    assert.deepStrictEqual(parseRegionTarget(''), {
      target: 'global',
      explicit: false,
    });
    assert.deepStrictEqual(parseRegionTarget('CN'), {
      target: 'global',
      explicit: false,
    });
    assert.deepStrictEqual(parseRegionTarget('cn'), {
      target: 'cn',
      explicit: true,
    });
    assert.deepStrictEqual(parseRegionTarget('global'), {
      target: 'global',
      explicit: true,
    });
  });

  it('parses a stored state defensively', () => {
    assert.deepStrictEqual(
      parseRegionTargetState(undefined),
      DEFAULT_REGION_TARGET_STATE
    );
    assert.deepStrictEqual(
      parseRegionTargetState('x'),
      DEFAULT_REGION_TARGET_STATE
    );
    assert.deepStrictEqual(
      parseRegionTargetState({ region: 'mars', target: 3, failures: -1 }),
      DEFAULT_REGION_TARGET_STATE
    );
    assert.deepStrictEqual(
      parseRegionTargetState({ region: 'cn', target: 'cn', failures: 2 }),
      state('cn', 'cn', 2)
    );
  });

  it('feature off: no key on global probes nothing', async () => {
    const { probe, probed } = fakeProbe({});
    const d = await evaluateRegionTarget({
      regions: productionRegions(),
      state: DEFAULT_REGION_TARGET_STATE,
      probe,
    });
    assert.strictEqual(d.reason, 'off');
    assert.strictEqual(d.state.region, 'global');
    assert.deepStrictEqual(probed, []);
  });

  it('feature off never resolves a tellomi.cn name', async () => {
    const looked: Array<string> = [];
    const lookup: LookupFunction = (hostname, _o, callback) => {
      looked.push(hostname);
      callback(new Error('offline'), '', 4);
    };
    for (const target of ['', 'global', 'nonsense']) {
      // eslint-disable-next-line no-await-in-loop
      await evaluateRegionTarget({
        regions: productionRegions(),
        state: state('global', target),
        probe: createChatProbe({ timeoutMs: 500, lookup }),
      });
    }
    assert.notInclude(looked.join(','), 'tellomi.cn');
  });

  it('moves to the target only after a successful probe', async () => {
    const down = fakeProbe({ cn: DOWN });
    const stay = await evaluateRegionTarget({
      regions: productionRegions(),
      state: state('global', 'cn'),
      probe: down.probe,
    });
    assert.strictEqual(stay.reason, 'target-unreachable');
    assert.strictEqual(stay.state.region, 'global');
    assert.deepStrictEqual(down.probed, ['cn']);

    const up = fakeProbe({ cn: OK });
    const moved = await evaluateRegionTarget({
      regions: productionRegions(),
      state: state('global', 'cn'),
      probe: up.probe,
    });
    assert.strictEqual(moved.reason, 'switch');
    assert.deepStrictEqual(moved.state, state('cn', 'cn'));
  });

  it('reverting the key moves back to global (after a probe)', async () => {
    for (const target of ['global', '']) {
      const { probe, probed } = fakeProbe({ global: OK });
      // eslint-disable-next-line no-await-in-loop
      const d = await evaluateRegionTarget({
        regions: productionRegions(),
        state: state('cn', target),
        probe,
      });
      assert.strictEqual(d.reason, 'switch');
      assert.strictEqual(d.state.region, 'global');
      assert.deepStrictEqual(probed, ['global']);
    }
  });

  it('falls back to the other region after repeated failures, then returns', async () => {
    const regions = productionRegions();
    let s = state('cn', 'cn');
    for (let i = 1; i < REGION_TARGET_FAILURE_THRESHOLD; i += 1) {
      const { probe } = fakeProbe({ cn: DOWN });
      // eslint-disable-next-line no-await-in-loop
      const d = await evaluateRegionTarget({ regions, state: s, probe });
      assert.strictEqual(d.reason, 'current-failing');
      assert.strictEqual(d.state.failures, i);
      s = d.state;
    }
    const last = fakeProbe({ cn: DOWN, global: OK });
    const failover = await evaluateRegionTarget({
      regions,
      state: s,
      probe: last.probe,
    });
    assert.strictEqual(failover.reason, 'failover');
    assert.deepStrictEqual(failover.state, state('global', 'cn'));

    const back = fakeProbe({ cn: OK });
    const returned = await evaluateRegionTarget({
      regions,
      state: failover.state,
      probe: back.probe,
    });
    assert.strictEqual(returned.reason, 'switch');
    assert.strictEqual(returned.state.region, 'cn');
  });

  it('reports no-alternative when both regions are down', async () => {
    const { probe } = fakeProbe({ cn: DOWN, global: DOWN });
    const d = await evaluateRegionTarget({
      regions: productionRegions(),
      state: state('cn', 'cn', REGION_TARGET_FAILURE_THRESHOLD - 1),
      probe,
    });
    assert.strictEqual(d.reason, 'no-alternative');
    assert.strictEqual(d.state.region, 'cn');
  });

  it('no failover without an explicit key', async () => {
    const { probe, probed } = fakeProbe({});
    const d = await evaluateRegionTarget({
      regions: productionRegions(),
      state: state('global', '', 99),
      probe,
    });
    assert.strictEqual(d.reason, 'off');
    assert.deepStrictEqual(probed, []);
  });

  it('a disabled cn is never a target', async () => {
    const regions = structuredClone(productionRegions());
    regions.cn.enabled = false;
    const { probe, probed } = fakeProbe({ global: OK });
    const d = await evaluateRegionTarget({
      regions,
      state: state('cn', 'cn'),
      probe,
    });
    assert.strictEqual(d.state.region, 'global');
    assert.notInclude(probed, 'cn');
  });

  it('keeps server URLs inside the current Tellomi root', () => {
    assert.strictEqual(tellomiRootOf('CHAT.tellomi.cn.'), 'tellomi.cn');
    assert.isUndefined(tellomiRootOf('nottellomi.cn'));
    const cn = 'https://chat.tellomi.cn';
    const app = 'https://chat.tellomi.app';
    assert.isTrue(
      isUrlInCurrentRegion('https://contentproxy.tellomi.cn:443', cn)
    );
    assert.isFalse(
      isUrlInCurrentRegion('https://contentproxy.tellomi.app:443', cn)
    );
    assert.isTrue(
      isUrlInCurrentRegion('https://contentproxy.tellomi.app:443', app)
    );
    assert.isFalse(isUrlInCurrentRegion('https://proxy.example.com', app));
    assert.isTrue(
      isUrlInCurrentRegion('https://anything.example', 'http://localhost:1')
    );

    assert.strictEqual(
      rehostToCurrentRegion('https://upload.tellomi.app/attachments', cn),
      'https://upload.tellomi.cn/attachments'
    );
    assert.strictEqual(
      rehostToCurrentRegion('https://upload.tellomi.cn:8443/a?b=1', app),
      'https://upload.tellomi.app:8443/a?b=1'
    );
    assert.strictEqual(
      rehostToCurrentRegion('https://upload.tellomi.app/attachments', app),
      'https://upload.tellomi.app/attachments'
    );
    assert.strictEqual(
      rehostToCurrentRegion('https://storage.googleapis.com/x', cn),
      'https://storage.googleapis.com/x'
    );
  });
});
