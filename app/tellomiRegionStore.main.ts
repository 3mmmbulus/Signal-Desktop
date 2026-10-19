// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

// Tellomi (REGION_PROFILE §6.2): persistence and evaluation of the remote-config driven region
// switch on Desktop. The renderer forwards `global.tellomi.region.target` over IPC; the main
// process probes and remembers the region in `<userData>/tellomi-region.json`. The remembered
// region takes effect on the next start (config.main.ts reads it before node-config freezes):
// Desktop does not rebuild libsignal's Net / the REST endpoints at runtime.

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { app, ipcMain } from 'electron';

import { createLogger } from '../ts/logging/log.std.ts';
import { drop } from '../ts/util/drop.std.ts';
import { MINUTE } from '../ts/util/durations/index.std.ts';
import { REGION_SELECTOR_DEFAULTS } from '../ts/util/tellomiRegion.std.ts';
import type { RegionsType } from '../ts/util/tellomiRegion.std.ts';
import { createChatProbe } from '../ts/util/tellomiRegionProbe.node.ts';
import {
  evaluateRegionTarget,
  parseRegionTargetState,
} from '../ts/util/tellomiRegionTarget.std.ts';
import type { RegionTargetStateType } from '../ts/util/tellomiRegionTarget.std.ts';
import { getUserDataOverride } from './userDataDir.main.ts';

const log = createLogger('tellomiRegionStore');

export const REGION_STATE_FILE = 'tellomi-region.json';
export const REGION_TARGET_IPC = 'tellomi-region:target';
const RECHECK_INTERVAL = 5 * MINUTE;

// Same directory user_config.main.ts will use; `raw` is the not-yet-frozen config object.
export function getRegionStatePath(raw: Record<string, unknown>): string {
  const dir = getUserDataOverride(key => raw[key]) ?? app.getPath('userData');
  return join(dir, REGION_STATE_FILE);
}

export function readRegionState(path: string): RegionTargetStateType {
  try {
    return parseRegionTargetState(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return parseRegionTargetState(undefined);
  }
}

export function writeRegionState(
  path: string,
  state: RegionTargetStateType
): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, path);
}

export function startRegionTargetService({
  path,
  regions,
  startupRegion,
  certificateAuthority,
}: {
  path: string;
  regions: RegionsType;
  startupRegion: string;
  certificateAuthority?: string;
}): void {
  const probe = createChatProbe({
    timeoutMs: REGION_SELECTOR_DEFAULTS.probeTimeoutMs,
    certificateAuthority,
  });
  let running = false;

  const evaluate = async (why: string) => {
    if (running) {
      return;
    }
    running = true;
    try {
      const before = readRegionState(path);
      const { state, reason } = await evaluateRegionTarget({
        regions,
        state: before,
        probe,
      });
      if (JSON.stringify(state) !== JSON.stringify(before)) {
        writeRegionState(path, state);
      }
      if (reason !== 'off' && reason !== 'stay') {
        log.info(
          `region target (${why}): ${reason}; running ${startupRegion}, ` +
            `remembered ${state.region}, target ${state.target || '(none)'}` +
            (state.region !== startupRegion ? ' - applies on next start' : '')
        );
      }
    } catch (error) {
      log.warn(`region target (${why}) failed: ${String(error)}`);
    } finally {
      running = false;
    }
  };

  ipcMain.on(REGION_TARGET_IPC, (_event, value: unknown) => {
    const target = typeof value === 'string' ? value : '';
    const before = readRegionState(path);
    if (before.target !== target) {
      writeRegionState(path, { ...before, target, failures: 0 });
    }
    drop(evaluate('remote config'));
  });

  // Startup and periodic re-check use the last target seen, so a dead current region is still
  // noticed when the remote config cannot be fetched. With no target and global remembered,
  // evaluate() returns 'off' without touching the network.
  drop(evaluate('startup'));
  setInterval(() => drop(evaluate('periodic')), RECHECK_INTERVAL).unref();
}
