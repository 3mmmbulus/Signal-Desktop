// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

// Tellomi (REGION_PROFILE §6.2): the remote-config driven region switch.
//
// `global.tellomi.region.target` names the region clients should move to. Absent / empty / unknown
// = feature off: the target is `global` and there is no failover, so a client on `global` never
// touches the cn region. A client only moves after a successful probe of the region it moves to,
// and the region it moved to is remembered (last good). With an explicit target, repeated probe
// failures of the current region fall back to the other enabled region; the next evaluation
// probes the target again and moves back once it answers.
//
// Desktop applies the remembered region on the next start (app/config.main.ts); the evaluation
// itself runs in the main process (app/tellomiRegionStore.main.ts).

import { REGION_IDS, getEnabledRegions } from './tellomiRegion.std.ts';
import type {
  RegionIdType,
  RegionProbeType,
  RegionsType,
} from './tellomiRegion.std.ts';
import { getRegionEndpoints } from './tellomiRegion.std.ts';

export const REGION_TARGET_KEY = 'global.tellomi.region.target';

// Consecutive failed probes of the current region before falling back (same as the selector).
export const REGION_TARGET_FAILURE_THRESHOLD = 3;

export type RegionTargetType = Readonly<{
  target: RegionIdType;
  // false = the key is absent / empty / unrecognised: no failover.
  explicit: boolean;
}>;

export function parseRegionTarget(value: unknown): RegionTargetType {
  const id = REGION_IDS.find(candidate => candidate === value);
  return id === undefined
    ? { target: 'global', explicit: false }
    : { target: id, explicit: true };
}

// What is persisted between runs.
export type RegionTargetStateType = Readonly<{
  // The region to start in: the last one a probe confirmed (or global).
  region: RegionIdType;
  // The last value of the remote key seen ('' = absent).
  target: string;
  // Consecutive failed probes of `region` while the target was explicit.
  failures: number;
}>;

export const DEFAULT_REGION_TARGET_STATE: RegionTargetStateType = {
  region: 'global',
  target: '',
  failures: 0,
};

export function parseRegionTargetState(raw: unknown): RegionTargetStateType {
  if (raw == null || typeof raw !== 'object') {
    return DEFAULT_REGION_TARGET_STATE;
  }
  const record = raw as Record<string, unknown>;
  const region = REGION_IDS.find(id => id === record.region) ?? 'global';
  const target = typeof record.target === 'string' ? record.target : '';
  const failures =
    typeof record.failures === 'number' &&
    Number.isInteger(record.failures) &&
    record.failures >= 0
      ? record.failures
      : 0;
  return { region, target, failures };
}

export type RegionTargetReasonType =
  | 'off' // no key, already on global: nothing probed
  | 'switch' // moved to the target after a successful probe
  | 'target-unreachable' // target probe failed: stay
  | 'stay' // on the target, probe ok
  | 'current-failing' // on the target, probe failed, below threshold
  | 'failover' // threshold reached, moved to the other region
  | 'no-alternative'; // threshold reached, the other region failed too

export type RegionTargetDecisionType = Readonly<{
  state: RegionTargetStateType;
  reason: RegionTargetReasonType;
}>;

function safeRegion(regions: RegionsType, id: RegionIdType): RegionIdType {
  return regions[id]?.enabled ? id : 'global';
}

async function probeOk(
  probe: RegionProbeType,
  regions: RegionsType,
  id: RegionIdType
): Promise<boolean> {
  try {
    const result = await probe(id, getRegionEndpoints(regions, id));
    return result.ok;
  } catch {
    return false;
  }
}

export async function evaluateRegionTarget({
  regions,
  state,
  probe,
  failureThreshold = REGION_TARGET_FAILURE_THRESHOLD,
}: {
  regions: RegionsType;
  state: RegionTargetStateType;
  probe: RegionProbeType;
  failureThreshold?: number;
}): Promise<RegionTargetDecisionType> {
  const parsed = parseRegionTarget(state.target);
  const target = safeRegion(regions, parsed.target);
  const explicit = parsed.explicit && target === parsed.target;
  const current = safeRegion(regions, state.region);
  const base = { ...state, region: current };

  if (current !== target) {
    if (await probeOk(probe, regions, target)) {
      return {
        state: { ...base, region: target, failures: 0 },
        reason: 'switch',
      };
    }
    return { state: base, reason: 'target-unreachable' };
  }

  if (!explicit) {
    return { state: { ...base, failures: 0 }, reason: 'off' };
  }

  if (await probeOk(probe, regions, current)) {
    return { state: { ...base, failures: 0 }, reason: 'stay' };
  }
  const failures = state.failures + 1;
  if (failures < failureThreshold) {
    return { state: { ...base, failures }, reason: 'current-failing' };
  }
  const other = getEnabledRegions(regions).find(id => id !== current);
  if (other !== undefined && (await probeOk(probe, regions, other))) {
    return {
      state: { ...base, region: other, failures: 0 },
      reason: 'failover',
    };
  }
  return { state: { ...base, failures }, reason: 'no-alternative' };
}

// ---------------------------------------------------------------------------
// Keeping server-provided URLs inside the current region (REGION_PROFILE §6.2 / §8).

export const TELLOMI_ROOTS = ['tellomi.app', 'tellomi.cn'] as const;

export function tellomiRootOf(hostname: string): string | undefined {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return TELLOMI_ROOTS.find(root => host === root || host.endsWith(`.${root}`));
}

function rootOfUrl(url: string): string | undefined {
  try {
    return tellomiRootOf(new URL(url).hostname);
  } catch {
    return undefined;
  }
}

// `global.gif.proxyUrl` is served per account, not per region: only use it when it is under
// the same Tellomi root as the chat server this process talks to.
export function isUrlInCurrentRegion(url: string, serverUrl: string): boolean {
  const serverRoot = rootOfUrl(serverUrl);
  const urlRoot = rootOfUrl(url);
  return serverRoot === undefined || urlRoot === serverRoot;
}

// Moves a Tellomi URL (e.g. the upload form's `upload.tellomi.app`) to the chat server's root,
// keeping label, port, path and query. Non-Tellomi URLs and non-Tellomi servers are unchanged.
export function rehostToCurrentRegion(url: string, serverUrl: string): string {
  const serverRoot = rootOfUrl(serverUrl);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const urlRoot = tellomiRootOf(parsed.hostname);
  if (!serverRoot || !urlRoot || urlRoot === serverRoot) {
    return url;
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  parsed.hostname = host.slice(0, host.length - urlRoot.length) + serverRoot;
  return parsed.toString();
}
