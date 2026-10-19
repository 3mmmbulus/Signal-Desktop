// Copyright 2026 重庆半格智能科技有限公司
// SPDX-License-Identifier: AGPL-3.0-only

// Tellomi (REGION_PROFILE §6.2): forwards `global.tellomi.region.target` from the remote config to
// the main process, which probes and remembers the region (app/tellomiRegionStore.main.ts).
// Sent once after the stored remote config is restored, and again whenever the key changes.

import { ipcRenderer } from 'electron';

import * as RemoteConfig from '../RemoteConfig.dom.ts';
import { REGION_TARGET_KEY } from './tellomiRegionTarget.std.ts';

// Must match REGION_TARGET_IPC in app/tellomiRegionStore.main.ts.
const REGION_TARGET_IPC = 'tellomi-region:target';

export function installRegionTargetBridge(): void {
  const send = () => {
    ipcRenderer.send(
      REGION_TARGET_IPC,
      RemoteConfig.getValue(REGION_TARGET_KEY) ?? ''
    );
  };
  RemoteConfig.onChange([REGION_TARGET_KEY], send);
  send();
}
